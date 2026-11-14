import { type LocalFile, LocalFiles, Media } from "fileee/native";
import { Picker, platform, signal } from "nsh";
import { call, changed } from "./api";
import { type Bytes, processFile } from "./process";

/** Something to upload: a local file (desktops) or a picked photo (everywhere). */
interface Source {
  name: string;
  size: number;
  type: string;
  /** Folders to create under the target, for folder uploads. */
  dirs: string[];
  bytes: Bytes;
  sha256: () => Promise<string>;
}

export interface Upload {
  id: number;
  name: string;
  size: number;
  loaded: number;
  status: "queued" | "uploading" | "processing" | "done" | "error" | "canceled";
  error?: string;
}

export interface Target {
  storageId: string;
  folderId: string;
}

/** An upload the server still waits on: the app quit, or the connection dropped. */
export interface Pending {
  fileId: string;
  name: string;
  size: number;
  storageId: string;
  folderId: string;
}

type Plan =
  | { fileId: string; kind: "single"; url: string }
  | { fileId: string; kind: "multipart"; partSize: number; uploadedParts?: number[] };

const FILE_CONCURRENCY = 3;
const PART_ATTEMPTS = 3;

const fromLocal = (file: LocalFile): Source => ({
  name: file.name,
  size: file.size,
  type: "", // the server guesses it from the name
  dirs: file.dirs,
  bytes: async (start, end) => LocalFiles.read(file.path, start, end - start),
  sha256: async () => LocalFiles.sha256(file.path),
});

function fromPicked(file: File): Source {
  const bytes: Bytes = async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    dirs: [],
    bytes,
    sha256: async () => Media.sha256(await bytes(0, file.size)),
  };
}

export const uploads = signal<Upload[]>([]);

interface Job {
  source: Source;
  target: Target;
  /** The files picked or dropped together, which share the folders they make. */
  batch: number;
  fileId?: string;
  controller?: AbortController;
}

const jobs = new Map<number, Job>();
const folders = new Map<string, Promise<string>>();
let nextId = 1;
let nextBatch = 1;

/** The folder a file of a folder upload goes in, made once for all the files in it. */
function folderFor(job: Job) {
  const { target, source } = job;
  const key = `${job.batch}/${source.dirs.join("/")}`;
  let folder = folders.get(key);

  if (!folder) {
    folder = call<{ folderId: string }>("folder/ensurePath", {
      storageId: target.storageId,
      parentId: target.folderId,
      segments: source.dirs,
    }).then((r) => r.folderId);
    folders.set(key, folder);
    folder.catch(() => folders.delete(key));
  }

  return folder;
}
let running = 0;

const patch = (id: number, change: Partial<Upload>) =>
  uploads.update((list) => list.map((u) => (u.id === id ? { ...u, ...change } : u)));

async function put(url: string, body: Uint8Array, signal: AbortSignal) {
  const response = await fetch(url, { method: "PUT", body, signal });

  if (!response.ok) throw new Error(`The bucket refused the upload (HTTP ${response.status}).`);
}

