import { signal } from "nsh";
import { createNavStack } from "nsh/base";
import type { StorageInfo } from "./types";

export type Section = "home" | "search" | "trash" | "settings";

export type Route =
  | { name: Section }
  | { name: "folder"; storageId: string; folderId?: string; title: string }
  | { name: "file"; fileId: string; title: string }
  | { name: "missing"; storageId: string }
  | { name: "share"; fileId?: string; folderId?: string; title: string }
  | { name: "account" }
  | { name: "general" }
  | { name: "storages" }
  | { name: "storage-form"; storage?: StorageInfo }
  | { name: "users" };

/** The stack on screen. A section gets a new one rather than swapping the root of a live native stack. */
export const stack = signal(createNavStack<Route>([{ name: "home" }]));

export const nav = {
  routes: () => stack().routes(),
  push: (route: Route) => stack().push(route),
  pop: () => stack().pop(),
  setRoutes: (routes: Route[]) => stack.set(createNavStack(routes)),
};

/** The top-level section the stack starts from: the sidebar and the tab bar select one. */
export const section = () => nav.routes()[0]!.name as Section;

export const openSection = (name: Section) => nav.setRoutes([{ name }]);

/** The phones' tab bar's height: it floats over the pages' bottom, so what sits above it (a floating button, the upload tray) clears it. 0 on desktops. */
export const tabBarHeight = signal(0);
