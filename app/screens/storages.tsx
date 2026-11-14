import { Scroll, Text } from "nsh";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { Action, Button, Card, contentClass, Empty, Row } from "../components/ui";
import { load } from "../lib/load";
import { nav } from "../lib/nav";
import type { StorageInfo } from "../lib/types";

interface RemovalFailure {
  id: string;
  url: string;
  error: string;
}

export function Storages() {
  const storages = load<StorageInfo[]>("storage/list");
  const stuck = load<RemovalFailure[]>("share/removalFailures");

  return (
    <Page title="Storages" actions={() => <Action title="Connect storage" icon="plus" onPress={() => nav.push({ name: "storage-form" })} />}>
      <Loaded of={storages}>
        {(list) => (
          <If
            when={list().length > 0}
            else={
              <Empty title="No storages yet" detail="Connect an S3-compatible bucket to keep files in.">
                <Button title="Connect storage" onPress={() => nav.push({ name: "storage-form" })} />
              </Empty>
            }
          >
            <Scroll class="flex-1" contentClass={contentClass()}>
              <If when={(stuck()?.length ?? 0) > 0}>
                <Card class="gap-2 p-4">
                  <Text class="text-sm font-medium text-destructive">Some public copies couldn't be deleted</Text>
                  <Text class="text-sm text-muted-foreground">
                    They're still public. Fileee keeps retrying. Check the storage's credentials, or delete them yourself from the bucket.
                  </Text>
                  <Each of={stuck() ?? []} key={(s) => s.id}>
                    {(s) => <Text class="select-text text-xs text-foreground">{`${s().url}: ${s().error}`}</Text>}
                  </Each>
                </Card>
              </If>
              <Card>
                <Each of={list()} key={(s) => s.id}>
                  {(s) => (
                    <Row
                      icon="hard-drive" chevron
                      title={s().name}
                      subtitle={`${s().bucket} · ${s().status === "ok" ? "Connected" : s().status === "error" ? "Connection problem" : "Not checked"}`}
                      onPress={() => nav.push({ name: "storage-form", storage: s() })}
                    />
                  )}
                </Each>
              </Card>
            </Scroll>
          </If>
        )}
      </Loaded>
    </Page>
  );
}
