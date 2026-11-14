import { Scroll, signal, Text, View } from "nsh";
import { Switch } from "nsh/base";
import { Page } from "../components/page";
import { SelectField } from "../components/select-field";
import { Button, Card, contentClass, ErrorText, Field, SectionTitle } from "../components/ui";
import { call } from "../lib/api";
import { formatDate } from "../lib/format";
import { load } from "../lib/load";
import { backfill } from "../lib/process";
import { nav } from "../lib/nav";
import { confirm, run } from "../lib/run";
import type { Provider, StorageInfo } from "../lib/types";

// Mirrors PROVIDERS in the web repo's packages/api/src/schemas.ts.
const PROVIDERS: Record<Provider, { label: string; endpoint: string; region: string; forcePathStyle: boolean }> = {
  s3: { label: "AWS S3", endpoint: "", region: "us-east-1", forcePathStyle: false },
  r2: { label: "Cloudflare R2", endpoint: "https://<account>.r2.cloudflarestorage.com", region: "auto", forcePathStyle: false },
  b2: { label: "Backblaze B2", endpoint: "https://s3.<region>.backblazeb2.com", region: "", forcePathStyle: false },
  wasabi: { label: "Wasabi", endpoint: "https://s3.<region>.wasabisys.com", region: "", forcePathStyle: false },
  tigris: { label: "Tigris", endpoint: "https://t3.storage.dev", region: "auto", forcePathStyle: false },
  spaces: { label: "DigitalOcean Spaces", endpoint: "https://<region>.digitaloceanspaces.com", region: "", forcePathStyle: false },
  hetzner: { label: "Hetzner", endpoint: "https://<region>.your-objectstorage.com", region: "", forcePathStyle: false },
  scaleway: { label: "Scaleway", endpoint: "https://s3.<region>.scw.cloud", region: "", forcePathStyle: false },
  linode: { label: "Akamai (Linode)", endpoint: "https://<region>.linodeobjects.com", region: "", forcePathStyle: false },
  vultr: { label: "Vultr", endpoint: "https://<region>.vultrobjects.com", region: "", forcePathStyle: false },
  ovh: { label: "OVHcloud", endpoint: "https://s3.<region>.io.cloud.ovh.net", region: "", forcePathStyle: false },
  minio: { label: "MinIO", endpoint: "http://localhost:9000", region: "us-east-1", forcePathStyle: true },
  other: { label: "S3-compatible", endpoint: "", region: "", forcePathStyle: false },
};

const OPTIONS = (Object.keys(PROVIDERS) as Provider[]).map((value) => ({ value, label: PROVIDERS[value].label }));

interface TestResult {
  ok: boolean;
  steps: { step: string; ok: boolean; error?: string; fix?: string }[];
}

