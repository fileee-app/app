import { Scroll, signal, Text, View } from "nsh";
import { Page } from "../components/page";
import { Button, Card, contentClass, ErrorText, Field, SectionTitle } from "../components/ui";
import { call, host, signOut, user } from "../lib/api";
import { addServer, signedOut } from "../lib/stage";
import { run } from "../lib/run";

export function Account() {
  const name = signal(user()?.name ?? "");
  const current = signal("");
  const next = signal("");
  const error = signal<string | null>(null);

  const saveName = () =>
    run(async () => {
      await call("auth/updateProfile", { name: name() });
      user.update((u) => u && { ...u, name: name().trim() });
    });

  const changePassword = async () => {
    error.set(null);

    if (next().length < 12) return error.set("Use at least 12 characters.");

    if (await run(() => call("auth/changePassword", { currentPassword: current(), newPassword: next() }))) {
      current.set("");
      next.set("");
    }
  };

  return (
    <Page title="Account">
      <Scroll class="flex-1" contentClass={contentClass()}>
        <View class="gap-3">
          <SectionTitle title="Profile" />
          <Field label="Name" value={name()} onChange={(e) => name.set(e.value)} />
          <Text class="px-1 text-sm text-muted-foreground">{user()?.email}</Text>
          <Button title="Save name" onPress={saveName} />
        </View>

        <View class="gap-3">
          <SectionTitle title="Password" />
          <Field label="Current password" value={current()} onChange={(e) => current.set(e.value)} masked autoComplete="current-password" />
          <Field label="New password" value={next()} onChange={(e) => next.set(e.value)} masked autoComplete="new-password" hint="At least 12 characters." />
          <ErrorText message={error()} />
          <Button title="Change password" onPress={changePassword} />
        </View>

        <View class="gap-3">
          <SectionTitle title="Server" />
          <Card class="p-4">
            <Text class="text-sm text-foreground">{host()}</Text>
          </Card>
          <Button title="Sign out" variant="secondary" onPress={async () => (await signOut(), signedOut())} />
          <Button title="Add another server" variant="ghost" onPress={addServer} />
        </View>
      </Scroll>
    </Page>
  );
}
