import { signal, type WebViewRef } from "nsh";
import type { PreviewKind } from "./types";

type Metadata = Record<string, string | number | boolean>;

interface Reply {
  id?: number;
  ready?: boolean;
  metadata?: Metadata;
  thumbnail?: string | null;
  error?: string;
}

// Video can take a while to reach its first second; the page gives up at 60 s itself.
const TIMEOUT = 75_000;
const LOAD_TIMEOUT = 20_000;

/** Whether the hidden web view is on screen: from the first file that needs it until its page fails. */
export const wanted = signal(false);

let page: WebViewRef | null = null;
let ready: Promise<void> | null = null;
let settle: { resolve: () => void; reject: (error: Error) => void } | null = null;
const waiting = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();
let nextId = 1;

function pageReady() {
  if (!ready) {
    ready = new Promise<void>((resolve, reject) => (settle = { resolve, reject }));
    wanted.set(true);
    setTimeout(() => !page && onPageError("Couldn't load the previews page from the server. Is it up to date?"), LOAD_TIMEOUT);
  }

  return ready;
}

/** The host component passes each message its page posts, with the web view it came from. */
export function onPageMessage(data: string, from: WebViewRef) {
  const reply = JSON.parse(data) as Reply;

  if (reply.ready) {
    page = from;
    settle?.resolve();

    return;
  }

  const job = waiting.get(reply.id!);

  waiting.delete(reply.id!);

  if (reply.error) job?.reject(new Error(reply.error));
  else job?.resolve(reply);
}

/** The page didn't load: everything waiting on it fails, and the next file tries a fresh one. */
export function onPageError(message: string) {
  const error = new Error(message);

  settle?.reject(error);

  for (const job of waiting.values()) job.reject(error);

  waiting.clear();
  [page, ready, settle] = [null, null, null];
  wanted.set(false);
}

const dataUrlBytes = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));

/**
 * Decodes a file the app can't decode natively (a PDF, a video, audio) in the web app's thumbnailer
 * page, from the file's presigned URL: its metadata, and a JPEG thumbnail when it has one.
 */
export async function decodeInPage(kind: PreviewKind, url: string, size: number) {
  await pageReady();

  const id = nextId++;
  const reply = await new Promise<Reply>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error("Making the preview took too long."));
    }, TIMEOUT);

    waiting.set(id, {
      resolve: (r) => (clearTimeout(timer), resolve(r)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    });
    page!.postMessage(JSON.stringify({ id, kind, url, size }));
  });

  return { metadata: reply.metadata ?? {}, thumbnail: reply.thumbnail ? dataUrlBytes(reply.thumbnail) : null };
}
