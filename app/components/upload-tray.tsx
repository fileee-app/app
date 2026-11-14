import { platform, Scroll, signal, Text, View } from "nsh";
import { formatBytes, kindIconOf } from "../lib/format";
import { load } from "../lib/load";
import { tabBarHeight } from "../lib/nav";
import { run } from "../lib/run";
import {
  cancelUpload,
  clearFinished,
  discardPending,
  isRunning,
  type Pending,
  resumePending,
  retryUpload,
  type Upload,
  uploads,
} from "../lib/uploads";
import { Icon } from "./icon";
import { Action, GLASS } from "./ui";

const active = (u: Upload) => u.status === "queued" || u.status === "uploading" || u.status === "processing";
const percent = (loaded: number, size: number) => (size > 0 ? Math.min(100, Math.round((loaded / size) * 100)) : 100);

/** What a row says under its name. */
function status(u: Upload) {
  switch (u.status) {
    case "queued":
      return "Waiting";
    case "uploading":
      return `${percent(u.loaded, u.size)}% · ${formatBytes(u.loaded)} of ${formatBytes(u.size)}`;
    case "processing":
      return "Making preview";
    case "done":
      return `Done · ${formatBytes(u.size)}`;
    case "canceled":
      return "Canceled";
    case "error":
      return u.error ?? "Failed";
  }
}

const Bar = (props: { value: number; class?: string }) => (
  <View class={`h-1 overflow-hidden rounded-full bg-muted ${props.class ?? ""}`}>
    <View class="h-full rounded-full bg-primary" style={{ width: `${props.value}%` }} />
  </View>
);

/** The kind of file a row is, small. */
const Mark = (props: { name: string }) => {
  const kind = () => kindIconOf(props.name);

  return (
    <View class={`size-8 items-center justify-center rounded-lg ${kind().tint.replace("tint-", "bg-")}/15`}>
      <Icon name={kind().icon} class={`size-4 ${kind().tint}`} />
    </View>
  );
};

/** Phones: the tray folds to its header, to see the page under it. */
const folded = signal(false);

/** This session's uploads, and the ones an earlier session left unfinished, above the content. */
export function UploadTray() {
  const pending = load<Pending[]>("upload/listPending");
  const interrupted = () => (pending() ?? []).filter((p) => !isRunning(p.fileId));
  const running = () => uploads().filter(active);
  // Bytes across what is still going, so the bar moves with big files as with many small ones.
  const progress = () => {
    const list = running();

    return percent(
      list.reduce((sum, u) => sum + (u.status === "processing" ? u.size : u.loaded), 0),
      list.reduce((sum, u) => sum + u.size, 0),
    );
  };
  const failed = () => uploads().filter((u) => u.status === "error").length;

  const title = () => {
    if (running().length > 0) return `Uploading ${uploads().length - running().length + 1} of ${uploads().length}`;
    if (failed() > 0) return `${failed()} ${failed() === 1 ? "upload" : "uploads"} failed`;

    return uploads().length ? "Uploads finished" : "Unfinished uploads";
  };

  return (
    <If when={uploads().length > 0 || interrupted().length > 0}>
      <View
        // Phones: a card floating just above the tab bar, which floats over the pages too.
        style={platform.desktop ? GLASS : { ...GLASS, bottom: tabBarHeight() + 10 }}
        class={
          platform.desktop
            ? "absolute bottom-4 right-4 max-h-80 w-96 rounded-2xl border border-border bg-popover/85 pb-1 shadow-2xl"
            : "absolute left-3 right-3 max-h-64 rounded-2xl border border-border bg-popover/90 pb-1 shadow-2xl"
        }
      >
        <View class="gap-2 px-4 pb-2 pt-3">
          <View class="flex-row items-center gap-2">
            <Icon
              name={running().length > 0 ? "cloud-upload" : failed() > 0 || uploads().length === 0 ? "circle-alert" : "check"}
              class={`size-[18px] ${
                running().length > 0 ? "tint-primary" : failed() > 0 ? "tint-destructive" : uploads().length === 0 ? "tint-amber-500" : "tint-green-500"
              }`}
            />
            <Text class="flex-1 text-[14px] font-semibold text-popover-foreground">{title()}</Text>
            <If when={uploads().length > running().length}>
              <Action title="Clear" onPress={clearFinished} />
            </If>
            <If when={!platform.desktop}>
              <View
                role="button"
                accessibilityLabel={folded() ? "Show uploads" : "Hide uploads"}
                onPress={() => folded.set(!folded())}
                class="size-8 items-center justify-center rounded-full active:bg-accent"
              >
                <Icon name="chevron-left" class={`size-[18px] tint-foreground ${folded() ? "rotate-90" : "-rotate-90"}`} />
              </View>
            </If>
          </View>
          <If when={running().length > 0}>
            <Bar value={progress()} />
          </If>
        </View>

        <If when={platform.desktop || !folded()}>
          <Scroll class="grow-0" contentClass="gap-1 px-2 pb-1">
            <Each of={uploads()} key={(u) => u.id}>
              {(u) => (
                <View class="flex-row items-center gap-3 rounded-xl px-2 py-1.5">
                  <Mark name={u().name} />
                  <View class="flex-1 gap-1">
                    <Text class="truncate text-[13px] text-foreground">{u().name}</Text>
                    <If when={u().status === "uploading"}>
                      <Bar value={percent(u().loaded, u().size)} />
                    </If>
                    <Text class={`truncate text-[11px] ${u().status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{status(u())}</Text>
                  </View>
                  <If when={u().status === "queued" || u().status === "uploading"}>
                    <Action title="Cancel" icon="x" onPress={() => cancelUpload(u().id)} />
                  </If>
                  <If when={u().status === "error"}>
                    <Action title="Retry" icon="refresh-cw" onPress={() => retryUpload(u().id)} />
                  </If>
                  <If when={u().status === "done"}>
                    <View class="size-8 items-center justify-center">
                      <Icon name="check" class="size-4 tint-green-500" />
                    </View>
                  </If>
                </View>
              )}
            </Each>
            <Each of={interrupted()} key={(p) => p.fileId}>
              {(p) => (
                <View class="flex-row items-center gap-3 rounded-xl px-2 py-1.5">
                  <Mark name={p().name} />
                  <View class="flex-1 gap-0.5">
                    <Text class="truncate text-[13px] text-foreground">{p().name}</Text>
                    <Text class="text-[11px] text-muted-foreground">Interrupted · {formatBytes(p().size)}</Text>
                  </View>
                  <Action title="Resume" onPress={() => run(() => resumePending(p()))} />
                  <Action title="Discard" destructive onPress={() => run(() => discardPending(p()))} />
                </View>
              )}
            </Each>
          </Scroll>
        </If>
      </View>
    </If>
  );
}
