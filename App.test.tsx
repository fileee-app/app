import { expect, open, test } from "nsh/test";

const HOST = "https://files.example.com";
const ok = (json: unknown) => ({ body: { json } });

const USER = { id: "u1", name: "Ada Lovelace", email: "ada@example.com", role: "admin", disabledAt: null, createdAt: "2026-01-01T00:00:00.000Z" };
const STORAGE = { id: "s1", name: "Photos", provider: "s3", bucket: "ada-photos", status: "ok" };

const signedIn = {
  [`POST ${HOST}/api/app/upload/listPending`]: ok([]),
  [`POST ${HOST}/api/app/storage/syncStatus`]: ok({ run: null, missing: 0 }),
  [`POST ${HOST}/api/app/storage/list`]: ok([STORAGE]),
  [`POST ${HOST}/api/app/file/recent`]: ok([]),
  [`POST ${HOST}/api/app/file/starred`]: ok([]),
};

test("connects, signs in with a bearer token and shows the dashboard", async () => {
  const app = await open("./App.tsx", {
    network: {
      [`POST ${HOST}/api/app/setup/status`]: ok({ complete: true, appName: "Acme Files" }),
      [`POST ${HOST}/api/app/auth/login`]: ok({ ...USER, token: "t0ken" }),
      ...signedIn,
    },
  });

  await app.type("label:Server address", "files.example.com/");
  await app.press("Continue");
  await app.waitFor("text:Sign in to Acme Files");

  await app.type("label:Email", "ada@example.com");
  await app.type("label:Password", "correct horse battery");
  await app.press("text:Sign in");
  await app.waitFor("text:Recent files");

  expect(app.texts()).toContain("Photos");
  expect(JSON.parse(app.storage().session!)).toEqual({ host: HOST, token: "t0ken" });
  expect(JSON.parse(app.storage().servers!)).toEqual([{ host: HOST, token: "t0ken", appName: "Acme Files", name: "Ada Lovelace", email: "ada@example.com" }]);

  const list = app.requests().find((r) => r.url.endsWith("/storage/list"))!;

  expect(list.headers.authorization).toBe("Bearer t0ken");
});

test("an expired token goes back to the login screen", async () => {
  const app = await open("./App.tsx", {
    storage: { session: JSON.stringify({ host: HOST, token: "old" }) },
    network: { [`POST ${HOST}/api/app/auth/me`]: ok(null) },
  });

  await app.waitFor("text:Sign in to Fileee");
});

test("a new server is set up from the app", async () => {
  const app = await open("./App.tsx", {
    network: {
      [`POST ${HOST}/api/app/setup/status`]: ok({ complete: false, appName: "Fileee", setupTokenRequired: true }),
      [`POST ${HOST}/api/app/setup/complete`]: ok({ ok: true, token: "first" }),
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      [`POST ${HOST}/api/app/storage/list`]: ok([]),
      [`POST ${HOST}/api/app/file/recent`]: ok([]),
      [`POST ${HOST}/api/app/file/starred`]: ok([]),
      [`POST ${HOST}/api/app/upload/listPending`]: ok([]),
    },
  });

  await app.type("label:Server address", HOST);
  await app.press("Continue");
  await app.waitFor("text:Set up Fileee");
  await app.type("label:Your name", "Ada Lovelace");
  await app.type("label:Email", "ada@example.com");
  await app.type("label:Password", "correct horse battery");
  await app.type("label:Setup token", "s3cret");
  await app.press("text:Create admin account");
  await app.waitFor("text:Connect your first storage");

  const body = JSON.parse(app.requests().find((r) => r.url.endsWith("/setup/complete"))!.body!).json;

  expect(body).toEqual({ appName: "", name: "Ada Lovelace", email: "ada@example.com", password: "correct horse battery", setupToken: "s3cret" });
  expect(JSON.parse(app.storage().session!).token).toBe("first");
});

