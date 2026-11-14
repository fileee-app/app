import { openUrl, platform, type Point } from "nsh";
import { Menu } from "nsh/desktop";
import { pickChoice } from "../components/choice-sheet";
import { pickFolder } from "../components/folder-picker";
import type { IconName } from "../components/icon";
import { prompt } from "../components/prompt";
import { call } from "./api";
import { nav } from "./nav";
import { confirm, run } from "./run";
import type { FileItem, Folder } from "./types";

export type Item = { kind: "file"; file: FileItem } | { kind: "folder"; folder: Folder };

export const itemKey = (item: Item) => (item.kind === "file" ? `f:${item.file.id}` : `d:${item.folder.id}`);
export const itemName = (item: Item) => (item.kind === "file" ? item.file.name : item.folder.name);

/** One thing to do with items: a row of an action sheet, or of a context menu. */
export interface Choice {
  label: string;
  run: () => unknown;
  destructive?: boolean;
  /** The keystroke, as `keymap` names it, shown in context menus. */
  shortcut?: string;
  /** Its icon in toolbars. */
  icon?: IconName;
}

export const download = (fileId: string) =>
  run(async () => {
    const { url } = await call<{ url: string }>("file/downloadUrl", { fileId });

    await openUrl(url);
  });

/** Opens a file's details, or a folder of the storage named `storageName`. */
export function openItem(item: Item, storageName = "") {
  if (item.kind === "file") nav.push({ name: "file", fileId: item.file.id, title: item.file.name });
  else nav.push({ name: "folder", storageId: item.folder.storageId, folderId: item.folder.id, title: storageName || item.folder.name });
}

export async function rename(item: Item) {
  const name = await prompt({
    title: item.kind === "file" ? "Rename file" : "Rename folder",
    label: "Name",
    value: itemName(item),
    confirm: "Rename",
  });

  if (name === null) return;

  await run(() =>
    item.kind === "file"
      ? call("file/rename", { fileId: item.file.id, name })
      : call("folder/rename", { folderId: item.folder.id, name }),
  );
}

/** Moves items of one storage to a folder the user picks. */
export async function move(items: Item[]) {
  const first = items[0];

  if (!first) return;

  const storageId = first.kind === "file" ? first.file.storageId : first.folder.storageId;
  const folders = items.flatMap((i) => (i.kind === "folder" ? [i.folder.id] : []));
  const to = await pickFolder(storageId, folders);

  if (!to) return;

  await run(async () => {
    for (const item of items) {
      if (item.kind === "file") await call("file/move", { fileId: item.file.id, folderId: to });
      else await call("folder/move", { folderId: item.folder.id, parentId: to });
    }
  });
}

export const star = (files: FileItem[], starred: boolean) =>
  run(async () => {
    for (const file of files) await call("file/star", { fileId: file.id, starred });
  });

export async function trash(items: Item[]) {
  const folders = items.filter((i) => i.kind === "folder").length;
  const what = items.length === 1 ? itemName(items[0]!) : `${items.length} items`;

  if (folders > 0 && !(await confirm("Move to trash?", `${what} and everything in ${folders === 1 && items.length === 1 ? "it" : "them"} go to trash.`, "Move to trash"))) {
    return false;
  }

  return run(async () => {
    for (const item of items) {
      if (item.kind === "file") await call("file/trash", { fileId: item.file.id });
      else await call("folder/trash", { folderId: item.folder.id });
    }
  });
}

const share = (item: Item) =>
  nav.push(
    item.kind === "file"
      ? { name: "share", fileId: item.file.id, title: item.file.name }
      : { name: "share", folderId: item.folder.id, title: item.folder.name },
  );

/** What can be done with one item. */
export function itemChoices(item: Item, storageName?: string): Choice[] {
  const file = item.kind === "file" ? item.file : null;

  return [
    { label: "Open", run: () => openItem(item, storageName), shortcut: "enter", icon: file ? "file" : "folder" },
    ...(file ? [{ label: "Download", run: () => download(file.id), icon: "download" as const }] : []),
    { label: "Share", run: () => share(item), icon: "share-2" },
    ...(file ? [{ label: file.starred ? "Unstar" : "Star", run: () => star([file], !file.starred), shortcut: "s", icon: "star" as const }] : []),
    { label: "Rename", run: () => rename(item), shortcut: "f2", icon: "pencil" },
    { label: "Move", run: () => move([item]), shortcut: "m", icon: "folder-input" },
    { label: "Move to trash", run: () => trash([item]), destructive: true, shortcut: "backspace", icon: "trash-2" },
  ];
}

/** What can be done with several items at once, as the web app's selection toolbar offers. */
export function selectionChoices(items: Item[], storageName?: string): Choice[] {
  if (items.length === 1) return itemChoices(items[0]!, storageName);

  const files = items.flatMap((i) => (i.kind === "file" ? [i.file] : []));
  const allStarred = files.length > 0 && files.every((f) => f.starred);

  return [
    ...(files.length ? [{ label: allStarred ? "Unstar" : "Star", run: () => star(files, !allStarred), shortcut: "s", icon: "star" as const }] : []),
    { label: "Move", run: () => move(items), shortcut: "m", icon: "folder-input" },
    { label: "Move to trash", run: () => trash(items), destructive: true, shortcut: "backspace", icon: "trash-2" },
  ];
}

/** The choices in a dropdown at `at`, else at the pointer (desktops), or in a sheet from the bottom (phones). */
export async function showChoices(title: string, choices: Choice[], at?: Point) {
  if (platform.desktop) {
    await Menu.popup(
      choices.map((c) => ({ label: c.label, shortcut: c.shortcut, onSelect: () => void c.run() })),
      at,
    );

    return;
  }

  await (await pickChoice(title, choices))?.run();
}

export const fileMenu = (file: FileItem, at?: Point) => showChoices(file.name, itemChoices({ kind: "file", file }), at);
