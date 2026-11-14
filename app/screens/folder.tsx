import type { Point, PressEvent } from "nsh";
import { cleanup, computed, effect, keymap, List, platform, resource, signal, Storage, Text, untracked, View, windowSize } from "nsh";
import { DetailsPanel } from "../components/details-panel";
import { Icon } from "../components/icon";
import { divider, ItemRow } from "../components/item-row";
import { ItemTile } from "../components/item-tile";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { prompt } from "../components/prompt";
import { Action, Button, Empty } from "../components/ui";
import { openUpload } from "../components/upload-sheet";
import {
  type Item,
  itemChoices,
  itemKey,
  move,
  openItem,
  rename,
  selectionChoices,
  showChoices,
  star,
  trash,
} from "../lib/actions";
import { call, changes } from "../lib/api";
import { formatDate, formatShortDate } from "../lib/format";
import { load } from "../lib/load";
import { nav, tabBarHeight } from "../lib/nav";
import { run } from "../lib/run";
import type { FileItem, Folder, Page as Paged } from "../lib/types";
import { uploadDropped } from "../lib/uploads";

interface SyncStatus {
  run: { status: string; listed: number; added: number; updated: number; finishedAt: string | null; error: string | null } | null;
  missing: number;
}

/** List or grid, kept across launches like the web app's view switch. */
const view = signal<"list" | "grid">("list");

void Storage.getItem("view").then((saved) => saved === "grid" && view.set("grid"));

const setView = (next: "list" | "grid") => {
  view.set(next);
  void Storage.setItem("view", next);
};

