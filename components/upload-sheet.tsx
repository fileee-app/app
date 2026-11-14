import { platform, signal, Text, View } from "nsh";
import { Dialog } from "nsh/base";
import { run } from "../lib/run";
import { type Target, uploadDropped, uploadFiles, uploadPhotos } from "../lib/uploads";
import { Icon, type IconName } from "./icon";
import { Action, Button, GLASS } from "./ui";

const current = signal<{ target: Target; where: string } | null>(null);

/** Asks where new files come from, then uploads them to `target`, the folder named `where`. */
export const openUpload = (target: Target, where: string) => current.set({ target, where });

const dragging = signal(false);

const close = () => current.set(null);

function Option(props: { icon: IconName; color: string; title: string; detail: string; shortcut?: string; onPress: (target: Target) => Promise<void> }) {
  return (
    <View
      role="button"
      accessibilityLabel={props.title}
      onPress={() => {
        const { target } = current()!;

        close();
        void run(() => props.onPress(target));
      }}
      class="flex-row items-center gap-3 rounded-2xl p-3 hover:bg-accent active:bg-accent"
    >
      <View class={`size-11 items-center justify-center rounded-xl ${props.color}`}>
        <Icon name={props.icon} class="size-[22px] tint-white" />
      </View>
      <View class="flex-1 gap-0.5">
        <Text class="text-[15px] font-medium text-popover-foreground">{props.title}</Text>
        <Text class="text-[13px] text-muted-foreground">{props.detail}</Text>
      </View>
      <If when={platform.desktop && props.shortcut}>
        <Text class="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{props.shortcut}</Text>
      </If>
    </View>
  );
}

/** Placed once, in the shell: a sheet from the bottom of the window, on desktops as on phones. */
export function UploadSheetHost() {
  return (
    <Dialog
      open={current() !== null}
      animation="slide"
      onOpenChange={(e) => !e.open && close()}
      backdropClass="bg-black/30"
      class="h-full w-full"
    >
      {/* The sheet is a modal, which drops never reach past: the whole window takes them while it's up. */}
      <View
        class="flex-1"
        onFileDragEnter={() => dragging.set(true)}
        onFileDragLeave={() => dragging.set(false)}
        onFileDrop={(e) => {
          const { target } = current()!;

          dragging.set(false);
          close();
          void run(async () => uploadDropped(e.uris, target));
        }}
      >
        <View class="absolute inset-0" onPress={close} />
        <View
          style={GLASS}
          class={
            platform.desktop
              ? "mx-auto mb-6 mt-auto w-[460px] gap-1 rounded-[28px] border border-border bg-popover/85 p-3 shadow-2xl"
              : "mt-auto w-full gap-1 rounded-t-[28px] border-t border-border bg-popover/90 px-3 pb-8 pt-2 shadow-2xl"
          }
        >
          <If when={!platform.desktop}>
            <View class="mb-1 h-1.5 w-10 self-center rounded-full bg-muted-foreground/40" />
          </If>
          <View class="flex-row items-center gap-3 px-3 pb-2 pt-1">
            <View class="size-9 items-center justify-center rounded-full bg-primary/15">
              <Icon name="cloud-upload" class="size-5 tint-primary" />
            </View>
            <View class="flex-1">
              <Text class="text-[17px] font-semibold text-popover-foreground">Upload</Text>
              <Text class="truncate text-[13px] text-muted-foreground">To {current()?.where}</Text>
            </View>
            <If when={platform.desktop}>
              <Action title="Close" icon="x" onPress={close} />
            </If>
          </View>
          <If when={platform.desktop}>
            <Option
              icon="file"
              color="bg-blue-500"
              title="Files"
              detail="Choose one or more files"
              shortcut={platform.os === "macos" ? "⌘U" : "Ctrl+U"}
              onPress={uploadFiles}
            />
            <Option
              icon="folder-fill"
              color="bg-sky-500"
              title="Folder"
              detail="Everything in it, with its folders"
              onPress={(target) => uploadFiles(target, true)}
            />
          </If>
          <Option icon="file-image" color="bg-pink-500" title="Photos & videos" detail="From your photo library" onPress={uploadPhotos} />
          <If
            when={platform.desktop}
            else={<Button title="Cancel" variant="secondary" class="mt-2 h-11" onPress={close} />}
          >
            <View
              class={`mt-1 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed p-3 ${dragging() ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <Icon name="upload" class={`size-4 ${dragging() ? "tint-primary" : "tint-muted-foreground"}`} />
              <Text class={`text-[12px] ${dragging() ? "font-medium text-primary" : "text-muted-foreground"}`}>
                {dragging() ? `Drop to upload to ${current()?.where}` : "Or drop files and folders anywhere"}
              </Text>
            </View>
          </If>
        </View>
      </View>
    </Dialog>
  );
}
