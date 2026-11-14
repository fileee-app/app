import type { IconName } from "../components/icon";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
}

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

/** A date in a list row: the time today, the day this year, else the day and year ("3:08 PM", "Nov 11", "Nov 11, 2025"). */
export function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";

  const date = new Date(iso);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(undefined, { timeStyle: "short" });

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** A file kind's icon and color, as Finder colors them. */
export function kindIcon(mimeType: string | null | undefined): { icon: IconName; tint: string } {
  const type = mimeType ?? "";

  if (type.startsWith("image/")) return { icon: "file-image", tint: "tint-green-500" };
  if (type.startsWith("video/")) return { icon: "file-video", tint: "tint-purple-500" };
  if (type.startsWith("audio/")) return { icon: "file-audio", tint: "tint-pink-500" };
  if (type === "application/pdf") return { icon: "file-text", tint: "tint-red-500" };
  if (/zip|tar|gzip|7z|rar/.test(type)) return { icon: "file-archive", tint: "tint-amber-500" };
  if (type.startsWith("text/") || type.includes("json")) return { icon: "file-text", tint: "tint-slate-500" };

  return { icon: "file", tint: "tint-slate-500" };
}

// What a name's extension says a file is, for lists that have no MIME type (trash).
const EXTENSIONS: [RegExp, string][] = [
  [/\.(png|jpe?g|gif|webp|heic|heif|avif|svg|bmp|tiff?)$/i, "image/"],
  [/\.(mp4|mov|m4v|webm|mkv|avi)$/i, "video/"],
  [/\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i, "audio/"],
  [/\.pdf$/i, "application/pdf"],
  [/\.(zip|tar|gz|tgz|7z|rar)$/i, "zip"],
  [/\.(txt|md|csv|json|log|ya?ml|xml|html?)$/i, "text/"],
];

/** A file kind's icon and color from its name alone. */
export const kindIconOf = (name: string) => kindIcon(EXTENSIONS.find(([pattern]) => pattern.test(name))?.[1]);
