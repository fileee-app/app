import { signal, Storage } from "nsh";
import type { User } from "./types";

/** A failed call, with the server's message written for the user. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// shortcut: the tokens sit in nsh's Storage, a plain file in the app's data folder; move them to the Keychain/Keystore through a native module before shipping to shared devices.
const KEY = "session";
const SERVERS = "servers";

export const host = signal("");
export const token = signal<string | null>(null);
export const user = signal<User | null>(null);
/** The server's name, as its setup named it. */
export const appName = signal("Fileee");

/** A server the user is signed in to: the app keeps each one's session to switch between them. */
export interface Server {
  host: string;
  token: string;
  appName: string;
  name: string;
  email: string;
}

export const servers = signal<Server[]>([]);

const saveServers = () => Storage.setItem(SERVERS, JSON.stringify(servers()));

/** Adds or updates the server signed in to now. */
function remember() {
  const t = token();
  const u = user();

  if (!t || !u) return;

  const entry = { host: host(), token: t, appName: appName(), name: u.name, email: u.email };

  servers.update((list) => (list.some((s) => s.host === entry.host) ? list.map((s) => (s.host === entry.host ? entry : s)) : [...list, entry]));
  void saveServers();
}

function dropServer(at: string) {
  servers.update((list) => list.filter((s) => s.host !== at));
  void saveServers();
}

/** Bumped after every change, so every loaded list reloads. */
export const changes = signal(0);
export const changed = () => changes.update((n) => n + 1);

const save = () => Storage.setItem(KEY, JSON.stringify({ host: host(), token: token() }));

/** "files.example.com" or "http://localhost:3000/" → "https://files.example.com", "http://localhost:3000". */
export function normalizeHost(input: string) {
  const text = input.trim();
  const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);

  return url.origin;
}

/** Calls a procedure of the server's app API (`/api/app`, documented in the web repo's docs). */
export async function call<T>(path: string, input?: unknown, at = host(), auth = token()): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${at}/api/app/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(input === undefined ? {} : { json: input }),
    });
  } catch {
    throw new ApiError("NETWORK", `Couldn't reach ${at}. Check the address and your connection.`);
  }

  const body = (await response.json().catch(() => null)) as { json?: any } | null;

  if (response.ok) return body?.json as T;

  const error = body?.json;

  // The token expired or was revoked: back to the login screen.
  if (response.status === 401 && auth && at === host() && path !== "auth/login") void forget();

  throw new ApiError(
    error?.code ?? "HTTP",
    error?.message ?? `The server answered HTTP ${response.status}. Is this a Fileee server?`,
  );
}

/** Restores the last session; resolves with whether someone is signed in. */
export async function restore() {
  const saved = JSON.parse((await Storage.getItem(KEY)) ?? "{}") as {
    host?: string;
    token?: string | null;
  };

  servers.set(JSON.parse((await Storage.getItem(SERVERS)) ?? "[]") as Server[]);
  host.set(saved.host ?? "");
  token.set(saved.token ?? null);
  appName.set(servers().find((s) => s.host === saved.host)?.appName ?? "Fileee");

  if (!saved.host || !saved.token) return false;

  user.set(await call<User | null>("auth/me"));

  if (user()) remember();
  else await forget();

  return user() !== null;
}

/**
 * Makes a saved server the one in use; resolves with whether its session still works. A server
 * that can't answer rejects and leaves the current one in use.
 */
export async function useServer(server: Server) {
  const me = await call<User | null>("auth/me", undefined, server.host, server.token);

  host.set(server.host);
  token.set(server.token);
  appName.set(server.appName);
  user.set(me);
  await save();

  if (me) remember();
  else await forget();

  return me !== null;
}

export interface SetupStatus {
  complete: boolean;
  appName: string;
  setupTokenRequired: boolean;
}

/** Remembers the server; its status says whether it still needs setting up. */
export async function connect(address: string) {
  const at = normalizeHost(address);
  const status = await call<SetupStatus>("setup/status", undefined, at);

  if (typeof status?.complete !== "boolean") {
    throw new ApiError("HTTP", `${at} doesn't look like a Fileee server.`);
  }

  host.set(at);
  token.set(null);
  user.set(null);
  appName.set(status.appName);
  await save();

  return status;
}

/** Sets up a new server, as its web setup page does, and signs its first admin in. */
export async function completeSetup(input: {
  appName: string;
  name: string;
  email: string;
  password: string;
  setupToken: string;
}) {
  const { token: issued } = await call<{ token: string }>("setup/complete", input);

  token.set(issued);
  appName.set(input.appName);
  user.set(await call<User>("auth/me"));
  await save();
  remember();
}

export async function signIn(email: string, password: string) {
  const signedIn = await call<User & { token: string }>("auth/login", { email, password });
  const { token: issued, ...rest } = signedIn;

  token.set(issued);
  user.set(rest);
  await save();
  remember();
}

/** Drops this server's session: it leaves the list of servers too. */
async function forget() {
  dropServer(host());
  token.set(null);
  user.set(null);
  await save();
}

export async function signOut() {
  await call("auth/logout").catch(() => {});
  await forget();
}

/** Forgets the server too, to connect to another. */
export async function changeServer() {
  await signOut();
  host.set("");
  await save();
}