test("browses a storage and uploads a picked photo in parts", async () => {
  const ROOT = { id: "root", storageId: "s1", parentId: null, name: "", trashedAt: null };
  const app = await open("./App.tsx", {
    platform: "macos",
    width: 1200,
    height: 800,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${HOST}/api/app/folder/get`]: ok({ folder: ROOT, path: [], children: [{ ...ROOT, id: "f1", parentId: "root", name: "Trips" }] }),
      [`POST ${HOST}/api/app/file/list`]: ok({ items: [] }),
      [`POST ${HOST}/api/app/upload/start`]: ok({ fileId: "new", kind: "multipart", partSize: 4 }),
      [`POST ${HOST}/api/app/upload/signParts`]: (r) => ok([{ partNumber: JSON.parse(r.body!).json.partNumbers[0], url: "https://bucket.example.com/part" }]),
      "PUT https://bucket.example.com/part": { status: 200 },
      [`POST ${HOST}/api/app/upload/complete`]: ok({}),
    },
  });

  await app.waitFor("text:Welcome back, Ada");
  await app.press("text:Photos >> nth=0"); // the sidebar's storage
  await app.waitFor("text:Trips");

  app.onPick(() => [{ name: "beach.jpg", type: "image/jpeg", data: new Uint8Array(10) }]);
  await app.press("label:Upload");
  await app.press("label:Photos & videos");
  await app.waitFor("text:Uploads finished");

  const puts = app.requests().filter((r) => r.method === "PUT");

  expect(puts.length).toBe(3); // 4 + 4 + 2 bytes
  expect(JSON.parse(app.requests().find((r) => r.url.endsWith("/upload/start"))!.body!).json).toEqual({
    storageId: "s1",
    folderId: "root",
    name: "beach.jpg",
    size: 10,
    mimeType: "image/jpeg",
  });
});

test("every screen opens", async () => {
  const FILE = { id: "x1", name: "notes.txt", size: 12, mimeType: "text/plain", modifiedAt: USER.createdAt, createdAt: USER.createdAt, starred: false, storageId: "s1", folderId: "root", status: "ready", uploaderName: "Ada", previewKind: "text", metadata: { lines: 3 }, storageName: "Photos", thumbnailUrl: null };
  const app = await open("./App.tsx", {
    platform: "macos",
    width: 1200,
    height: 800,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      [`POST ${HOST}/api/app/upload/listPending`]: ok([]),
      [`POST ${HOST}/api/app/share/removalFailures`]: ok([]),
      [`POST ${HOST}/api/app/storage/list`]: ok([STORAGE]),
      [`POST ${HOST}/api/app/file/recent`]: ok([FILE]),
      [`POST ${HOST}/api/app/file/starred`]: ok([]),
      [`POST ${HOST}/api/app/file/get`]: ok(FILE),
      [`POST ${HOST}/api/app/file/previewUrl`]: ok({ kind: "text", url: "https://bucket.example.com/notes.txt" }),
      "GET https://bucket.example.com/notes.txt": { body: "hello, world" },
      [`POST ${HOST}/api/app/share/list`]: ok([{ id: "l1", url: `${HOST}/share/abc`, hasPassword: false, expiresAt: null, revokedAt: null, downloadCount: 2, createdAt: USER.createdAt }]),
      [`POST ${HOST}/api/app/share/publicStatus`]: ok({ available: false, blockedBy: null, copy: null }),
      [`POST ${HOST}/api/app/search/query`]: ok({ items: [FILE] }),
      [`POST ${HOST}/api/app/trash/list`]: ok({ files: [], folders: [] }),
      [`POST ${HOST}/api/app/storage/syncStatus`]: ok({ run: null, missing: 0 }),
      [`POST ${HOST}/api/app/user/list`]: ok([USER]),
      [`POST ${HOST}/api/app/setup/status`]: ok({ complete: true, appName: "Acme" }),
    },
  });

  await app.waitFor("text:notes.txt");
  await app.press("text:notes.txt");
  await app.waitFor("text:hello, world");
  await app.press("text:Share");
  await app.waitUntil(() => app.texts().some((t) => t.includes("2 downloads")));

  await app.press("text:Search");
  await app.type("id:search", "notes");
  await app.waitFor("text:notes.txt");

  await app.press("text:Trash >> nth=0");
  await app.waitFor("text:Trash is empty");

  await app.press("text:Settings >> nth=0");
  await app.press("text:Storages >> nth=1");
  await app.press("text:Photos >> nth=1");
  await app.waitFor("text:Not synced yet.");
  await app.back();
  await app.back();
  await app.press("text:Users");
  await app.waitFor("text:Ada Lovelace (you)");
  await app.back();
  await app.press("text:General");
  await app.waitFor("text:App name");
  await app.back();
  await app.press("text:Account");
  await app.waitFor("text:Change password");
});

test("selects with clicks and the keyboard, and trashes the selection", async () => {
  const ROOT = { id: "root", storageId: "s1", parentId: null, name: "", trashedAt: null };
  const file = (id: string, name: string) => ({ id, name, size: 5, mimeType: "text/plain", modifiedAt: USER.createdAt, starred: false, storageId: "s1", folderId: "root", status: "ready", thumbnailUrl: null });
  const app = await open("./App.tsx", {
    platform: "macos",
    width: 1200,
    height: 800,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${HOST}/api/app/folder/get`]: ok({ folder: ROOT, path: [], children: [] }),
      [`POST ${HOST}/api/app/file/list`]: ok({ items: [file("a", "a.txt"), file("b", "b.txt"), file("c", "c.txt")] }),
      [`POST ${HOST}/api/app/file/trash`]: ok({ ok: true }),
    },
  });

  await app.waitFor("text:Welcome back, Ada");
  await app.press("text:Photos >> nth=0");
  await app.waitFor("text:a.txt");
  await app.press("label:Select a.txt");
  await app.press("label:Select c.txt");
  await app.waitFor("text:2 selected");
  await app.keyboard.press("backspace");
  await app.waitUntil(() => app.requests().filter((r) => r.url.endsWith("/file/trash")).length === 2);

  const trashed = app.requests().filter((r) => r.url.endsWith("/file/trash")).map((r) => JSON.parse(r.body!).json.fileId);

  expect(trashed).toEqual(["a", "c"]);

  // The view switch rebuilds the items as tiles, which have no checkboxes.
  await app.keyboard.press("escape");
  await app.press("label:Show as grid");
  await app.waitFor("label:Select a.txt", { state: "gone" });
  expect(app.shows("label:b.txt")).toBe(true);
  await app.press("label:Show as list");
  await app.waitFor("label:Select a.txt");
});

