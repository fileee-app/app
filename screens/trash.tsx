import { List, platform, Text, View } from "nsh";
import { Icon } from "../components/icon";
import { divider } from "../components/item-row";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { Action, Empty } from "../components/ui";
import { showChoices } from "../lib/actions";
import { call } from "../lib/api";
import { formatBytes, formatShortDate, kindIconOf } from "../lib/format";
import { load } from "../lib/load";
import { confirm, run } from "../lib/run";
import type { TrashFile, TrashFolder } from "../lib/types";

function itemMenu(kind: "file" | "folder", item: { id: string; name: string }) {
  const input = kind === "file" ? { fileId: item.id } : { folderId: item.id };

  return showChoices(item.name, [
    { label: "Restore", icon: "refresh-cw", run: () => run(() => call(`${kind}/restore`, input)) },
    {
      label: "Delete forever",
      icon: "trash-2",
      destructive: true,
      run: async () => {
        if (await confirm("Delete forever?", `${item.name} is deleted from the bucket. This can't be undone.`, "Delete forever")) {
          await run(() => call(`${kind}/purge`, input));
        }
      },
    },
  ]);
}

type Trashed = ({ kind: "file" } & TrashFile) | ({ kind: "folder" } & TrashFolder);

const count = (t: { files: TrashFile[]; folders: TrashFolder[] }) => t.files.length + t.folders.length;

/** A trashed file or folder on phones, as the folder pages draw theirs: a tile of its kind, then what and when. */
function TrashRow(props: { item: Trashed }) {
  const kind = () => (props.item.kind === "folder" ? { icon: "folder-fill" as const, tint: "tint-sky-500" } : kindIconOf(props.item.name));

  return (
    <View
      role="button"
      accessibilityLabel={props.item.name}
      onPress={() => itemMenu(props.item.kind, props.item)}
      class={`flex-row items-center ${platform.desktop ? "mx-2 min-h-12 gap-3 rounded-lg px-2.5 py-1.5 hover:bg-accent" : "min-h-[62px] gap-3.5 px-4 py-2"} active:bg-accent`}
    >
      <View class={`items-center justify-center rounded-xl opacity-70 ${platform.desktop ? "size-9" : "size-11"} ${kind().tint.replace("tint-", "bg-")}/15`}>
        <Icon name={kind().icon} class={`${platform.desktop ? "size-5" : "size-[22px]"} ${kind().tint}`} />
      </View>
      <View class="flex-1 gap-0.5">
        <Text class={`truncate text-foreground ${platform.desktop ? "text-[14px]" : "text-[15px] font-medium"}`}>{props.item.name}</Text>
        <Text class={`truncate text-muted-foreground ${platform.desktop ? "text-xs" : "text-[13px]"}`}>
          {[
            props.item.kind === "file" ? formatBytes(props.item.size) : "Folder",
            `Trashed ${formatShortDate(props.item.trashedAt)}`,
            props.item.storageName,
          ].join(" · ")}
        </Text>
      </View>
      <Action title="More" icon="ellipsis" label={`Actions for ${props.item.name}`} onPress={() => itemMenu(props.item.kind, props.item)} />
    </View>
  );
}

export function Trash() {
  const trash = load<{ files: TrashFile[]; folders: TrashFolder[] }>("trash/list");

  const empty = async () => {
    if (await confirm("Empty trash?", "Everything in trash is deleted from your buckets. This can't be undone.", "Empty trash")) {
      await run(() => call("trash/empty"));
    }
  };

  return (
    <Page
      title="Trash"
      actions={() => (
        <If when={(trash()?.files.length ?? 0) + (trash()?.folders.length ?? 0) > 0}>
          <Action title="Empty trash" icon="trash-2" destructive onPress={empty} />
        </If>
      )}
    >
      <Loaded of={trash}>
        {(t) => (
          <If
            when={t().files.length + t().folders.length > 0}
            else={<Empty icon="trash-2" title="Trash is empty" detail="Things you delete stay here until you empty it." />}
          >
            <List
              each={[...t().folders.map((folder) => ({ kind: "folder" as const, ...folder })), ...t().files.map((file) => ({ kind: "file" as const, ...file }))]}
              keyExtractor={(item) => `${item.kind}:${item.id}`}
              estimatedItemSize={platform.desktop ? 56 : 62}
              class="flex-1"
              contentClass={platform.desktop ? "" : "pb-28"}
              header={() => (
                <Text class="px-4 pb-2 pt-1 text-[13px] text-muted-foreground">
                  {`${count(t())} ${count(t()) === 1 ? "item" : "items"} · ${formatBytes(t().files.reduce((sum, f) => sum + f.size, 0))} · Deleted for good when you empty trash`}
                </Text>
              )}
              separator={divider}
            >
              {(item) => <TrashRow item={item()} />}
            </List>
          </If>
        )}
      </Loaded>
    </Page>
  );
}
