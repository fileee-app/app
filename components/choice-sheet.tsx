import { signal, Text, View } from "nsh";
import { Dialog } from "nsh/base";
import type { Choice } from "../lib/actions";
import { Icon } from "./icon";
import { Button, GLASS } from "./ui";

const current = signal<{ title: string; choices: Choice[]; resolve: (choice: Choice | undefined) => void } | null>(null);

/** Phones' menus: the choices in a sheet from the bottom. Resolves with the one picked, if any. */
export const pickChoice = (title: string, choices: Choice[]) =>
  new Promise<Choice | undefined>((resolve) => current.set({ title, choices, resolve }));

const close = (choice?: Choice) => {
  current()?.resolve(choice);
  current.set(null);
};

/** Placed once, in the shell. */
export function ChoiceSheetHost() {
  return (
    <Dialog
      open={current() !== null}
      animation="slide"
      onOpenChange={(e) => !e.open && close()}
      backdropClass="bg-black/30"
      class="h-full w-full"
    >
      <View class="absolute inset-0" onPress={() => close()} />
      <View
        style={GLASS}
        class="mt-auto w-full gap-0.5 rounded-t-[28px] border-t border-border bg-popover/90 px-3 pb-8 pt-2 shadow-2xl"
      >
        <View class="mb-1 h-1.5 w-10 self-center rounded-full bg-muted-foreground/40" />
        <Text class="truncate px-3 pb-2 pt-1 text-center text-[13px] font-medium text-muted-foreground">{current()?.title}</Text>
        <Each of={current()?.choices ?? []} key={(c) => c.label}>
          {(c) => (
            <View
              role="button"
              accessibilityLabel={c().label}
              onPress={() => close(c())}
              class="h-12 flex-row items-center gap-3 rounded-2xl px-3 active:bg-accent"
            >
              <View class="size-5">
                <If when={c().icon}>
                  <Icon name={c().icon!} class={`size-5 ${c().destructive ? "tint-destructive" : "tint-foreground"}`} />
                </If>
              </View>
              <Text class={`text-[16px] ${c().destructive ? "text-destructive" : "text-popover-foreground"}`}>{c().label}</Text>
            </View>
          )}
        </Each>
        <Button title="Cancel" variant="secondary" class="mt-2 h-11" onPress={() => close()} />
      </View>
    </Dialog>
  );
}
