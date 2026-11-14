import { Clipboard, openUrl, Scroll, signal, Text, View } from "nsh";
import { Chips } from "../components/chips";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { Action, Button, Card, contentClass, ErrorText, Field, SectionTitle } from "../components/ui";
import { call } from "../lib/api";
import { formatDate } from "../lib/format";
import { load } from "../lib/load";
import { confirm, run } from "../lib/run";
import type { ShareLink } from "../lib/types";

const EXPIRY = [
  { value: "never", label: "Never" },
  { value: "1h", label: "1 hour" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const;

type Expiry = (typeof EXPIRY)[number]["value"];

interface PublicStatus {
  available: boolean;
  blockedBy: string | null;
  copy: { url: string; publishedAt: string; outOfDate: boolean } | null;
}

const copy = (url: string) => run(() => Clipboard.writeText(url));

function linkState(link: ShareLink) {
  if (link.revokedAt) return "Revoked";
  if (!link.url) return "Expired";

  return link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : "Never expires";
}

/** Share links for a file or folder, and a file's public copy. */
export function SharePage(props: { fileId?: string; folderId?: string; title: string }) {
  const target = { fileId: props.fileId, folderId: props.folderId };
  const links = load<ShareLink[]>("share/list", () => target);
  const expiry = signal<Expiry>("7d");
  const password = signal("");
  const error = signal<string | null>(null);

  const create = async () => {
    error.set(null);

    if (password() && password().length < 8) return error.set("Use at least 8 characters, or leave the password blank.");

    const ok = await run(async () => {
      const link = await call<{ url: string }>("share/create", { ...target, expiry: expiry(), password: password() });

      await Clipboard.writeText(link.url);
    });

    if (ok) password.set("");
  };

  return (
    <Page title={`Share ${props.title}`}>
      <Scroll class="flex-1" contentClass={contentClass()}>
        <View class="gap-3">
          <SectionTitle title="New link" />
          <Text class="px-1 text-sm text-muted-foreground">Anyone with the link can view and download. It's copied when you create it.</Text>
          <Chips options={[...EXPIRY]} value={expiry()} onChange={(v) => expiry.set(v)} />
          <Field label="Password (optional)" value={password()} onChange={(e) => password.set(e.value)} masked />
          <ErrorText message={error()} />
          <Button title="Create link" onPress={create} />
        </View>

        <View class="gap-2">
          <SectionTitle title="Links" />
          <Loaded of={links}>
            {(list) => (
              <If when={list().length > 0} else={<Text class="px-1 text-sm text-muted-foreground">No links yet.</Text>}>
                <Card>
                  <Each of={list()} key={(l) => l.id}>
                    {(l) => (
                      <View class="gap-1 border-b border-border px-4 py-3">
                        <Text class="truncate text-sm text-foreground">{l().url ?? "—"}</Text>
                        <Text class="text-xs text-muted-foreground">
                          {linkState(l())} · {l().hasPassword ? "Password · " : ""}
                          {l().downloadCount} downloads
                        </Text>
                        <If when={l().url}>
                          <View class="flex-row gap-1">
                            <Action title="Copy" onPress={() => copy(l().url!)} />
                            <Action title="Open" onPress={() => openUrl(l().url!)} />
                            <Action
                              title="Revoke"
                              destructive
                              onPress={async () =>
                                (await confirm("Revoke link?", "It stops working at once.", "Revoke")) &&
                                run(() => call("share/revoke", { linkId: l().id }))
                              }
                            />
                          </View>
                        </If>
                      </View>
                    )}
                  </Each>
                </Card>
              </If>
            )}
          </Loaded>
        </View>

        <If when={props.fileId}>
          <PublicCopy fileId={props.fileId!} />
        </If>
      </Scroll>
    </Page>
  );
}

function PublicCopy(props: { fileId: string }) {
  const { fileId } = props;
  const status = load<PublicStatus>("share/publicStatus", () => ({ fileId }));

  return (
    <View class="gap-2">
      <SectionTitle title="Public copy" />
      <Loaded of={status}>
        {(s) => (
          <Card class="gap-3 p-4">
            <If
              when={s().available}
              else={<Text class="text-sm text-muted-foreground">Set up public access for this storage in Settings › Storages first.</Text>}
            >
              <Text class="text-sm text-muted-foreground">
                A permanent copy on your CDN, for embedding. It stays public until you remove it.
              </Text>
              <ErrorText message={s().blockedBy} />
              <If
                when={s().copy}
                else={<Button title="Publish" onPress={() => run(() => call("share/publish", { fileId }))} />}
              >
                {(c) => (
                  <View class="gap-2">
                    <Text class="text-sm text-foreground">{c().url}</Text>
                    <If when={c().outOfDate}>
                      <Text class="text-xs text-destructive">The file changed since it was published. Publish again to update it.</Text>
                    </If>
                    <View class="flex-row flex-wrap gap-2">
                      <Button title="Copy" variant="secondary" onPress={() => copy(c().url)} />
                      <If when={c().outOfDate}>
                        <Button title="Publish again" variant="secondary" onPress={() => run(() => call("share/publish", { fileId }))} />
                      </If>
                      <Button
                        title="Remove"
                        variant="destructive"
                        onPress={async () =>
                          (await confirm("Remove public copy?", "Its URL stops working.", "Remove")) &&
                          run(() => call("share/unpublish", { fileId }))
                        }
                      />
                    </View>
                  </View>
                )}
              </If>
            </If>
          </Card>
        )}
      </Loaded>
    </View>
  );
}
