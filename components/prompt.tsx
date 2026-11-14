import { signal, Text, View } from "nsh";
import { Dialog } from "nsh/base";
import { Button, GLASS, Field } from "./ui";

interface Prompt {
  title: string;
  label: string;
  value: string;
  confirm: string;
  masked?: boolean;
  resolve: (value: string | null) => void;
}

const current = signal<Prompt | null>(null);
const value = signal("");

/** Asks for one line of text: a name, a password. Resolves with null when cancelled. */
export const prompt = (options: Omit<Prompt, "resolve">) =>
  new Promise<string | null>((resolve) => {
    value.set(options.value);
    current.set({ ...options, resolve });
  });

const close = (result: string | null) => {
  current()?.resolve(result);
  current.set(null);
};

/** Placed once, in the shell. */
export function PromptHost() {
  return (
    <Dialog
      open={current() !== null}
      animation="fade"
      onOpenChange={(e) => !e.open && close(null)}
      backdropClass="bg-black/40"
      style={GLASS}
      class="m-auto w-[90%] max-w-sm gap-4 rounded-3xl border border-border bg-popover/85 shadow-2xl p-5"
    >
      <Text class="text-lg font-semibold text-popover-foreground">{current()?.title}</Text>
      <Field
        label={current()?.label ?? ""}
        value={value()}
        onChange={(e) => value.set(e.value)}
        onSubmit={() => close(value())}
        masked={current()?.masked}
        autoFocus
      />
      <View class="flex-row justify-end gap-2">
        <Button title="Cancel" variant="ghost" onPress={() => close(null)} />
        <Button title={current()?.confirm ?? "OK"} onPress={() => close(value())} />
      </View>
    </Dialog>
  );
}
