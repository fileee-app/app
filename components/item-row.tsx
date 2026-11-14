import type { Point, PressEvent } from "nsh";
import { Image, platform, Text, View } from "nsh";
import { fileMenu, type Item, itemName, openItem } from "../lib/actions";
import { formatBytes, formatShortDate, kindIcon } from "../lib/format";
import type { FileItem } from "../lib/types";
import { Icon } from "./icon";
import { Action } from "./ui";

const subtitle = (item: Item, showStorage?: boolean) =>
  item.kind === "folder"
    ? "Folder"
    : [
        item.file.status === "missing" ? "Missing from the bucket" : formatBytes(item.file.size),
        formatShortDate(item.file.modifiedAt),
        showStorage ? item.file.storageName : undefined,
      ]
        .filter(Boolean)
        .join(" · ");

/** A file's or folder's mark: its thumbnail, or its kind's icon (on a tile of its color, with `tile`). */
export function ItemMark(props: { item: Item; class: string; iconClass: string; tile?: boolean }) {
  const thumbnail = () => (props.item.kind === "file" ? props.item.file.thumbnailUrl : null);
  const kind = () =>
    props.item.kind === "folder" ? { icon: "folder-fill" as const, tint: "tint-sky-500" } : kindIcon(props.item.file.mimeType);

  return (
    <If
      when={thumbnail()}
      else={
        <View class={`items-center justify-center ${props.tile ? `rounded-xl ${kind().tint.replace("tint-", "bg-")}/15` : ""} ${props.class}`}>
          <Icon name={kind().icon} class={`${props.iconClass} ${kind().tint}`} />
        </View>
      }
    >
      {(src) => <Image src={src()} class={`${props.tile ? "rounded-xl" : "rounded-md"} border border-border bg-muted object-cover ${props.class}`} />}
    </If>
  );
}

/** A file or folder in a list. With `onToggle` it can be selected: a checkbox on desktops, a long press on phones. */
export function ItemRow(props: {
  item: Item;
  selected?: boolean;
  /** Something is selected, so a tap selects rather than opens (phones). */
  selecting?: boolean;
  showStorage?: boolean;
  onPress: (e: PressEvent) => void;
  onLongPress?: () => void;
  onToggle?: () => void;
  onMenu: (at?: Point) => void;
}) {
  const starred = () => props.item.kind === "file" && props.item.file.starred;
  const missing = () => props.item.kind === "file" && props.item.file.status === "missing";

  return (
    <View
      role="button"
      accessibilityLabel={itemName(props.item)}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onContextMenu={(e) => props.onMenu(e.pagePosition)}
      class={`${platform.desktop ? "mx-2 min-h-12 gap-3 rounded-lg px-2.5 py-1.5" : "min-h-[62px] gap-3.5 px-4 py-2"} flex-row items-center ${
        props.selected ? "bg-primary/15" : "hover:bg-accent active:bg-accent"
      }`}
    >
      <If when={props.onToggle}>
        <View role="checkbox" accessibilityLabel={`Select ${itemName(props.item)}`} onPress={props.onToggle} class="p-0.5">
          <Icon name={props.selected ? "square-check" : "square"} class={`size-4 ${props.selected ? "tint-primary" : "tint-muted-foreground/60"}`} />
        </View>
      </If>
      <If when={platform.desktop} else={<ItemMark item={props.item} tile class="size-11" iconClass="size-[22px]" />}>
        <ItemMark item={props.item} tile class="size-9" iconClass="size-5" />
      </If>
      <View class="flex-1 gap-0.5">
        <View class="flex-row items-center gap-1.5">
          <Text class={`shrink truncate ${platform.desktop ? "text-[14px]" : "text-[15px] font-medium"} ${missing() ? "text-muted-foreground" : "text-foreground"}`}>
            {itemName(props.item)}
          </Text>
          <If when={starred()}>
            <Icon name="star-fill" class="size-3 tint-amber-400" />
          </If>
        </View>
        <Text class={`truncate text-muted-foreground ${platform.desktop ? "text-xs" : "text-[13px]"}`}>{subtitle(props.item, props.showStorage)}</Text>
      </View>
      <Action title="More" icon="ellipsis" label={`Actions for ${itemName(props.item)}`} onPress={(e) => props.onMenu(e.pagePosition)} />
    </View>
  );
}

/** Between file rows on phones, from the names' edge, as iOS lists draw it; nothing on desktops. */
export const divider = () => (platform.desktop ? <View /> : <View class="ml-[74px] h-px bg-border" />);

/** A file in a list outside a folder (home, search): opens on a press. */
export const FileRow = (props: { file: FileItem; showStorage?: boolean }) => (
  <ItemRow
    item={{ kind: "file", file: props.file }}
    showStorage={props.showStorage}
    onPress={() => openItem({ kind: "file", file: props.file })}
    onLongPress={() => fileMenu(props.file)}
    onMenu={(at) => fileMenu(props.file, at)}
  />
);
