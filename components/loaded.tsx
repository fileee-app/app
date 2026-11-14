import type { JSX, Resource } from "nsh";
import { Text, View } from "nsh";
import { Button } from "./ui";

/** Shows a loaded value, or its loading state, or its error with a retry. */
export function Loaded<T>(props: { of: Resource<T>; children: (value: () => NonNullable<T>) => JSX.Element }) {
  const failed = (
    <If
      when={props.of.error()}
      else={
        <View class="flex-1 items-center justify-center p-8">
          <Text class="text-sm text-muted-foreground">Loading…</Text>
        </View>
      }
    >
      <View class="flex-1 items-center justify-center gap-3 p-8">
        <Text class="text-center text-sm text-destructive">{(props.of.error() as Error)?.message}</Text>
        <Button title="Try again" variant="secondary" onPress={() => props.of.refetch()} />
      </View>
    </If>
  );

  return (
    <If when={props.of()} else={failed}>
      {(value) => props.children(value as () => NonNullable<T>)}
    </If>
  );
}
