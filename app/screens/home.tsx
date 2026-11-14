import { platform, Scroll, Text, View } from "nsh";
import { Icon } from "../components/icon";
import { divider, FileRow } from "../components/item-row";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { Button, Card, contentClass, Empty, SectionTitle } from "../components/ui";
import { user } from "../lib/api";
import { load } from "../lib/load";
import { nav } from "../lib/nav";
import type { FileItem, StorageInfo } from "../lib/types";

/** A storage on the phones' home: a card in a strip that scrolls sideways. */
function StorageCard(props: { title: string; detail: string; add?: boolean; onPress: () => void }) {
  return (
    <View
      role="button"
      accessibilityLabel={props.title}
      onPress={props.onPress}
      class={`h-[112px] w-[148px] justify-between rounded-[18px] p-3.5 active:opacity-70 ${props.add ? "border border-dashed border-border hover:bg-accent" : "bg-card hover:bg-accent"} ${platform.desktop ? "border border-border" : ""}`}
    >
      <View class={`size-10 items-center justify-center rounded-xl ${props.add ? "bg-secondary" : "bg-primary/12"}`}>
        <Icon name={props.add ? "plus" : "hard-drive"} class={`size-5 ${props.add ? "tint-muted-foreground" : "tint-primary"}`} />
      </View>
      <View class="gap-0.5">
        <Text class="truncate text-[15px] font-semibold text-foreground">{props.title}</Text>
        <Text class="truncate text-[12px] text-muted-foreground">{props.detail}</Text>
      </View>
    </View>
  );
}

const storageCards = (list: StorageInfo[]) => (
  <>
    <Each of={list} key={(s) => s.id}>
      {(s) => (
        <StorageCard
          title={s().name}
          detail={s().status === "error" ? "Connection problem" : s().bucket}
          onPress={() => nav.push({ name: "folder", storageId: s().id, title: s().name })}
        />
      )}
    </Each>
    <StorageCard add title="Connect" detail="A new storage" onPress={() => nav.setRoutes([{ name: "settings" }, { name: "storages" }, { name: "storage-form" }])} />
  </>
);

export function Home() {
  const storages = load<StorageInfo[]>("storage/list");
  const recent = load<FileItem[]>("file/recent");
  const starred = load<FileItem[]>("file/starred");

  return (
    <Page title="Home">
      <Loaded of={storages}>
        {(list) => (
          <If
            when={list().length > 0}
            else={
              <Empty title="Connect your first storage" detail="Fileee keeps your files in your own S3-compatible bucket.">
                <Button title="Connect storage" onPress={() => nav.push({ name: "storage-form" })} />
              </Empty>
            }
          >
            <Scroll class="flex-1" contentClass={contentClass()}>
              {/* Desktops greet (phones have the page's large title instead). */}
              <If when={platform.desktop}>
                <Text class="text-2xl font-semibold text-foreground">Welcome back, {user()?.name.trim().split(/\s+/)[0]}</Text>
              </If>

              {/* The storages as cards: a strip that scrolls sideways on phones, a grid on desktops. */}
              <View class="gap-2.5">
                <SectionTitle title="Storages" />
                <If
                  when={platform.desktop}
                  else={
                    <Scroll horizontal scrollbar={false} class="-mx-4 grow-0" contentClass="flex-row gap-3 px-4">
                      {storageCards(list())}
                    </Scroll>
                  }
                >
                  <View class="flex-row flex-wrap gap-3">{storageCards(list())}</View>
                </If>
              </View>

              <If when={(starred()?.length ?? 0) > 0}>
                <View class="gap-2">
                  <SectionTitle title="Starred" />
                  <Card class="py-2">
                    <Each of={starred() ?? []} key={(f) => f.id}>
                      {(f, i) => (
                        <View>
                          <If when={i() > 0}>{divider()}</If>
                          <FileRow file={f()} showStorage />
                        </View>
                      )}
                    </Each>
                  </Card>
                </View>
              </If>

              <View class="gap-2">
                <SectionTitle title="Recent files" />
                <If
                  when={(recent()?.length ?? 0) > 0}
                  else={<Text class="px-4 text-sm text-muted-foreground">Files you upload will show up here.</Text>}
                >
                  <Card class="py-2">
                    <Each of={recent() ?? []} key={(f) => f.id}>
                      {(f, i) => (
                        <View>
                          <If when={i() > 0}>{divider()}</If>
                          <FileRow file={f()} showStorage />
                        </View>
                      )}
                    </Each>
                  </Card>
                </If>
              </View>
            </Scroll>
          </If>
        )}
      </Loaded>
    </Page>
  );
}
