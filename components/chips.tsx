import { Scroll, Text } from "nsh";

/** A row of choices, one selected. `bleed` scrolls it edge to edge, out of a parent's p-4, as iOS filter bars do. */
export function Chips<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; bleed?: boolean }) {
  return (
    <Scroll
      horizontal
      scrollbar={!props.bleed}
      class={props.bleed ? "-mx-4 grow-0" : "grow-0"}
      contentClass={props.bleed ? "flex-row gap-2 px-4" : "flex-row gap-2"}
    >
      <Each of={props.options} key={(o) => o.value}>
        {(o) => (
          <Text
            role="button"
            onPress={() => props.onChange(o().value)}
            class={`rounded-full px-3 py-1.5 text-[13px] ${
              o().value === props.value
                ? "bg-primary font-medium text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-accent active:bg-accent"
            }`}
          >
            {o().label}
          </Text>
        )}
      </Each>
    </Scroll>
  );
}
