import type { JSX } from "nsh";
import { Scroll, Text, View } from "nsh";
import { Icon } from "../components/icon";
import { GLASS } from "../components/ui";

/** The glass card around the connect, setup and login forms, over a soft wash of color. */
export const AuthLayout = (props: { title: string; subtitle: string; children?: JSX.Element }) => (
  <View class="flex-1 bg-background">
    <View class="absolute inset-0 bg-linear-to-br from-sky-500/25 via-transparent to-violet-500/25" />
    <Scroll class="flex-1" contentClass="grow items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <View style={GLASS} class="w-full max-w-sm gap-5 rounded-3xl border border-border bg-sidebar p-7 shadow-2xl">
        <View class="items-center gap-3">
          <View class="size-14 items-center justify-center rounded-2xl bg-linear-to-b from-sky-400 to-blue-600 shadow-md">
            <Icon name="hard-drive" class="size-7 tint-white" />
          </View>
          <View class="items-center gap-1">
            <Text class="text-center text-[22px] font-semibold text-foreground">{props.title}</Text>
            <Text class="text-center text-[13px] text-muted-foreground">{props.subtitle}</Text>
          </View>
        </View>
        {props.children}
      </View>
    </Scroll>
  </View>
);