test("uploads a dropped folder and makes previews on this device", async () => {
  const ROOT = { id: "root", storageId: "s1", parentId: null, name: "", trashedAt: null };
  const ids: Record<string, string> = { "beach.png": "img", "notes.txt": "txt" };
  const app = await open("./App.tsx", {
    platform: "macos",
    width: 1200,
    height: 800,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${HOST}/api/app/folder/get`]: ok({ folder: ROOT, path: [], children: [] }),
      [`POST ${HOST}/api/app/file/list`]: ok({ items: [] }),
      [`POST ${HOST}/api/app/folder/ensurePath`]: ok({ folderId: "trip" }),
      [`POST ${HOST}/api/app/upload/start`]: (r) => {
        const { name } = JSON.parse(r.body!).json;

        return ok({ fileId: ids[name], kind: "single", url: `https://bucket.example.com/${ids[name]}` });
      },
      "PUT https://bucket.example.com/*": { status: 200 },
      [`POST ${HOST}/api/app/upload/complete`]: ok({}),
      [`POST ${HOST}/api/app/file/signThumbnail`]: (r) =>
        JSON.parse(r.body!).json.fileId === "img"
          ? ok({ kind: "image", size: 1949, url: "https://bucket.example.com/thumb" })
          : ok({ kind: "text", size: 16, url: null }),
      [`POST ${HOST}/api/app/file/saveExtracted`]: ok({ ok: true }),
    },
  });

  await app.waitFor("text:Welcome back, Ada");
  await app.press("text:Photos >> nth=0");
  await app.waitFor("text:This folder is empty");
  await app.dropFiles("text:This folder is empty", [new URL("./test-fixtures/Trip", import.meta.url).href]);
  await app.waitFor("text:Uploads finished");

  const body = (path: string) => app.requests().filter((r) => r.url.endsWith(path)).map((r) => JSON.parse(r.body!).json);

  expect(body("/folder/ensurePath")).toEqual([{ storageId: "s1", parentId: "root", segments: ["Trip"] }]);
  expect(body("/upload/start").map((s) => [s.name, s.folderId])).toEqual([["beach.png", "trip"], ["notes.txt", "trip"]]);

  const saved = Object.fromEntries(body("/saveExtracted").map((s) => [s.fileId, s]));

  expect(saved.img.metadata).toEqual({ width: 640, height: 480 });
  expect(saved.img.thumbnail).toBe(true);
  expect(saved.img.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(saved.txt.metadata).toEqual({ lines: 3, encoding: "utf-8" });

  // With the upload sheet up, the window still takes drops, and the sheet goes.
  await app.press("label:Upload");
  await app.waitFor("text:Photos & videos");
  await app.dropFiles("text:Photos & videos", [new URL("./test-fixtures/Trip/notes.txt", import.meta.url).href]);
  await app.waitFor("text:Photos & videos", { state: "gone" });
  await app.waitUntil(() => body("/upload/start").length === 3);
  expect(body("/upload/start")[2]).toMatchObject({ name: "notes.txt", folderId: "root" });
});

