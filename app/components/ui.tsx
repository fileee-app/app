// The app's small building blocks. nsh/base gives behavior only, so the look lives here: macOS 26's
// Liquid Glass where the system has it (`glassEffect`), a blurred material elsewhere.
import type { JSX, PressEvent } from "nsh";
import { platform, split, Text, View } from "nsh";
import { Button as BaseButton, Input, type InputProps } from "nsh/base";
import { Icon, type IconName } from "./icon";

/** Liquid Glass on iOS 26 / macOS 26 and later; the blur is what other systems draw. */
export const GLASS = { glassEffect: "regular", backdropFilter: "blur(30px) saturate(1.6)" } as const;

const VARIANTS = {
  primary: ["bg-primary active:bg-primary/85", "text-primary-foreground", "tint-primary-foreground"],
  secondary: ["bg-secondary active:bg-secondary/70", "text-secondary-foreground", "tint-secondary-foreground"],
  ghost: ["active:bg-accent hover:bg-accent", "text-primary", "tint-primary"],
  destructive: ["bg-destructive/12 active:bg-destructive/20", "text-destructive", "tint-destructive"],
} as const;

/** A capsule button, as macOS 26 and iOS 26 draw them. */
export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: keyof typeof VARIANTS;
  icon?: IconName;
  disabled?: boolean;
  class?: string;
}) {
  const variant = () => VARIANTS[props.variant ?? "primary"];

  return (
    <BaseButton
      onPress={props.onPress}
      disabled={props.disabled}
      class={`h-9 flex-row items-center justify-center gap-1.5 rounded-full px-4 disabled:opacity-40 ${variant()[0]} ${props.class ?? ""}`}
    >
      <If when={props.icon}>
        <Icon name={props.icon!} class={`size-4 ${variant()[2]}`} />
      </If>
      <Text class={`text-[13px] font-medium ${variant()[1]}`}>{props.title}</Text>
    </BaseButton>
  );
}

export function Field(props: InputProps & { label: string; hint?: string }) {
  const [own, rest] = split(props, ["label", "hint"]);

  return (
    <View class="gap-1.5">
      <Text class="px-1 text-[13px] font-medium text-foreground">{own.label}</Text>
      <Input
        accessibilityLabel={own.label}
        class="h-9 rounded-lg border border-transparent bg-secondary px-3 text-[14px] text-foreground focus:border-ring placeholder:text-muted-foreground"
        {...rest}
      />
      <If when={own.hint}>
        <Text class="px-1 text-xs text-muted-foreground">{own.hint}</Text>
      </If>
    </View>
  );
}

export const ErrorText = (props: { message: string | null | undefined }) => (
  <If when={props.message}>
    <View class="flex-row items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2">
      <Icon name="circle-alert" class="mt-0.5 size-4 tint-destructive" />
      <Text class="flex-1 text-[13px] text-destructive">{props.message}</Text>
    </View>
  </If>
);

export const SectionTitle = (props: { title: string }) => (
  <Text class={platform.desktop ? "px-3 text-[13px] font-semibold text-muted-foreground" : "px-1 text-[15px] font-semibold text-foreground"}>
    {props.title}
  </Text>
);

/** A grouped section, as System Settings draws them; flat on phones, as iOS's inset grouped lists. */
export const Card = (props: { children?: JSX.Element; class?: string }) => (
  <View class={`overflow-hidden ${platform.desktop ? "rounded-2xl border border-border shadow-sm" : "rounded-[18px]"} bg-card ${props.class ?? ""}`}>
    {props.children}
  </View>
);

/** A pressable row: an icon, a title and subtitle, and what goes at its end. */
export function Row(props: {
  icon?: IconName;
  /** The icon's color class (`tint-*`). */
  tint?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  end?: JSX.Element;
  muted?: boolean;
  chevron?: boolean;
  /** The icon in white on a tile of `tint`'s color, as iOS Settings draws them. */
  tile?: boolean;
}) {
  return (
    <View
      role="button"
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      class={`${platform.desktop ? "min-h-12 px-4 py-2" : "p-4"} flex-row items-center gap-3 border-b border-border last:border-b-0 hover:bg-accent active:bg-accent`}
    >
      <If when={props.icon}>
        <If when={props.tile} else={<Icon name={props.icon!} class={`size-5 ${props.tint ?? "tint-primary"}`} />}>
          <View class={`size-[30px] items-center justify-center rounded-[8px] ${(props.tint ?? "tint-primary").replace("tint-", "bg-")}`}>
            <Icon name={props.icon!} class="size-[18px] tint-white" />
          </View>
        </If>
      </If>
      <View class="flex-1 gap-0.5">
        <Text class={`truncate ${platform.desktop ? "text-[14px]" : "text-[16px]"} ${props.muted ? "text-muted-foreground" : "text-foreground"}`}>{props.title}</Text>
        <If when={props.subtitle}>
          <Text class="truncate text-xs text-muted-foreground">{props.subtitle}</Text>
        </If>
      </View>
      {props.end}
      <If when={props.chevron}>
        <Icon name="chevron-left" class="size-4 rotate-180 tint-muted-foreground" />
      </If>
    </View>
  );
}

/** A toolbar or row action: an icon in a circle, or a word when it has no icon. */
export function Action(props: { title: string; onPress: (e: PressEvent) => void; destructive?: boolean; label?: string; icon?: IconName }) {
  return (
    <If
      when={props.icon}
      else={
        <Text
          role="button"
          accessibilityLabel={props.label}
          onPress={props.onPress}
          class={`rounded-full px-3 py-1.5 text-[13px] font-medium hover:bg-accent active:opacity-60 ${props.destructive ? "text-destructive" : "text-primary"}`}
        >
          {props.title}
        </Text>
      }
    >
      <View
        role="button"
        accessibilityLabel={props.label ?? props.title}
        onPress={props.onPress}
        class="size-8 items-center justify-center rounded-full hover:bg-accent active:bg-accent"
      >
        <Icon name={props.icon!} class={`size-[18px] ${props.destructive ? "tint-destructive" : "tint-foreground"}`} />
      </View>
    </If>
  );
}

/** Toolbar actions grouped in a glass capsule, as macOS 26 toolbars group them. */
export const ToolbarGroup = (props: { children?: JSX.Element }) => (
  <View style={GLASS} class="h-9 flex-row items-center gap-0.5 rounded-full border border-border bg-sidebar px-0.5 shadow-sm">
    {props.children}
  </View>
);

export const Empty = (props: { title: string; detail?: string; icon?: IconName; children?: JSX.Element }) => (
  <View class="flex-1 items-center justify-center gap-3 p-8">
    <View class="size-16 items-center justify-center rounded-2xl bg-secondary">
      <Icon name={props.icon ?? "folder"} class="size-8 tint-muted-foreground" />
    </View>
    <Text class="text-center text-[17px] font-semibold text-foreground">{props.title}</Text>
    <If when={props.detail}>
      <Text class="max-w-sm text-center text-[13px] text-muted-foreground">{props.detail}</Text>
    </If>
    {props.children}
  </View>
);

/** Content width on wide windows; full width on phones. */
export const contentClass = () => (platform.desktop ? "w-full max-w-4xl self-center gap-6 px-8 py-6" : "gap-5 px-4 pb-28 pt-2");
