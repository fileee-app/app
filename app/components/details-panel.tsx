import { resource, Text, View } from "nsh";
import { type Item, itemChoices, itemKey, itemName, openItem } from "../lib/actions";
import { call, changes } from "../lib/api";
import type { FileDetails } from "../lib/types";
import { FileDetailsView } from "./file-details";
import { ItemMark } from "./item-row";
import { Loaded } from "./loaded";
import { Action, Button } from "./ui";

function FilePanel(props: { fileId: string; onClose: () => void }) {
  const { fileId } = props;
  const file = resource(
    () => ({ n: changes(), fileId }),
    (s) => call<FileDetails>("file/get", { fileId: s.fileId }),
  );

  return (
    <Loaded of={file}>
      {(f) => <FileDetailsView file={f()} compact onTrashed={props.onClose} class="gap-4 p-4" />}
    </Loaded>
  );
}

function FolderPanel(props: { item: Item; storageName: string }) {
  return (
    <View class="gap-4 p-4">
      <View class="items-center gap-2 py-6">
        <ItemMark item={props.item} class="size-24" iconClass="size-20" />
        <Text class="text-center text-[15px] font-semibold text-foreground">{itemName(props.item)}</Text>
        <Text class="text-[13px] text-muted-foreground">Folder</Text>
      </View>
      <Button title="Open" icon="folder" onPress={() => openItem(props.item, props.storageName)} />
      <View class="flex-row flex-wrap gap-2">
        <Each of={itemChoices(props.item, props.storageName).filter((c) => c.label !== "Open")} key={(c) => c.label}>
          {(c) => (
            <Button title={c().label} icon={c().icon} variant={c().destructive ? "destructive" : "secondary"} onPress={() => void c().run()} />
          )}
        </Each>
      </View>
    </View>
  );
}

/** The selected item beside the folder on wide windows, as the web app's details panel. */
export function DetailsPanel(props: { item: Item; storageName: string; onClose: () => void }) {
  return (
    <View class="m-2 ml-0 w-[340px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <View class="h-11 flex-row items-center gap-2 border-b border-border pl-4 pr-1.5">
        <Text class="flex-1 truncate text-[13px] font-semibold text-foreground">{itemName(props.item)}</Text>
        <Action title="Close details" icon="x" onPress={props.onClose} />
      </View>
      {/* Keyed by the item: a new selection builds a new panel, preview included. */}
      <Each of={[props.item]} key={itemKey}>
        {(item) =>
          item().kind === "file" ? (
            <FilePanel fileId={(item() as Extract<Item, { kind: "file" }>).file.id} onClose={props.onClose} />
          ) : (
            <FolderPanel item={item()} storageName={props.storageName} />
          )
        }
      </Each>
    </View>
  );
}
