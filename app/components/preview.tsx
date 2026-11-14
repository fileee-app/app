import { Image, resource, Scroll, Text, Video, View, WebView, platform } from "nsh";
import { call } from "../lib/api";
import { Icon } from "./icon";
import type { PreviewKind } from "../lib/types";

const TEXT_LIMIT = 256 * 1024;

/**
 * The file shown inline, from a short-lived signed URL. `compact` fits the details panel beside a
 * folder, where a PDF shows as its `thumbnail` that `onOpen` opens; `fill` takes the height it's given
 * (the file page beside its details on wide windows).
 */
export function Preview(props: { fileId: string; compact?: boolean; fill?: boolean; thumbnail?: string | null; onOpen?: () => void }) {
  const preview = resource(
    () => props.fileId,
    async (fileId) => {
      const signed = await call<{ kind: PreviewKind; url: string | null }>("file/previewUrl", { fileId });
      const text =
        signed.kind === "text" && signed.url
          ? (await (await fetch(signed.url, { headers: { range: `bytes=0-${TEXT_LIMIT - 1}` } })).text())
          : null;

      return { ...signed, text };
    },
  );

  const none = (message: string) => (
    <View class={`${props.fill ? "flex-1" : "h-40"} items-center justify-center rounded-xl bg-muted`}>
      <Text class="text-sm text-muted-foreground">{message}</Text>
    </View>
  );

  return (
    <If when={preview()} else={none(preview.error() ? (preview.error() as Error).message : "Loading preview…")}>
      {(p) => {
        const { kind, url, text } = p();

        if (!url) return none("No preview for this kind of file.");
        if (kind === "image") return <Image src={url} class={`${props.fill ? "flex-1" : props.compact ? "h-56" : "h-80"} w-full rounded-xl bg-muted object-contain`} />;
        if (kind === "video") return <Video src={url} controls class={`${props.fill ? "flex-1" : props.compact ? "h-48" : "h-80"} w-full rounded-xl bg-black`} />;
        if (kind === "audio") return <Video src={url} controls class="h-14 w-full" />;
        // The system's PDF viewer draws its controls at one size, too big for the narrow panel.
        if (kind === "pdf" && props.compact) {
          return (
            <View
              role="button"
              accessibilityLabel="Open PDF"
              onPress={props.onOpen}
              class="h-[380px] w-full items-center justify-center overflow-hidden rounded-xl bg-muted hover:opacity-90"
            >
              <If when={props.thumbnail} else={<Icon name="file-text" class="size-12 tint-muted-foreground" />}>
                <Image src={props.thumbnail!} class="h-full w-full object-contain" />
              </If>
              <View class="absolute bottom-3 rounded-full bg-black/60 px-3 py-1">
                <Text class="text-xs font-medium text-white">Open to read</Text>
              </View>
            </View>
          );
        }
        // Android's web view can't show PDFs; the download button opens them there.
        if (kind === "pdf") {
          if (platform.os === "android") return none("Download to view this PDF.");

          // Clipped by a view around it: a web view doesn't round its own corners.
          return (
            <View class={`${props.fill ? "flex-1" : props.compact ? "h-[380px]" : platform.desktop ? "h-[600px]" : "h-[480px]"} w-full overflow-hidden rounded-2xl bg-card`}>
              <WebView src={url} class="flex-1" />
            </View>
          );
        }

        return (
          <Scroll class={`${props.fill ? "flex-1" : props.compact ? "max-h-[260px]" : "max-h-[480px]"} rounded-xl bg-muted`} contentClass="p-4">
            <Text class="select-text font-mono text-xs text-foreground">{text}</Text>
          </Scroll>
        );
      }}
    </If>
  );
}
