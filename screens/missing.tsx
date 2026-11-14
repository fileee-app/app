import { effect, platform, resource, Scroll, signal } from "nsh";
import { Page } from "../components/page";
import { Action, Button, Empty, Row } from "../components/ui";
import { call, changes } from "../lib/api";
import { formatDate } from "../lib/format";
import { run } from "../lib/run";

interface MissingFile {
  id: string;
  name: string;
  objectKey: string;
  lastSeenAt: string | null;
}

/** Files the last sync couldn't find in the bucket. */
export function Missing(props: { storageId: string }) {
  const { storageId } = props;
  const items = signal<MissingFile[]>([]);
  const cursor = signal<string | undefined>(undefined);
  const first = resource(changes, () => call<{ items: MissingFile[]; nextCursor?: string }>("file/listMissing", { storageId }));

  effect(() => {
    items.set(first()?.items ?? []);
    cursor.set(first()?.nextCursor);
  });

  const more = () =>
    run(async () => {
      const page = await call<{ items: MissingFile[]; nextCursor?: string }>("file/listMissing", { storageId, cursor: cursor() });

      items.update((list) => [...list, ...page.items]);
      cursor.set(page.nextCursor);
    });

  return (
    <Page title="Missing files">
      <If when={items().length > 0} else={<Empty title="Nothing is missing" detail="Every file was found in the bucket at the last sync." />}>
        <Scroll class="flex-1" contentClass={platform.desktop ? "" : "pb-28"}>
          <Each of={items()} key={(f) => f.id}>
            {(f) => (
              <Row
                icon="circle-alert" tint="tint-destructive"
                title={f().name}
                subtitle={`${f().objectKey} · Last seen ${f().lastSeenAt ? formatDate(f().lastSeenAt) : "never"}`}
                end={<Action title="Trash" destructive onPress={() => run(() => call("file/trash", { fileId: f().id }))} />}
              />
            )}
          </Each>
          <If when={cursor()}>
            <Button title="Load more" variant="ghost" class="m-4" onPress={more} />
          </If>
        </Scroll>
      </If>
    </Page>
  );
}
