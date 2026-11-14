import { effect, List, platform, resource, Scroll, signal, Text, View } from "nsh";
import { Input } from "nsh/base";
import { Icon } from "../components/icon";
import { divider, FileRow } from "../components/item-row";
import { Page } from "../components/page";
import { FilterChip } from "../components/select-field";
import { Button, Empty } from "../components/ui";
import { call, changes } from "../lib/api";
import { load } from "../lib/load";
import { run } from "../lib/run";
import type { FileItem, Page as Paged, StorageInfo } from "../lib/types";

type Cursor = { score: number; id: string };

const MB = 1000 * 1000;

// The web app's size buckets.
const SIZES = [
  { value: "", label: "Any size" },
  { value: "small", label: "Under 1 MB", maxSize: MB },
  { value: "medium", label: "1 MB to 100 MB", minSize: MB, maxSize: 100 * MB },
  { value: "large", label: "100 MB to 1 GB", minSize: 100 * MB, maxSize: 1000 * MB },
  { value: "huge", label: "Over 1 GB", minSize: 1000 * MB },
] as { value: string; label: string; minSize?: number; maxSize?: number }[];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Phones pick a date range from these rather than typing dates: days back from today.
const SINCE = [
  { value: "", label: "Any time" },
  { value: "0", label: "Today" },
  { value: "7", label: "Past 7 days" },
  { value: "30", label: "Past 30 days" },
  { value: "365", label: "Past year" },
];

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const TYPES = [
  { value: "", label: "Any type" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "pdf", label: "PDFs" },
  { value: "document", label: "Documents" },
  { value: "text", label: "Text" },
  { value: "archive", label: "Archives" },
];

export function Search() {
  const q = signal("");
  const type = signal("");
  const storageId = signal("");
  const size = signal("");
  const from = signal("");
  const to = signal("");
  const since = signal("");
  const pickSince = (value: string) => {
    since.set(value);
    from.set(value === "" ? "" : daysAgo(Number(value)));
    to.set("");
  };
  const results = signal<FileItem[]>([]);
  const cursor = signal<Cursor | undefined>(undefined);
  const storages = load<StorageInfo[]>("storage/list");

  // A date only counts once it's a whole one, so typing doesn't search for every keystroke.
  const day = (value: string) => (DATE.test(value) ? value : undefined);
  const input = () => {
    const bucket = SIZES.find((s) => s.value === size());

    return {
      q: q(),
      type: type() || undefined,
      storageId: storageId() || undefined,
      minSize: bucket?.minSize,
      maxSize: bucket?.maxSize,
      modifiedFrom: day(from()),
      modifiedTo: day(to()),
    };
  };
  const filtered = () => Boolean(type() || storageId() || size() || day(from()) || day(to()));

  // Blank text with no filter searches nothing; a filter alone lists what matches it.
  const first = resource(
    () => (q().trim() || filtered() ? { n: changes(), input: input() } : null),
    (s) => call<Paged<FileItem, Cursor>>("search/query", s.input),
  );

  effect(() => {
    const page = first();

    results.set(page?.items ?? []);
    cursor.set(page?.nextCursor);
  });

  const more = () =>
    run(async () => {
      const page = await call<Paged<FileItem, Cursor>>("search/query", { ...input(), cursor: cursor() });

      results.update((list) => [...list, ...page.items]);
      cursor.set(page.nextCursor);
    });

  return (
    <Page title="Search">
      <View class={platform.desktop ? "w-full max-w-4xl gap-3 self-center px-8 pb-3 pt-2" : "gap-3 px-4 pb-3 pt-1"}>
        <View class={`h-11 flex-row items-center gap-2 rounded-xl bg-card px-3.5 ${platform.desktop ? "border border-border" : ""}`}>
          <Icon name="search" class="size-[18px] tint-muted-foreground" />
          <Input
            value={q()}
            onChange={(e) => q.set(e.value)}
            testID="search"
            placeholder="Names, text and photo details"
            returnKeyType="search"
            autoCorrect={false}
            class={`h-11 flex-1 text-foreground placeholder:text-muted-foreground ${platform.desktop ? "text-[14px]" : "text-[16px]"}`}
          />
          <If when={q()}>
            <View role="button" accessibilityLabel="Clear search" onPress={() => q.set("")} class="size-6 items-center justify-center rounded-full bg-muted-foreground/30">
              <Icon name="x" class="size-3.5 tint-background" />
            </View>
          </If>
        </View>
        <Scroll horizontal scrollbar={false} class="-mx-4 grow-0" contentClass="flex-row gap-2 px-4">
          <FilterChip label="Type" options={TYPES} value={type()} onChange={(v) => type.set(v)} />
          <FilterChip label="Size" options={SIZES} value={size()} onChange={(v) => size.set(v)} />
          <FilterChip label="Modified" options={SINCE} value={since()} onChange={pickSince} />
          <If when={(storages()?.length ?? 0) > 1}>
            <FilterChip
              label="Storage"
              options={[{ value: "", label: "All storages" }, ...(storages() ?? []).map((s) => ({ value: s.id, label: s.name }))]}
              value={storageId()}
              onChange={(v) => storageId.set(v)}
            />
          </If>
        </Scroll>
      </View>
      <If
        when={results().length > 0}
        else={
          <Empty
            icon="search"
            title={first() ? "No files match" : first.loading() ? "Searching…" : "Find a file"}
            detail={first() ? "Try other words, or fewer filters." : "Type part of a name, or pick a type."}
          />
        }
      >
        <List
          each={results()}
          keyExtractor={(f) => f.id}
          estimatedItemSize={62}
          separator={divider}
          class="flex-1"
          contentClass={platform.desktop ? "" : "pb-28"}
          header={() => (
            <Text class={`pb-1 pt-2 text-[13px] font-medium text-muted-foreground ${platform.desktop ? "px-5" : "px-4"}`}>
              {`${results().length}${cursor() ? "+" : ""} ${results().length === 1 ? "result" : "results"}`}
            </Text>
          )}
          footer={() => (
            <If when={cursor()}>
              <Button title="Load more" variant="ghost" class="m-4" onPress={more} />
            </If>
          )}
        >
          {(f) => <FileRow file={f()} showStorage />}
        </List>
      </If>
    </Page>
  );
}