async function send(id: number, job: Job, signal: AbortSignal) {
  const { source, target } = job;
  let plan: Plan;

  if (job.fileId) {
    plan = await call<Plan>("upload/resume", { fileId: job.fileId });
  } else {
    const folderId = source.dirs.length ? await folderFor(job) : target.folderId;

    plan = await call<Plan>("upload/start", {
      storageId: target.storageId,
      folderId,
      name: source.name,
      size: source.size,
      mimeType: source.type,
    });
    job.fileId = plan.fileId;
  }

  signal.throwIfAborted();

  if (plan.kind === "single") {
    await put(plan.url, await source.bytes(0, source.size), signal);
  } else {
    const count = Math.ceil(source.size / plan.partSize);
    const done = new Set(plan.uploadedParts ?? []);
    const sizeOf = (part: number) => Math.min(part * plan.partSize, source.size) - (part - 1) * plan.partSize;
    let loaded = [...done].reduce((sum, part) => sum + sizeOf(part), 0);

    // shortcut: one part at a time, with progress per part (fetch reports no upload progress); add part concurrency if big uploads feel slow.
    for (let part = 1; part <= count; part++) {
      if (done.has(part)) continue;

      for (let attempt = 1; ; attempt++) {
        try {
          const [signed] = await call<{ url: string }[]>("upload/signParts", { fileId: plan.fileId, partNumbers: [part] });

          await put(signed!.url, await source.bytes((part - 1) * plan.partSize, part * plan.partSize), signal);
          break;
        } catch (error) {
          if (signal.aborted || attempt === PART_ATTEMPTS) throw error;

          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

      loaded += sizeOf(part);
      patch(id, { loaded });
    }
  }

  signal.throwIfAborted();
  await call("upload/complete", { fileId: plan.fileId });
  changed();
}

async function run(id: number) {
  const job = jobs.get(id)!;
  const controller = new AbortController();

  job.controller = controller;
  patch(id, { status: "uploading", error: undefined });

  try {
    await send(id, job, controller.signal);
    patch(id, { status: "processing", loaded: job.source.size });

    // The file is safe by now: a failure here only costs it a thumbnail, which "Generate previews" can redo.
    await processFile(job.fileId!, job.source.bytes, job.source.sha256).catch((e) => console.warn(`No preview for ${job.source.name}: ${e}`));
    patch(id, { status: "done" });
    changed();
  } catch (error) {
    if (controller.signal.aborted) return;

    patch(id, { status: "error", error: (error as Error).message });
  }
}

function pump() {
  while (running < FILE_CONCURRENCY) {
    const next = uploads().find((u) => u.status === "queued");

    if (!next) return;

    running++;
    void run(next.id).finally(() => {
      running--;
      pump();
    });
  }
}

function enqueue(sources: Source[], target: Target, fileId?: string) {
  const batch = nextBatch++;

  for (const source of sources) {
    const id = nextId++;

    jobs.set(id, { source, target, batch, fileId });
    uploads.update((all) => [...all, { id, name: source.name, size: source.size, loaded: 0, status: "queued" }]);
  }

  pump();
}

/** The desktops' open dialog: files, or a folder with everything in it. */
export async function uploadFiles(target: Target, folder = false) {
  enqueue((await LocalFiles.pick(folder)).map(fromLocal), target);
}

/** Photos and videos from the system's picker, the one picker phones have. */
export async function uploadPhotos(target: Target) {
  const picked = await Picker.pickImages({ multiple: true, format: "current" });

  enqueue(
    picked.map((p) => fromPicked(p.file)),
    target,
  );
}

/** `file:` URLs dropped on a folder, files and folders alike. */
export function uploadDropped(uris: string[], target: Target) {
  const paths = uris.map((uri) => decodeURIComponent(new URL(uri).pathname).replace(/^\/([A-Za-z]:)/, "$1"));

  enqueue(LocalFiles.expand(paths).map(fromLocal), target);
}

/** Stops an upload and tells the server to drop what arrived. */
export async function cancelUpload(id: number) {
  const job = jobs.get(id);

  if (!job) return;

  job.controller?.abort();
  patch(id, { status: "canceled" });

  if (job.fileId) await call("upload/abort", { fileId: job.fileId }).catch(() => {});

  changed();
}

export const retryUpload = (id: number) => {
  patch(id, { status: "queued" });
  pump();
};

/** Picks the interrupted file again and carries on where it stopped; the bucket keeps the parts it has. */
export async function resumePending(pending: Pending) {
  const picked = platform.desktop
    ? (await LocalFiles.pick(false)).map(fromLocal)
    : (await Picker.pickImages({ multiple: false, format: "current" })).map((p) => fromPicked(p.file));
  const source = picked[0];

  if (!source) return;

  if (source.name !== pending.name || source.size !== pending.size) {
    throw new Error(`Pick ${pending.name} (${pending.size} bytes) to resume it.`);
  }

  // The server already made its folders.
  enqueue([{ ...source, dirs: [] }], { storageId: pending.storageId, folderId: pending.folderId }, pending.fileId);
}

export const discardPending = (pending: Pending) => call("upload/abort", { fileId: pending.fileId });

/** Drops finished, failed and canceled uploads from the tray. */
export const clearFinished = () =>
  uploads.update((list) => list.filter((u) => u.status === "queued" || u.status === "uploading" || u.status === "processing"));

/** Whether this session is running the upload of `fileId`, so it isn't shown as interrupted. */
export const isRunning = (fileId: string) => [...jobs.values()].some((job) => job.fileId === fileId);
