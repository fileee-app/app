import { platform, Text, View } from "nsh";
import { Select } from "nsh/base";
import { Icon } from "./icon";
import { GLASS } from "./ui";

/** The look of a `Select`'s list: a popup on desktops, a sheet from the bottom on phones. */
const LIST = {
  popupStyle: GLASS,
  popupClass: platform.desktop
    ? "rounded-xl border border-border bg-popover/90 p-1 shadow-xl"
    : "max-h-[70%] rounded-t-[28px] border-t border-border bg-popover px-3 pb-8 pt-4 shadow-2xl",
  backdropClass: "bg-black/30",
  itemClass: platform.desktop
    ? "rounded-md px-2.5 py-1.5 text-[13px] text-popover-foreground focus:bg-primary focus:text-primary-foreground selected:font-semibold"
    : "rounded-xl px-3 py-3 text-[16px] text-popover-foreground focus:bg-accent selected:font-semibold selected:text-primary",
};

/**
 * A filter as a chip that opens its choices: its name while the first choice ("Any …", value "")
 * is on, else the choice, filled.
 */
export function FilterChip<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const on = () => props.value !== "";

  return (
    <Select
      accessibilityLabel={props.label}
      items={props.options.map((o) => ({ value: o.value, title: o.label }))}
      value={props.value}
      onChange={(e) => props.onChange((e.value ?? "") as T)}
      trigger={
        <View class={`h-8 flex-row items-center gap-1 rounded-full pl-3 pr-2 active:opacity-70 ${on() ? "bg-primary" : "border border-border bg-card"}`}>
          <Text class={`text-[13px] font-medium ${on() ? "text-primary-foreground" : "text-foreground"}`}>
            {on() ? props.options.find((o) => o.value === props.value)?.label : props.label}
          </Text>
          <Icon name="chevron-left" class={`size-3.5 -rotate-90 ${on() ? "tint-primary-foreground" : "tint-muted-foreground"}`} />
        </View>
      }
      {...LIST}
    />
  );
}

/**
 * A labelled choice from a list, as a field: a dropdown under it on desktops, a sheet from the
 * bottom on phones.
 */
export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const current = () => props.options.find((o) => o.value === props.value)?.label ?? "";

  return (
    <View class="gap-1.5">
      <Text class="px-1 text-[13px] font-medium text-foreground">{props.label}</Text>
      <Select
        accessibilityLabel={props.label}
        items={props.options.map((o) => ({ value: o.value, title: o.label }))}
        value={props.value}
        onChange={(e) => e.value !== null && props.onChange(e.value as T)}
        trigger={
          <View class="h-9 flex-row items-center gap-2 rounded-lg bg-secondary px-3 active:opacity-70">
            <Text class="flex-1 truncate text-[14px] text-foreground">{current()}</Text>
            <Icon name="chevron-left" class="size-4 -rotate-90 tint-muted-foreground" />
          </View>
        }
        {...LIST}
      />
    </View>
  );
}
