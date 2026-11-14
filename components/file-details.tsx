import { platform, Scroll, Text, View, windowSize } from "nsh";
import { download, move, openItem, rename, showChoices, star, trash } from "../lib/actions";
import { formatBytes, formatDate, formatShortDate } from "../lib/format";
import { nav } from "../lib/nav";
import type { FileDetails } from "../lib/types";
import { Icon, type IconName } from "./icon";
import { Preview } from "./preview";
import { Card, SectionTitle } from "./ui";
const LABELS: Record<string, string> = {
  width: "Width",
  height: "Height",
  duration: "Duration (s)",
  pages: "Pages",
  title: "Title",
  author: "Author",
  lines: "Lines",
  encoding: "Encoding",
  camera: "Camera",
  takenAt: "Taken",
  latitude: "Latitude",
  longitude: "Longitude",
};

const Detail = (props: { label: string; value: string }) => (
  <View class={`flex-row justify-between gap-4 border-b border-border px-4 last:border-b-0 ${platform.desktop ? "py-2.5" : "py-3"}`}>
    <Text class={`text-muted-foreground ${platform.desktop ? "text-[13px]" : "text-[15px]"}`}>{props.label}</Text>
    <Text class={`flex-1 text-right text-foreground ${platform.desktop ? "text-[13px]" : "text-[15px]"}`}>{props.value}</Text>
  </View>
);

/** One of the phones' file actions: an icon over a word, in a row of equal tiles. */
const ActionTile = (props: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) => (
  <View
    role="button"
    accessibilityLabel={props.label}
    onPress={props.onPress}
    class={`flex-1 items-center gap-1.5 rounded-2xl py-3 active:opacity-70 ${props.primary ? "bg-primary" : "bg-card"} ${
      platform.desktop ? (props.primary ? "hover:opacity-90" : "border border-border hover:bg-accent") : ""
    }`}
  >
    <Icon name={props.icon} class={`size-[22px] ${props.primary ? "tint-primary-foreground" : "tint-primary"}`} />
    <Text class={`text-[12px] font-medium ${props.primary ? "text-primary-foreground" : "text-foreground"}`}>{props.label}</Text>
  </View>
);

/** "PDF · 26.4 KB · Nov 11": the file at a glance, under its preview on phones. */
const summary = (f: FileDetails) =>
  [f.name.includes(".") ? f.name.split(".").pop()!.toUpperCase() : null, formatBytes(f.size), formatShortDate(f.modifiedAt)].filter(Boolean).join(" · ");

/**
 * A file's preview, actions and details: the file page's body, and the details panel beside a folder
 * on wide windows (`compact`). `onTrashed` runs once it went to trash.
 */
export function FileDetailsView(props: { file: FileDetails; compact?: boolean; onTrashed: () => void; class?: string }) {
  const f = () => props.file;
  // Wide windows put the preview beside the rest, at the page's full height.
  const wide = () => !props.compact && platform.desktop && windowSize().width >= 1100;

  const Missing = () => (
    <If when={f().status === "missing"}>
      <Text class="rounded-lg bg-destructive/10 p-3 text-[13px] text-destructive">The last sync couldn't find this file in the bucket.</Text>
    </If>
  );

  const FilePreview = (p: { fill?: boolean }) => (
    <Preview fileId={f().id} compact={props.compact} fill={p.fill} thumbnail={f().thumbnailUrl} onOpen={() => openItem({ kind: "file", file: f() })} />
  );

  /** The file at a glance and four tiles; Rename, Move and trash under More. */
  const Actions = () => (
    <View class="gap-4">
      <Text class="px-1 text-center text-[13px] text-muted-foreground">{summary(f())}</Text>
      <View class="flex-row gap-2.5">
        <ActionTile icon="download" label="Download" primary onPress={() => download(f().id)} />
        <ActionTile icon="share-2" label="Share" onPress={() => nav.push({ name: "share", fileId: f().id, title: f().name })} />
        <ActionTile icon={f().starred ? "star-fill" : "star"} label={f().starred ? "Starred" : "Star"} onPress={() => star([f()], !f().starred)} />
        <ActionTile
          icon="ellipsis"
          label="More"
          onPress={() =>
            showChoices(f().name, [
              { label: "Rename", icon: "pencil", run: () => rename({ kind: "file", file: f() }) },
              { label: "Move", icon: "folder-input", run: () => move([{ kind: "file", file: f() }]) },
              {
                label: "Move to trash",
                icon: "trash-2",
                destructive: true,
                run: async () => (await trash([{ kind: "file", file: f() }])) && props.onTrashed(),
              },
            ])
          }
        />
      </View>
    </View>
  );

  const Details = () => (
    <View class="gap-2">
      <SectionTitle title="Details" />
      <Card>
        <Detail label="Size" value={formatBytes(f().size)} />
        <Detail label="Type" value={f().mimeType ?? (f().name.includes(".") ? `${f().name.split(".").pop()!.toUpperCase()} file` : "Unknown")} />
        <Detail label="Modified" value={formatDate(f().modifiedAt)} />
        <Detail label="Added" value={formatDate(f().createdAt)} />
        <If when={f().uploaderName}>
          <Detail label="Uploaded by" value={f().uploaderName!} />
        </If>
        <Each of={Object.entries(f().metadata ?? {}).filter(([key]) => LABELS[key])}>
          {(entry) => <Detail label={LABELS[entry()[0]]!} value={String(entry()[1])} />}
        </Each>
      </Card>
    </View>
  );

  return (
    <If
      when={wide()}
      else={
        <Scroll class="flex-1" contentClass={props.class}>
          <Missing />
          <FilePreview />
          <Actions />
          <Details />
        </Scroll>
      }
    >
      <View class="flex-1 flex-row gap-6 px-6 pb-6 pt-2">
        <View class="flex-1 gap-3">
          <Missing />
          <FilePreview fill />
        </View>
        <Scroll class="w-[360px]" contentClass="gap-6 pb-2">
          <Actions />
          <Details />
        </Scroll>
      </View>
    </If>
  );
}