/** The web app's sync line: when the bucket was last listed, and what changed. */
function SyncLine(props: { storageId: string }) {
  const { storageId } = props;
  const status = load<SyncStatus>("storage/syncStatus", () => ({ storageId }));

  // Follows a running sync, as the web app polls it.
  effect(() => {
    const state = status()?.run?.status;

    if (state === "running" || state === "queued") {
      const timer = setTimeout(() => status.refetch(), 2000);

      cleanup(() => clearTimeout(timer));
    }
  });

  const text = () => {
    const r = status()?.run;

    if (!r) return "Not synced yet.";
    if (r.status === "queued") return "Waiting to sync…";
    if (r.status === "running") return `Syncing… ${r.listed.toLocaleString()} objects so far.`;
    if (r.status === "failed") return `Last sync failed, so nothing was marked missing: ${r.error}`;

    // Phones: the gist, so it fits one line beside "Sync now".
    if (!platform.desktop) return `Synced ${formatShortDate(r.finishedAt)} · ${r.listed.toLocaleString()} objects`;

    return `Synced ${formatDate(r.finishedAt)}: ${r.listed.toLocaleString()} objects, ${r.added.toLocaleString()} added, ${r.updated.toLocaleString()} updated.`;
  };

  return (
    <View class="flex-row flex-wrap items-center gap-x-2 border-b border-border px-4 py-2">
      <Text class={`text-xs ${status()?.run?.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{text()}</Text>
      <If when={(status()?.missing ?? 0) > 0}>
        <Text role="button" onPress={() => nav.push({ name: "missing", storageId })} class="text-xs text-destructive underline">
          {`${status()!.missing} missing`}
        </Text>
      </If>
      <Text role="button" onPress={() => run(() => call("storage/sync", { storageId }))} class="text-xs text-primary active:opacity-60">
        Sync now
      </Text>
    </View>
  );
}

/** A folder of a storage: its subfolders, then its files, 50 at a time. */
export function FolderPage(props: { storageId: string; folderId?: string; title: string }) {
  const { storageId, folderId } = props;
  const folder = load<{ folder: Folder; path: Folder[]; children: Folder[] }>("folder/get", () => ({ storageId, folderId }));
  const files = signal<FileItem[]>([]);
  const cursor = signal<string | undefined>(undefined);
  const listError = signal<string | null>(null);
  const selected = signal<string[]>([]);
  const anchor = signal<string | null>(null);
  const dropping = signal(false);

  // The first page loads with the folder and again after every change; later pages append.
  const first = resource(
    () => (folder() ? { n: changes(), id: folder()!.folder.id } : null),
    async (s) => {
      try {
        listError.set(null);

        return await call<Paged<FileItem>>("file/list", { storageId, folderId: s.id });
      } catch (error) {
        listError.set((error as Error).message);

        return { items: [] };
      }
    },
  );

  effect(() => {
    const page = first();

    if (page) {
      files.set(page.items);
      cursor.set(page.nextCursor);
    }
  });

  const items = computed<Item[]>(() => [
    ...(folder()?.children ?? []).map((f) => ({ kind: "folder" as const, folder: f })),
    ...files().map((f) => ({ kind: "file" as const, file: f })),
  ]);

  // A reload keeps what is still there selected.
  effect(() => {
    const keys = new Set(items().map(itemKey));

    selected.update((s) => (s.some((k) => !keys.has(k)) ? s.filter((k) => keys.has(k)) : s));
  });

  const chosen = () => items().filter((i) => selected().includes(itemKey(i)));
  // Wide desktop windows show the one selected item beside the folder, while this page is on top.
  const depth = nav.routes().length;
  const picked = () =>
    platform.desktop && windowSize().width >= 1000 && nav.routes().length === depth && chosen().length === 1 ? chosen()[0] : undefined;
  // A moment after the click, so a double click opens the item without the panel showing first, and
  // clicking through items shows only the last. The item it already shows updates at once.
  const focused = signal<Item | undefined>(undefined);

  effect(() => {
    const item = picked();
    const shown = untracked(focused);

    if (!item || (shown && itemKey(shown) === itemKey(item))) return focused.set(item);

    const timer = setTimeout(() => focused.set(item), 300);

    cleanup(() => clearTimeout(timer));
  });
  // The grid's width from what is beside it, not its onLayout: a layout event alone doesn't redraw the
  // app, so the columns would only catch up on the next press. The sidebar takes 248pt (w-60, m-2) and
  // the details panel 348pt (w-[340px], m-2 ml-0).
  const gridWidth = () => windowSize().width - (platform.desktop ? 248 : 0) - (focused() ? 348 : 0);
  // As many columns of at least 144pt (w-36) as fit, with gap-2 between them and p-3 around.
  const columns = () => Math.max(1, Math.floor((gridWidth() - 24 + 8) / ((platform.desktop ? 144 : 104) + 8)));
  const isSelected = (item: Item) => selected().includes(itemKey(item));
  const clear = () => selected.set([]);

  const toggle = (item: Item) => {
    const key = itemKey(item);

    selected.update((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
    anchor.set(key);
  };

  /** Desktops select as file managers do; phones open, or toggle while selecting. */
  const press = (item: Item, e: PressEvent) => {
    const key = itemKey(item);

    if (!platform.desktop) return selected().length ? toggle(item) : openItem(item, props.title);
    if (e.clickCount >= 2) return openItem(item, props.title);
    if (e.modifiers.platform || e.modifiers.control) return toggle(item);

    if (e.modifiers.shift && anchor()) {
      const keys = items().map(itemKey);
      const [a, b] = [keys.indexOf(anchor()!), keys.indexOf(key)].sort((x, y) => x - y);

      return selected.set(keys.slice(a, b + 1));
    }

    selected.set([key]);
    anchor.set(key);
  };

  /** A right click on a selected item acts on the whole selection, as in a file manager. */
  const menu = (item: Item, at?: Point) =>
    isSelected(item) && selected().length > 1
      ? showChoices(`${selected().length} items`, selectionChoices(chosen(), props.title), at)
      : showChoices(item.kind === "file" ? item.file.name : item.folder.name, itemChoices(item, props.title), at);

  const more = () =>
    run(async () => {
      const page = await call<Paged<FileItem>>("file/list", { storageId, folderId: folder()!.folder.id, cursor: cursor() });

      files.update((list) => [...list, ...page.items]);
      cursor.set(page.nextCursor);
    });

  const target = () => ({ storageId, folderId: folder()!.folder.id });

  const newFolder = async () => {
    const name = await prompt({ title: "New folder", label: "Name", value: "", confirm: "Create" });

    if (name !== null) await run(() => call("folder/create", { storageId, parentId: folder()!.folder.id, name }));
  };

  const folderMenu = (at?: Point) => {
    const current = folder()?.folder;

    if (!current) return;

    return showChoices(
      title(),
      [
        { label: "New folder", run: newFolder, shortcut: "mod+shift+n", icon: "folder-plus" },
        { label: "Upload…", run: () => openUpload(target(), title()), icon: "upload" },
        { label: view() === "list" ? "Show as grid" : "Show as list", run: () => setView(view() === "list" ? "grid" : "list"), icon: view() === "list" ? "layout-grid" : "list" },
        { label: "Sync now", run: () => run(() => call("storage/sync", { storageId })), icon: "refresh-cw" },
        { label: "Missing files", run: () => nav.push({ name: "missing", storageId }), icon: "circle-alert" },
        ...(current.parentId
          ? [
              { label: "Share this folder", run: () => nav.push({ name: "share" as const, folderId: current.id, title: current.name }), icon: "share-2" as const },
              { label: "Rename this folder", run: () => rename({ kind: "folder", folder: current }), icon: "pencil" as const },
              { label: "Move this folder", run: () => move([{ kind: "folder", folder: current }]), icon: "folder-input" as const },
            ]
          : []),
      ],
      at,
    );
  };

  // The web app's keyboard shortcuts, only while this page is on top and never while typing in a field.
  const one = () => (chosen().length === 1 ? chosen()[0] : undefined);

  effect(() => {
    if (!platform.desktop || nav.routes().length !== depth) return;

    const unbind = keymap.bind(
      {
        "mod+a": () => {
          selected.set(items().map(itemKey));
        },
        escape: clear,
        enter: () => one() && openItem(one()!, props.title),
        f2: () => one() && rename(one()!),
        m: () => chosen().length && move(chosen()),
        s: () => {
          const picked = chosen().flatMap((i) => (i.kind === "file" ? [i.file] : []));

          if (picked.length) void star(picked, !picked.every((f) => f.starred));
        },
        backspace: () => chosen().length && trash(chosen()),
        delete: () => chosen().length && trash(chosen()),
        "mod+u": () => folder() && openUpload(target(), title()),
        "mod+shift+n": () => folder() && newFolder(),
      },
      { when: "notEditing" },
    );

    cleanup(unbind);
  });

  const loadMore = () => (
    <If when={cursor()}>
      <Button title="Load more" variant="ghost" class="m-4 w-full" onPress={more} />
    </If>
  );

  const title = () => folder()?.path.at(-1)?.name ?? props.title;

  const actions = () => (
    <If
      when={selected().length > 0}
      else={
        <View class="flex-row items-center">
          {/* Phones upload from the floating button, and make folders from the "…" menu. */}
          <If when={platform.desktop}>
            <Action title="Upload" icon="upload" onPress={() => folder() && openUpload(target(), title())} />
            <Action title="New folder" icon="folder-plus" onPress={newFolder} />
          </If>
          <Action
            title={view() === "list" ? "Show as grid" : "Show as list"}
            icon={view() === "list" ? "layout-grid" : "list"}
            onPress={() => setView(view() === "list" ? "grid" : "list")}
          />
          <Action title="More" icon="ellipsis" label="Folder actions" onPress={() => folderMenu()} />
        </View>
      }
    >
      <View class="flex-row items-center">
        <Text class="px-2.5 text-[13px] font-medium text-muted-foreground">{`${selected().length} selected`}</Text>
        <Each of={selectionChoices(chosen(), props.title).filter((c) => c.label !== "Open")} key={(c) => c.label}>
          {(c) => <Action title={c().label} icon={c().icon} destructive={c().destructive} onPress={() => void c().run()} />}
        </Each>
        <Action title="Clear selection" icon="x" onPress={clear} />
      </View>
    </If>
  );

  return (
    <Page title={title()} actions={actions}>
      <View class="flex-1 flex-row">
        <Loaded of={folder}>
          {(f) => (
            <View
              class={`flex-1 ${dropping() ? "bg-accent" : ""}`}
              onFileDragEnter={() => dropping.set(true)}
              onFileDragLeave={() => dropping.set(false)}
              onFileDrop={(e) => {
                dropping.set(false);
                void run(async () => uploadDropped(e.uris, target()));
              }}
            >
              <If when={f().path.length > 0}>
                <Text class="truncate px-4 pt-2 text-xs text-muted-foreground">{[props.title, ...f().path.map((p) => p.name)].join(" / ")}</Text>
              </If>
              <SyncLine storageId={storageId} />
              <If when={listError()}>
                <Text class="px-4 py-2 text-sm text-destructive">{listError()}</Text>
              </If>
              <If
                when={items().length > 0}
                else={
                  <Empty
                    title="This folder is empty"
                    detail={platform.desktop ? "Drop files or folders here, or upload them." : "Upload photos and videos, or add files from a computer."}
                  >
                    <View class="flex-row gap-2">
                      <Button title="Upload" onPress={() => openUpload(target(), title())} />
                      <Button title="New folder" variant="secondary" onPress={newFolder} />
                    </View>
                  </Empty>
                }
              >
                {/* Only the rows near the viewport exist, so resizing lays out a screenful, not the whole folder.
                    One list per view: a cell can't switch between a row and a tile. */}
                <If
                  when={view() === "grid"}
                  else={
                    <List
                      each={items()}
                      keyExtractor={itemKey}
                      estimatedItemSize={platform.desktop ? 52 : 62}
                      separator={divider}
                      class="flex-1"
                      contentClass={platform.desktop ? "py-1" : "pb-28 pt-1"}
                      footer={loadMore}
                    >
                      {(item) => (
                        <ItemRow
                          item={item()}
                          selected={isSelected(item())}
                          onPress={(e) => press(item(), e)}
                          onLongPress={() => toggle(item())}
                          onToggle={platform.desktop || selected().length > 0 ? () => toggle(item()) : undefined}
                          onMenu={(at) => menu(item(), at)}
                        />
                      )}
                    </List>
                  }
                >
                  <List
                    each={items()}
                    keyExtractor={itemKey}
                    numColumns={columns()}
                    estimatedItemSize={148}
                    class="flex-1"
                    contentClass={platform.desktop ? "gap-2 p-3" : "gap-2 p-3 pb-28"}
                    footer={loadMore}
                  >
                    {(item) => (
                      <ItemTile
                        item={item()}
                        selected={isSelected(item())}
                        onPress={(e) => press(item(), e)}
                        onLongPress={() => toggle(item())}
                        onMenu={(at) => menu(item(), at)}
                      />
                    )}
                  </List>
                </If>
              </If>
            </View>
          )}
        </Loaded>
        <If when={focused()}>{(item) => <DetailsPanel item={item()} storageName={props.title} onClose={clear} />}</If>
        <If when={!platform.desktop && folder() && selected().length === 0}>
          <View
            role="button"
            accessibilityLabel="Upload"
            onPress={() => openUpload(target(), title())}
            style={{ bottom: tabBarHeight() + 16 }}
            class="absolute right-5 size-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80"
          >
            <Icon name="plus" class="size-7 tint-primary-foreground" />
          </View>
        </If>
      </View>
    </Page>
  );
}