test("a click shows the item's details beside the folder on wide windows", async () => {
  const ROOT = { id: "root", storageId: "s1", parentId: null, name: "", trashedAt: null };
  const file = (id: string, name: string) => ({ id, name, size: 5, mimeType: "text/plain", modifiedAt: USER.createdAt, createdAt: USER.createdAt, starred: false, storageId: "s1", folderId: "root", status: "ready", thumbnailUrl: null, uploaderName: "Ada", previewKind: "text", metadata: { lines: 2 } });
  const app = await open("./App.tsx", {
    platform: "macos",
    width: 1300,
    height: 800,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${HOST}/api/app/folder/get`]: ok({ folder: ROOT, path: [], children: [{ ...ROOT, id: "f1", parentId: "root", name: "Trips" }] }),
      [`POST ${HOST}/api/app/file/list`]: ok({ items: [file("a", "a.txt"), file("b", "b.txt"), file("c", "c.pdf")] }),
      [`POST ${HOST}/api/app/file/get`]: (r) => {
        const { fileId } = JSON.parse(r.body!).json;

        if (fileId === "c") return ok({ ...file("c", "c.pdf"), previewKind: "pdf", thumbnailUrl: "https://bucket.example.com/c-thumb" });

        return ok({ ...file(fileId, `${fileId}.txt`), uploaderName: fileId === "a" ? "Ada" : "Grace" });
      },
      [`POST ${HOST}/api/app/file/previewUrl`]: (r) =>
        JSON.parse(r.body!).json.fileId === "c"
          ? ok({ kind: "pdf", url: "https://bucket.example.com/c" })
          : ok({ kind: "text", url: "https://bucket.example.com/t" }),
      "GET https://bucket.example.com/t": { body: "hello" },
    },
  });

  await app.waitFor("text:Welcome back, Ada");
  await app.press("label:Photos >> nth=0"); // the sidebar's
  await app.press("label:a.txt");
  // The panel waits a moment, so a double click opens the file without it showing first.
  expect(app.shows("label:Close details")).toBe(false);
  await app.waitFor("text:Uploaded by");
  expect(app.texts()).toContain("Ada");
  await app.press("label:b.txt");
  await app.waitFor("text:Grace");
  // A PDF shows its first page in the panel; the file page has the viewer.
  await app.press("label:c.pdf");
  await app.waitFor("label:Open PDF");
  await app.press("label:Open PDF");
  await app.waitFor("label:Open PDF", { state: "gone" });
  await app.back();
  await app.press("label:Trips");
  await app.waitFor("text:Open");
  await app.press("label:Close details");
  await app.waitFor("text:Details", { state: "gone" });
});

test("search filters narrow the results", async () => {
  const app = await open("./App.tsx", {
    platform: "macos",
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${HOST}/api/app/search/query`]: ok({ items: [] }),
    },
  });

  await app.waitFor("text:Welcome back, Ada");
  await app.press("label:Search");
  await app.press("label:Type");
  await app.press("text:Images");
  await app.press("label:Size");
  await app.press("text:Under 1 MB");
  await app.waitUntil(() => app.requests().some((r) => r.url.endsWith("/search/query")));

  const query = app.requests().filter((r) => r.url.endsWith("/search/query")).map((r) => JSON.parse(r.body!).json).at(-1);

  expect(query).toMatchObject({ type: "image", maxSize: 1000 * 1000 });
});

