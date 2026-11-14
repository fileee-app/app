import type { Point, PressEvent } from "nsh";
import { Text, View } from "nsh";
import { type Item, itemName } from "../lib/actions";
import { ItemMark } from "./item-row";

/** A file or folder in the grid view, as wide as its column: a large thumbnail and its name. */
export function ItemTile(props: {
  item: Item;
  selected?: boolean;
  onPress: (e: PressEvent) => void;
  onLongPress?: () => void;
  onMenu: (at?: Point) => void;
}) {
  return (
    <View
      role="button"
      accessibilityLabel={itemName(props.item)}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onContextMenu={(e) => props.onMenu(e.pagePosition)}
      class={`w-full gap-1.5 rounded-xl p-2 ${props.selected ? "bg-primary/15" : "hover:bg-accent active:bg-accent"}`}
    >
      <ItemMark item={props.item} class="h-24 w-full" iconClass="size-16" />
      <Text
        class={`self-center truncate rounded-md px-1.5 text-center text-[12px] ${props.selected ? "bg-primary font-medium text-primary-foreground" : "text-foreground"}`}
      >
        {`${props.item.kind === "file" && props.item.file.starred ? "★ " : ""}${itemName(props.item)}`}
      </Text>
    </View>
  );
}
