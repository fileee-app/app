import type { JSX } from "nsh";
import { context, effect, platform, signal, Text, View } from "nsh";
import { titleBar } from "nsh/desktop";
import { nav } from "../lib/nav";
import { Icon } from "./icon";
import { openServerMenu } from "./server-menu";
import { GLASS, ToolbarGroup } from "./ui";

/**
 * What a screen puts in its stack page's system header (phones): set by `Page`, read by the
 * `NavPage` in App. A `root` page (a tab's own, on phones) draws its header itself.
 */
export const createHeader = (root = false) => ({
  root,
  title: signal(""),
  actions: signal<{ render?: () => JSX.Element }>({}),
});

export const Header = context<ReturnType<typeof createHeader> | null>(null);

/** The desktop toolbar: in the window's title bar, which drags the window, as macOS 26 apps draw it. */
function Toolbar(props: { title: string; actions?: () => JSX.Element }) {
  return (
    <View desktop={{ windowDrag: true }} style={{ height: Math.max(titleBar().height, 52) }} class="flex-row items-center gap-3 px-4">
      <If when={nav.routes().length > 1}>
        <View
          role="button"
          accessibilityLabel="Back"
          desktop={{ windowDrag: false }}
          onPress={() => nav.pop()}
          style={GLASS}
          class="size-9 items-center justify-center rounded-full border border-border bg-sidebar shadow-sm active:opacity-70"
        >
          <Icon name="chevron-left" class="size-[18px] tint-foreground" />
        </View>
      </If>
      <Text class="flex-1 truncate text-[17px] font-semibold text-foreground">{props.title}</Text>
      <If when={props.actions}>
        <View desktop={{ windowDrag: false }}>
          <ToolbarGroup>{props.actions!()}</ToolbarGroup>
        </View>
      </If>
    </View>
  );
}

/**
 * The phones' header, drawn by the app rather than the system's: one compact bar with the server
 * menu and a large title on a tab's own page (`root`), a plain back chevron and a title on the
 * pages under it, then the page's actions.
 */
function PhoneHeader(props: { title: string; root: boolean; actions?: () => JSX.Element }) {
  return (
    <View class="pt-[env(safe-area-inset-top)]">
      <View class="h-[52px] flex-row items-center gap-1 pl-1.5 pr-2">
        <View
          role="button"
          accessibilityLabel={props.root ? "Servers and account" : "Back"}
          onPress={() => (props.root ? openServerMenu() : nav.pop())}
          class="size-10 items-center justify-center rounded-full active:bg-accent"
        >
          <Icon name={props.root ? "menu" : "chevron-left"} class={props.root ? "size-[21px] tint-foreground" : "size-6 tint-primary"} />
        </View>
        <Text role="header" class={`flex-1 truncate font-bold text-foreground ${props.root ? "text-[22px]" : "text-[17px]"}`}>
          {props.title}
        </Text>
        <View class="flex-row items-center">{props.actions?.()}</View>
      </View>
    </View>
  );
}

/**
 * A screen's frame. The `NavPage` itself is App's: NavStack needs it straight from its child
 * function, not inside a component. Phones get the system header from what this sets; desktops
 * get the toolbar. `actions` builds once per header.
 */
export function Page(props: { title: string; actions?: () => JSX.Element; children?: JSX.Element }) {
  const header = Header();

  effect(() => header?.title.set(props.title));
  header?.actions.set({ render: props.actions });

  return (
    <View class="flex-1 bg-background">
      <If when={platform.desktop}>
        <Toolbar title={props.title} actions={props.actions} />
      </If>
      <If when={header}>
        <PhoneHeader title={props.title} root={header!.root} actions={props.actions} />
      </If>
      {props.children}
    </View>
  );
}
