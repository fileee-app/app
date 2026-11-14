import { Media } from "fileee/native";
import { call } from "./api";
import { decodeInPage } from "./thumbnailer";
import type { PreviewKind } from "./types";

/** Bytes of a file being processed: a local one's, or the bucket's copy. */
export type Bytes = (start: number, end: number) => Promise<Uint8Array>;

type Metadata = Record<string, string | number | boolean>;

const TEXT_LIMIT = 1024 * 1024;
const MAX_DECODE = 256 * 1024 * 1024; // images and hashing need the whole file in memory

/** Lines and encoding of text, as the web app reads them; null for bytes that aren't text. */
export function readText(bytes: Uint8Array, size: number): Metadata | null {
  const [a, b] = bytes;
  const utf16 = a === 0xff && b === 0xfe ? "utf-16le" : a === 0xfe && b === 0xff ? "utf-16be" : null;
  let text: string;
  let encoding: string;

  if (utf16) {
    text = new TextDecoder(utf16).decode(bytes);
    encoding = utf16;
  } else if (bytes.subarray(0, 8192).includes(0)) {
    return null;
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true });
      encoding = "utf-8";
    } catch {
      text = new TextDecoder("latin1").decode(bytes);
      encoding = "windows-1252";
    }
  }

  return {
    lines: text ? text.split("\n").length : 0,
    encoding,
    ...(size > TEXT_LIMIT ? { linesPartial: true } : {}),
  };
}

async function previewUrl(fileId: string) {
  const { url } = await call<{ url: string | null }>("file/previewUrl", { fileId });

  if (!url) throw new Error("This file has no preview to read.");

  return url;
}

/** The bucket's copy of a file, for files already uploaded. */
async function remote(fileId: string): Promise<Bytes> {
  const url = await previewUrl(fileId);

  return async (start, end) => {
    const response = await fetch(url, { headers: { range: `bytes=${start}-${end - 1}` } });

    if (!response.ok) throw new Error(`The bucket answered HTTP ${response.status}.`);

    return new Uint8Array(await response.arrayBuffer());
  };
}

/** An image's details and thumbnail, decoded natively; null for a format the native decoder lacks. */
function decodeImage(bytes: Uint8Array) {
  try {
    const image = Media.image(bytes);
    const metadata = Object.fromEntries(
      Object.entries({
        width: image.width,
        height: image.height,
        camera: image.camera,
        takenAt: image.takenAt,
        latitude: image.latitude,
        longitude: image.longitude,
      }).filter(([, value]) => value !== null && value !== undefined),
    ) as Metadata;

    return { metadata, thumbnail: image.thumbnail };
  } catch {
    return null;
  }
}

/**
 * Makes a file's thumbnail and reads its details on this device, as the web app does in the browser;
 * the server never sees the bytes. Images and text decode natively; PDFs, video, audio and image
 * formats the native decoder lacks decode in the web app's thumbnailer page.
 */
export async function processFile(fileId: string, local?: Bytes, hash?: () => Promise<string>) {
  const { kind, size, url: thumbnailUrl } = await call<{ kind: PreviewKind; size: number; url: string | null }>(
    "file/signThumbnail",
    { fileId },
  );
  const sha256 = size <= MAX_DECODE ? await hash?.() : undefined;
  let metadata: Metadata | undefined;
  let thumbnail = false;

  let image: Uint8Array | null = null;

  if (kind === "text") {
    metadata = readText(await (local ?? (await remote(fileId)))(0, Math.min(size, TEXT_LIMIT)), size) ?? {};
  } else if (kind !== "none" && !((kind === "image" || kind === "pdf") && size > MAX_DECODE)) {
    const native = kind === "image" ? decodeImage(await (local ?? (await remote(fileId)))(0, size)) : null;
    const decoded = native ?? (await decodeInPage(kind, await previewUrl(fileId), size));

    metadata = decoded.metadata;
    image = decoded.thumbnail;
  }

  if (image && thumbnailUrl) thumbnail = (await fetch(thumbnailUrl, { method: "PUT", body: image })).ok;
  if (metadata || sha256) await call("file/saveExtracted", { fileId, metadata, thumbnail, sha256 });
}

/** Processes a storage's files that have no thumbnail or details yet, three at a time, as the web app does. */
export async function backfill(storageId: string, signal: AbortSignal, onProgress: (done: number, failed: number) => void) {
  let [done, failed] = [0, 0];
  let cursor: string | undefined;

  do {
    const page = await call<{ fileIds: string[]; nextCursor?: string }>("storage/backfillCandidates", { storageId, cursor });

    const queue = [...page.fileIds];

    const worker = async () => {
      for (let id = queue.shift(); id && !signal.aborted; id = queue.shift()) {
        await processFile(id).then(
          () => done++,
          () => failed++,
        );
        onProgress(done, failed);
      }
    };

    await Promise.all(Array.from({ length: 3 }, worker));
    cursor = page.nextCursor;
  } while (cursor && !signal.aborted);

  return { done, failed };
}