test("a file's actions drop down on desktops and come up in a sheet on phones", async () => {
  const REPORT = { id: "r1", name: "report.txt", size: 5, mimeType: "text/plain", modifiedAt: USER.createdAt, starred: false, storageId: "s1", folderId: "root", status: "ready", thumbnailUrl: null, storageName: "Photos" };
  const network = {
    [`POST ${HOST}/api/app/auth/me`]: ok(USER),
    ...signedIn,
    [`POST ${HOST}/api/app/file/recent`]: ok([REPORT]),
    [`POST ${HOST}/api/app/file/star`]: ok({ ok: true }),
  };
  const storage = { session: JSON.stringify({ host: HOST, token: "t0ken" }) };

  const desktop = await open("./App.tsx", { platform: "macos", width: 1200, height: 900, storage, network });

  await desktop.waitFor("text:report.txt");
  await desktop.press("label:Actions for report.txt");
  expect(desktop.menu()!.map((e) => e.label)).toEqual(["Open", "Download", "Share", "Star", "Rename", "Move", "Move to trash"]);
  await desktop.chooseMenuItem("Star");
  await desktop.waitUntil(() => desktop.requests().some((r) => r.url.endsWith("/file/star")));

  const phone = await open("./App.tsx", { platform: "ios", width: 390, height: 1000, storage, network });

  await phone.waitFor("text:report.txt");
  await phone.press("label:Actions for report.txt");
  await phone.waitFor("text:Cancel");
  await phone.press("label:Star");
  await phone.waitFor("text:Cancel", { state: "gone" });
  await phone.waitUntil(() => phone.requests().some((r) => r.url.endsWith("/file/star")));
});

