import { Scroll, Text, View } from "nsh";
import { titleBar } from "nsh/desktop";
import { user } from "../lib/api";
import { load } from "../lib/load";
import { nav, openSection, section, type Section } from "../lib/nav";
import type { StorageInfo } from "../lib/types";
import { Icon, type IconName } from "./icon";
import { openServerMenu } from "./server-menu";
import { GLASS } from "./ui";

function Item(props: { title: string; icon: IconName; active: boolean; onPress: () => void }) {
  return (
    <View
      role="button"
      accessibilityLabel={props.title}
      onPress={props.onPress}
      class={`h-8 flex-row items-center gap-2.5 rounded-lg px-2.5 ${props.active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60 active:bg-sidebar-accent"}`}
    >
      <Icon name={props.icon} class={`size-4 ${props.active ? "tint-primary" : "tint-muted-foreground"}`} />
      <Text class={`flex-1 truncate text-[13px] ${props.active ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground"}`}>
        {props.title}
      </Text>
    </View>
  );
}

const Link = (props: { title: string; icon: IconName; to: Section }) => (
  <Item title={props.title} icon={props.icon} active={section() === props.to && nav.routes().length === 1} onPress={() => openSection(props.to)} />
);

const Label = (props: { title: string }) => <Text class="px-2.5 pb-1 pt-3 text-[11px] font-semibold text-muted-foreground">{props.title}</Text>;

/** Desktop navigation: a floating Liquid Glass panel holding the window's traffic lights, as Finder's sidebar. */
export function Sidebar() {
  const storages = load<StorageInfo[]>("storage/list");
  const storageOpen = (id: string) => {
    const root = nav.routes()[0]!;

    return root.name === "folder" && root.storageId === id;
  };
  const initials = () =>
    (user()?.name ?? "")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <View style={GLASS} class="m-2 mr-0 w-60 rounded-[18px] border border-sidebar-border bg-sidebar shadow-lg">
      {/* Room for the traffic lights; dragging it moves the window. */}
      <View desktop={{ windowDrag: true }} style={{ height: Math.max(titleBar().height, 44) }} />
      <Scroll class="flex-1" contentClass="gap-0.5 px-2.5 pb-2">
        <Link title="Home" icon="house" to="home" />
        <Link title="Search" icon="search" to="search" />
        <Label title="Storages" />
        <Each of={storages() ?? []} key={(s) => s.id}>
          {(s) => (
            <Item
              title={s().name}
              icon="hard-drive"
              active={storageOpen(s().id)}
              onPress={() => nav.setRoutes([{ name: "folder", storageId: s().id, title: s().name }])}
            />
          )}
        </Each>
        <Item title="Connect storage" icon="plus" active={false} onPress={() => nav.setRoutes([{ name: "storages" }, { name: "storage-form" }])} />
        <Label title="Library" />
        <Link title="Trash" icon="trash-2" to="trash" />
        <Link title="Settings" icon="settings" to="settings" />
      </Scroll>
      <View
        role="button"
        accessibilityLabel="Servers and account"
        onPress={(e) => openServerMenu(e.pagePosition)}
        class="m-2 flex-row items-center gap-2.5 rounded-xl p-2 hover:bg-sidebar-accent/60 active:bg-sidebar-accent"
      >
        <View class="size-8 items-center justify-center rounded-full bg-primary">
          <Text class="text-[12px] font-semibold text-primary-foreground">{initials()}</Text>
        </View>
        <View class="flex-1">
          <Text class="truncate text-[13px] font-medium text-sidebar-foreground">{user()?.name}</Text>
          <Text class="truncate text-[11px] text-muted-foreground">{user()?.email}</Text>
        </View>
      </View>
    </View>
  );
}