/** Connects a new storage, or edits one: its connection, sync, CORS and public access. */
export function StorageForm(props: { storage?: StorageInfo }) {
  const existing = props.storage;
  const start = existing ?? { name: "", provider: "s3" as Provider, ...PROVIDERS.s3, bucket: "", prefix: "" };
  const name = signal(start.name);
  const provider = signal<Provider>(start.provider);
  const endpoint = signal(start.endpoint);
  const region = signal(start.region);
  const bucket = signal(start.bucket);
  const prefix = signal(start.prefix);
  const forcePathStyle = signal(start.forcePathStyle);
  const accessKeyId = signal("");
  const secretAccessKey = signal("");
  const error = signal<string | null>(null);

  const pickProvider = (value: Provider) => {
    provider.set(value);
    endpoint.set(PROVIDERS[value].endpoint);
    region.set(PROVIDERS[value].region);
    forcePathStyle.set(PROVIDERS[value].forcePathStyle);
  };

  const save = async () => {
    error.set(null);

    if (!name().trim() || !bucket().trim() || !region().trim()) return error.set("Enter a name, region and bucket.");
    if (!existing && (!accessKeyId().trim() || !secretAccessKey().trim())) return error.set("Enter the access key ID and secret.");
    if (provider() !== "s3" && !endpoint().trim()) return error.set("Enter the endpoint URL.");

    const input = {
      name: name(),
      provider: provider(),
      endpoint: endpoint(),
      region: region(),
      bucket: bucket(),
      prefix: prefix(),
      forcePathStyle: forcePathStyle(),
      accessKeyId: accessKeyId(),
      secretAccessKey: secretAccessKey(),
    };

    if (await run(() => (existing ? call("storage/update", { ...input, storageId: existing.id }) : call("storage/create", input)))) {
      nav.pop();
    }
  };

  return (
    <Page title={existing ? existing.name : "Connect storage"}>
      <Scroll class="flex-1" contentClass={contentClass()}>
        <View class="gap-3">
          <SelectField label="Provider" options={OPTIONS} value={provider()} onChange={pickProvider} />
          <Field label="Name" value={name()} onChange={(e) => name.set(e.value)} placeholder="Photos" />
          <Field
            label="Endpoint"
            value={endpoint()}
            onChange={(e) => endpoint.set(e.value)}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={provider() === "s3" ? "Optional" : "https://s3.example.com"}
            hint={provider() === "s3" ? "Leave blank for AWS." : "Replace the <placeholders> with yours."}
          />
          <Field label="Region" value={region()} onChange={(e) => region.set(e.value)} autoCapitalize="none" autoCorrect={false} placeholder="us-east-1" />
          <Field label="Bucket" value={bucket()} onChange={(e) => bucket.set(e.value)} autoCapitalize="none" autoCorrect={false} placeholder="my-files" />
          <Field
            label="Prefix (optional)"
            value={prefix()}
            onChange={(e) => prefix.set(e.value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="fileee/"
            hint="Keep Fileee's files under this folder of the bucket."
          />
          <View class="flex-row items-center justify-between">
            <Text class="text-sm font-medium text-foreground">Path-style URLs</Text>
            <Switch
              checked={forcePathStyle()}
              onChange={(e) => forcePathStyle.set(e.checked)}
              class="h-6 w-11 rounded-full bg-input p-0.5 checked:bg-primary"
              thumbClass="size-5 rounded-full bg-background checked:translate-x-5"
            />
          </View>
          <Field
            label="Access key ID"
            value={accessKeyId()}
            onChange={(e) => accessKeyId.set(e.value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={existing?.accessKeyHint ? `Unchanged (…${existing.accessKeyHint})` : "AKIAIOSFODNN7EXAMPLE"}
          />
          <Field
            label="Secret access key"
            value={secretAccessKey()}
            onChange={(e) => secretAccessKey.set(e.value)}
            masked
            placeholder={existing ? "Unchanged" : "Your secret key"}
          />
          <ErrorText message={error()} />
          <Button title={existing ? "Save" : "Connect"} onPress={save} />
        </View>

        <If when={existing}>
          {(s) => <Manage storage={s()} />}
        </If>
      </Scroll>
    </Page>
  );
}

function Manage(props: { storage: StorageInfo }) {
  const { storage } = props;
  const storageId = storage.id;
  const result = signal<TestResult | null>(null);
  const sync = load<{ run: { status: string; finishedAt: string | null; added: number; updated: number; markedMissing: number; error: string | null } | null; missing: number }>(
    "storage/syncStatus",
    () => ({ storageId }),
  );
  const cors = signal<string | null>(null);
  const previews = signal<string | null>(null);
  const backfilling = signal<AbortController | null>(null);
  const cdnBaseUrl = signal(storage.cdnBaseUrl ?? "");
  const publicBucket = signal(storage.publicBucket ?? "");
  const publicPrefix = signal(storage.publicPrefix ?? "");

  const test = () => run(async () => result.set(await call<TestResult>("storage/test", { storageId })));

  const showCors = () =>
    run(async () => {
      const info = await call<{ rule: unknown }>("storage/corsInfo", { storageId });

      cors.set(JSON.stringify([info.rule], null, 2));
    });

  const progress = (word: string, done: number, failed: number) =>
    `${word}: ${done} processed${failed ? `, ${failed} couldn't be read` : ""}`;

  const generate = async () => {
    const controller = new AbortController();

    backfilling.set(controller);
    previews.set(progress("Working", 0, 0));
    await run(async () => {
      const { done, failed } = await backfill(storageId, controller.signal, (d, f) => previews.set(progress("Working", d, f)));

      previews.set(progress("Finished", done, failed));
    });
    backfilling.set(null);
  };

  const remove = async () => {
    const ok = await confirm(
      `Remove ${storage.name}?`,
      "Fileee forgets this connection and its folders. Files in the bucket aren't deleted. Public copies are deleted, and their links stop working.",
      "Remove",
    );

    if (ok && (await run(() => call("storage/remove", { storageId })))) nav.pop();
  };

  return (
    <View class="gap-6">
      <View class="gap-3">
        <SectionTitle title="Connection" />
        <Text class="px-1 text-sm text-muted-foreground">Last checked {formatDate(storage.lastCheckedAt)}.</Text>
        <Button title="Check connection" variant="secondary" onPress={test} />
        <If when={result()}>
          {(r) => (
            <Card>
              <Each of={r().steps}>
                {(s) => (
                  <View class="gap-1 border-b border-border px-4 py-2">
                    <Text class={`text-sm ${s().ok ? "text-foreground" : "text-destructive"}`}>
                      {s().ok ? "✓" : "✕"} {s().step}
                    </Text>
                    <If when={s().error}>
                      <Text class="text-xs text-muted-foreground">
                        {s().error} {s().fix ?? ""}
                      </Text>
                    </If>
                  </View>
                )}
              </Each>
            </Card>
          )}
        </If>
      </View>

      <View class="gap-3">
        <SectionTitle title="Sync" />
        <Text class="px-1 text-sm text-muted-foreground">
          {sync()?.run
            ? `Last sync ${sync()!.run!.status}${sync()!.run!.finishedAt ? ` ${formatDate(sync()!.run!.finishedAt)}` : ""}: ${sync()!.run!.added} added, ${sync()!.run!.updated} updated, ${sync()!.run!.markedMissing} missing.`
            : "Not synced yet."}
        </Text>
        <ErrorText message={sync()?.run?.error} />
        <View class="flex-row flex-wrap gap-2">
          <Button title="Sync now" variant="secondary" onPress={() => run(() => call("storage/sync", { storageId }))} />
          <If when={(sync()?.missing ?? 0) > 0}>
            <Button title={`${sync()!.missing} missing`} variant="secondary" onPress={() => nav.push({ name: "missing", storageId })} />
          </If>
        </View>
      </View>

      <View class="gap-3">
        <SectionTitle title="Browser access (CORS)" />
        <Text class="px-1 text-sm text-muted-foreground">
          The web app uploads straight to the bucket, which needs a CORS rule for your server's address. This app doesn't.
        </Text>
        <View class="flex-row flex-wrap gap-2">
          <Button title="Apply CORS rule" variant="secondary" onPress={() => run(() => call("storage/applyCors", { storageId }))} />
          <Button title="Show rule" variant="ghost" onPress={showCors} />
        </View>
        <If when={cors()}>
          <Text class="select-text rounded-lg bg-muted p-3 font-mono text-xs text-foreground">{cors()}</Text>
        </If>
      </View>

      <View class="gap-3">
        <SectionTitle title="Thumbnails" />
        <Text class="px-1 text-sm text-muted-foreground">
          This device downloads files that have no thumbnail or details yet, such as imported ones, and processes them here. Your provider may charge for the download. Keep the app open while it runs.
        </Text>
        <If
          when={backfilling()}
          else={<Button title="Backfill thumbnails" variant="secondary" onPress={generate} />}
        >
          <Button title="Stop" variant="secondary" onPress={() => backfilling()?.abort()} />
        </If>
        <If when={previews()}>
          <Text class="px-1 text-sm text-foreground">{previews()}</Text>
        </If>
      </View>

      <View class="gap-3">
        <SectionTitle title="Public access" />
        <Text class="px-1 text-sm text-muted-foreground">
          A CDN in front of a public bucket lets you publish permanent copies of files. Leave the CDN URL blank to turn it off.
        </Text>
        <Field label="CDN URL" value={cdnBaseUrl()} onChange={(e) => cdnBaseUrl.set(e.value)} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
        <Field label="Public bucket" value={publicBucket()} onChange={(e) => publicBucket.set(e.value)} autoCapitalize="none" autoCorrect={false} />
        <Field label="Public prefix (optional)" value={publicPrefix()} onChange={(e) => publicPrefix.set(e.value)} autoCapitalize="none" autoCorrect={false} />
        <Button
          title="Save public access"
          variant="secondary"
          onPress={() =>
            run(() => call("storage/setPublicAccess", { storageId, cdnBaseUrl: cdnBaseUrl(), publicBucket: publicBucket(), publicPrefix: publicPrefix() }))
          }
        />
      </View>

      <Button title="Remove storage" variant="destructive" onPress={remove} />
    </View>
  );
}