test("the phone menu lists the servers signed in to and switches between them", async () => {
  const WORK = "https://files.work.example";
  const GRACE = { ...USER, id: "u2", name: "Grace Hopper", email: "grace@work.example" };
  const servers = [
    { host: HOST, token: "t0ken", appName: "Acme Files", name: USER.name, email: USER.email },
    { host: WORK, token: "w0rk", appName: "Work Drive", name: GRACE.name, email: GRACE.email },
  ];
  const app = await open("./App.tsx", {
    platform: "ios",
    width: 390,
    height: 900,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }), servers: JSON.stringify(servers) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${WORK}/api/app/auth/me`]: ok(GRACE),
      [`POST ${WORK}/api/app/upload/listPending`]: ok([]),
      [`POST ${WORK}/api/app/storage/list`]: ok([{ ...STORAGE, id: "w1", name: "Team" }]),
      [`POST ${WORK}/api/app/file/recent`]: ok([]),
      [`POST ${WORK}/api/app/file/starred`]: ok([]),
      [`POST ${WORK}/api/app/auth/logout`]: ok({ ok: true }),
      [`POST ${WORK}/api/app/storage/syncStatus`]: ok({ run: null, missing: 0 }),
      [`POST ${WORK}/api/app/folder/get`]: ok({ folder: { id: "wroot", storageId: "w1", parentId: null, name: "", trashedAt: null }, path: [], children: [{ id: "q3", storageId: "w1", parentId: "wroot", name: "Q3 reports", trashedAt: null }] }),
      [`POST ${WORK}/api/app/file/list`]: ok({ items: [] }),
      [`POST ${HOST}/api/app/setup/status`]: ok({ complete: true, appName: "Acme Files" }),
    },
  });

  await app.waitFor("text:Photos");
  await app.press("label:Servers and account");
  await app.waitFor("text:Work Drive");
  expect(app.texts()).toContain("grace@work.example · files.work.example");

  // Switch: the other server's dashboard, with its own token.
  await app.press("label:Work Drive, grace@work.example");
  await app.waitFor("text:Team");
  expect(app.texts()).toContain("Team");
  expect(app.requests().find((r) => r.url === `${WORK}/api/app/storage/list`)!.headers.authorization).toBe("Bearer w0rk");
  expect(JSON.parse(app.storage().session!)).toEqual({ host: WORK, token: "w0rk" });

  // The menu lists the storages: one opens from it.
  await app.press("label:Servers and account");
  await app.waitFor("text:Connect storage");
  await app.press("id:menu-storage-w1");
  await app.waitFor("text:Q3 reports");
  await app.back();
  await app.waitFor("text:Q3 reports", { state: "gone" });

  // Adding a server can be called off, back to the one in use.
  await app.press("label:Servers and account");
  await app.press("label:Add server");
  await app.waitFor("text:Connect to Fileee");
  await app.press("text:Back to Work Drive");
  await app.waitFor("text:Team");

  // Signing out of one moves on to the other, still signed in.
  await app.press("label:Servers and account");
  await app.press("label:Sign out");
  await app.waitFor("text:Photos");
  expect(JSON.parse(app.storage().servers!).map((s: { host: string }) => s.host)).toEqual([HOST]);
});

test("the storage form picks a provider from a dropdown, which fills in its endpoint", async () => {
  const app = await open("./App.tsx", {
    platform: "ios",
    width: 390,
    height: 900,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: { [`POST ${HOST}/api/app/auth/me`]: ok(USER), ...signedIn },
  });

  await app.waitFor("text:Recent files");
  await app.press("label:Connect");
  await app.waitFor("text:Connect storage");
  expect(app.value("label:Region")).toBe("us-east-1");

  await app.press("label:Provider");
  await app.press("text:Cloudflare R2");
  await app.waitFor("text:Cloudflare R2");
  expect(app.value("label:Endpoint")).toBe("https://<account>.r2.cloudflarestorage.com");
  expect(app.value("label:Region")).toBe("auto");
});

test("a file's page on phones has its summary, four action tiles and the rest under More", async () => {
  const REPORT = { id: "r1", name: "report.pdf", size: 27000, mimeType: "application/pdf", modifiedAt: "2025-03-04T10:00:00.000Z", createdAt: "2025-03-04T10:00:00.000Z", starred: false, storageId: "s1", folderId: "root", status: "ready", thumbnailUrl: null, storageName: "Photos", uploaderName: "Ada", previewKind: "none", metadata: null };
  const app = await open("./App.tsx", {
    platform: "ios",
    width: 390,
    height: 900,
    storage: { session: JSON.stringify({ host: HOST, token: "t0ken" }) },
    network: {
      [`POST ${HOST}/api/app/auth/me`]: ok(USER),
      ...signedIn,
      [`POST ${HOST}/api/app/file/recent`]: ok([REPORT]),
      [`POST ${HOST}/api/app/file/get`]: ok(REPORT),
      [`POST ${HOST}/api/app/file/previewUrl`]: ok({ kind: "none", url: null }),
    },
  });

  await app.waitFor("text:report.pdf");
  await app.press("label:report.pdf");
  await app.waitFor("text:PDF · 26.4 KB · Mar 4, 2025");
  expect(app.shows("label:Download")).toBe(true);
  expect(app.shows("label:Star")).toBe(true);

  await app.press("label:More");
  await app.waitFor("label:Rename");
  expect(app.shows("label:Move")).toBe(true);
  expect(app.shows("label:Move to trash")).toBe(true);
});
