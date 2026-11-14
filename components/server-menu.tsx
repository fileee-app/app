import type { JSX } from "nsh";
import { platform, type Point, Scroll, signal, Text, View } from "nsh";
import { Dialog } from "nsh/base";
import { Menu } from "nsh/desktop";
import { appName, host, type Server, servers, signOut, user } from "../lib/api";
import { load } from "../lib/load";
import { nav } from "../lib/nav";
import type { StorageInfo } from "../lib/types";
import { addServer, openServer, signedOut } from "../lib/stage";
import { Icon, type IconName } from "./icon";
import { Button, GLASS } from "./ui";

const open = signal(false);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const address = (server: Server) => server.host.replace(/^https?:\/\//, "");
const current = () => servers().find((s) => s.host === host());

const ACTIONS: { label: string; icon: IconName; destructive?: boolean; run: () => unknown }[] = [
  { label: "Add server", icon: "plus", run: addServer },
  { label: "Account", icon: "user-round", run: () => nav.setRoutes([{ name: "settings" }, { name: "account" }]) },
  { label: "Sign out", icon: "log-out", destructive: true, run: () => signOut().then(signedOut) },
];

/** The storages (phones), the servers signed in to and the account's actions: a dropdown on desktops, a sheet on phones. */
export function openServerMenu(at?: Point) {
  if (!platform.desktop) return open.set(true);

  void Menu.popup(
    [
      ...servers().map((s) => ({
        label: `${s.appName} — ${s.email}`,
        checked: s.host === host(),
        onSelect: () => void (s.host !== host() && openServer(s)),
      })),
      { type: "separator" as const },
      ...ACTIONS.map((a) => ({ label: a.label === "Sign out" ? `Sign out of ${current()?.appName ?? "this server"}` : `${a.label}…`, onSelect: () => void a.run() })),
    ],
    at,
  );
}

const close = (then?: () => unknown) => {
  open.set(false);
  void then?.();
};

/** A row of the sheet: an icon or a mark, a title and a line under it, and what goes at its end. */
function SheetRow(props: { label: string; testID?: string; title: string; detail?: string; mark: JSX.Element; end?: JSX.Element; danger?: boolean; onPress: () => void }) {
  return (
    <View role="button" testID={props.testID} accessibilityLabel={props.label} onPress={props.onPress} class="min-h-12 flex-row items-center gap-3 rounded-2xl px-3 py-2 active:bg-accent">
      {props.mark}
      <View class="flex-1 gap-0.5">
        <Text class={`truncate text-[16px] ${props.danger ? "text-destructive" : "text-popover-foreground"}`}>{props.title}</Text>
        <If when={props.detail}>
          <Text class="truncate text-[13px] text-muted-foreground">{props.detail}</Text>
        </If>
      </View>
      {props.end}
    </View>
  );
}

const Label = (props: { title: string }) => <Text class="px-3 pb-1 pt-3 text-[13px] font-semibold text-muted-foreground">{props.title}</Text>;

const IconMark = (props: { name: IconName; class?: string }) => (
  <View class="size-9 items-center justify-center">
    <Icon name={props.name} class={`size-[22px] ${props.class ?? "tint-foreground"}`} />
  </View>
);

const Avatar = (props: { name: string; active?: boolean }) => (
  <View class={`size-9 items-center justify-center rounded-full ${props.active ? "bg-primary" : "bg-secondary"}`}>
    <Text class={`text-[13px] font-semibold ${props.active ? "text-primary-foreground" : "text-secondary-foreground"}`}>{initials(props.name)}</Text>
  </View>
);

/** The phones' menu, as the desktop sidebar: the storages, then the servers and the account. Placed once, in the shell. */
export function ServerMenuHost() {
  const storages = load<StorageInfo[]>("storage/list");
  const others = () => servers().filter((s) => s.host !== host());

  return (
    <Dialog open={open()} animation="slide" onOpenChange={(e) => !e.open && close()} backdropClass="bg-black/30" class="h-full w-full">
      <View class="absolute inset-0" onPress={() => close()} />
      <View style={GLASS} class="mt-auto max-h-[85%] w-full rounded-t-[28px] border-t border-border bg-popover/90 pb-8 pt-2 shadow-2xl">
        <View class="mb-1 h-1.5 w-10 self-center rounded-full bg-muted-foreground/40" />
        <Scroll class="grow-0" contentClass="gap-0.5 px-3">
          <View class="flex-row items-center gap-3 px-3 py-2">
            <Avatar name={user()?.name ?? ""} active />
            <View class="flex-1 gap-0.5">
              <Text class="truncate text-[16px] font-semibold text-popover-foreground">{user()?.name}</Text>
              <Text class="truncate text-[13px] text-muted-foreground">{`${appName()} · ${host().replace(/^https?:\/\//, "")}`}</Text>
            </View>
          </View>

          <Label title="Storages" />
          <Each of={storages() ?? []} key={(st) => st.id}>
            {(st) => (
              <SheetRow
                testID={`menu-storage-${st().id}`}
                label={st().name}
                title={st().name}
                detail={`${st().bucket}${st().status === "error" ? " · Connection problem" : ""}`}
                mark={<IconMark name="hard-drive" class="tint-primary" />}
                onPress={() => close(() => nav.setRoutes([{ name: "home" }, { name: "folder", storageId: st().id, title: st().name }]))}
              />
            )}
          </Each>
          <SheetRow
            label="Connect storage"
            title="Connect storage"
            mark={<IconMark name="plus" />}
            onPress={() => close(() => nav.setRoutes([{ name: "settings" }, { name: "storages" }, { name: "storage-form" }]))}
          />

          <If when={others().length > 0}>
            <Label title="Other servers" />
            <Each of={others()} key={(sv) => sv.host}>
              {(sv) => (
                <SheetRow
                  label={`${sv().appName}, ${sv().email}`}
                  title={sv().appName}
                  detail={`${sv().email} · ${address(sv())}`}
                  mark={<Avatar name={sv().name} />}
                  onPress={() => close(() => openServer(sv()))}
                />
              )}
            </Each>
          </If>

          <View class="mx-3 my-1.5 h-px bg-border" />
          <Each of={ACTIONS} key={(a) => a.label}>
            {(a) => (
              <SheetRow
                label={a().label}
                title={a().label === "Sign out" ? `Sign out of ${appName()}` : a().label}
                danger={a().destructive}
                mark={<IconMark name={a().icon} class={a().destructive ? "tint-destructive" : "tint-foreground"} />}
                onPress={() => close(a().run)}
              />
            )}
          </Each>
        </Scroll>
        <View class="px-3">
          <Button title="Close" variant="secondary" class="mt-2 h-11" onPress={() => close()} />
        </View>
      </View>
    </Dialog>
  );
}
