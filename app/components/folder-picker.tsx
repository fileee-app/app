import { resource, Scroll, signal, Text, View } from "nsh";
import { Dialog } from "nsh/base";
import { call } from "../lib/api";
import type { Folder } from "../lib/types";
import { Button, GLASS, Row } from "./ui";

interface Pick {
  storageId: string;
  /** Folders being moved can't go into themselves. */
  exclude: string[];
  resolve: (folderId: string | null) => void;
}

const current = signal<Pick | null>(null);
const at = signal<string | undefined>(undefined);

/** Lets the user choose a folder of a storage. Resolves with null when cancelled. */
export const pickFolder = (storageId: string, exclude: string[] = []) =>
  new Promise<string | null>((resolve) => {
    at.set(undefined);
    current.set({ storageId, exclude, resolve });
  });

const close = (folderId: string | null) => {
  current()?.resolve(folderId);
  current.set(null);
};

/** Placed once, in the shell. */
export function FolderPickerHost() {
  const folder = resource(
    () => current() && { storageId: current()!.storageId, folderId: at() },
    (input) => call<{ folder: Folder; path: Folder[]; children: Folder[] }>("folder/get", input),
  );

  return (
    <Dialog
      open={current() !== null}
      animation="fade"
      onOpenChange={(e) => !e.open && close(null)}
      backdropClass="bg-black/40"
      style={GLASS}
      class="m-auto h-[70%] w-[90%] max-w-md gap-3 rounded-3xl border border-border bg-popover/85 shadow-2xl p-5"
    >
      <Text class="text-lg font-semibold text-popover-foreground">Move to</Text>
      <Text class="truncate text-sm text-muted-foreground">
        {["Root", ...(folder()?.path.map((f) => f.name) ?? [])].join(" / ")}
      </Text>
      <Scroll class="flex-1 rounded-lg border border-border">
        <If when={folder()?.folder.parentId}>
          <Row icon="chevron-left" tint="tint-muted-foreground" title="Up" onPress={() => at.set(folder()!.folder.parentId ?? undefined)} />
        </If>
        <Each of={folder()?.children.filter((f) => !current()?.exclude.includes(f.id)) ?? []} key={(f) => f.id}>
          {(f) => <Row icon="folder-fill" tint="tint-sky-500" chevron title={f().name} onPress={() => at.set(f().id)} />}
        </Each>
      </Scroll>
      <View class="flex-row justify-end gap-2">
        <Button title="Cancel" variant="ghost" onPress={() => close(null)} />
        <Button title="Move here" disabled={!folder()} onPress={() => close(folder()!.folder.id)} />
      </View>
    </Dialog>
  );
}
