import { signal } from "nsh";
import { appName, host, type Server, servers, useServer } from "./api";
import { nav } from "./nav";
import { run } from "./run";
import { uploads } from "./uploads";

/** Where the app is: finding a server, setting it up, signing in, or signed in. */
export type Stage =
  | { name: "loading" }
  | { name: "connect" }
  | { name: "setup"; tokenRequired: boolean }
  | { name: "login"; appName: string }
  | { name: "main" };

export const stage = signal<Stage>({ name: "loading" });

/** While another server is being added: the one to go back to on cancel. */
export const returnTo = signal<Server | null>(null);

/** Signed in (or set up): the dashboard, from home. */
export function enterMain() {
  returnTo.set(null);
  nav.setRoutes([{ name: "home" }]);
  stage.set({ name: "main" });
}

/** Signed out of this server: on to the next one signed in, else its login screen. */
export function signedOut() {
  const next = servers()[0];

  if (next) return void openServer(next);

  nav.setRoutes([{ name: "home" }]);
  stage.set(host() ? { name: "login", appName: appName() } : { name: "connect" });
}

const uploading = () => uploads().some((u) => u.status === "queued" || u.status === "uploading" || u.status === "processing");

/** Switches to a saved server: its dashboard, or its login screen when its session ended. */
export async function openServer(server: Server) {
  let signedIn = false;

  const ok = await run(async () => {
    // Uploads talk to the server they started on.
    if (uploading()) throw new Error("Wait for the uploads to finish before switching servers.");

    signedIn = await useServer(server);
  });

  if (!ok) return;
  if (signedIn) return enterMain();

  returnTo.set(null);
  stage.set({ name: "login", appName: server.appName });
}

/** Connects to one more server, keeping the others signed in. */
export function addServer() {
  returnTo.set(servers().find((s) => s.host === host()) ?? null);
  stage.set({ name: "connect" });
}
