import { Scroll, signal, View } from "nsh";
import { AlertDialog } from "nsh/base";
import { Chips } from "../components/chips";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { prompt } from "../components/prompt";
import { Button, Card, contentClass, ErrorText, Field, Row, SectionTitle } from "../components/ui";
import { call, user as me } from "../lib/api";
import { load } from "../lib/load";
import { confirm, run } from "../lib/run";
import type { User } from "../lib/types";

async function userMenu(user: User) {
  const { action } = await AlertDialog.show({
    title: user.name,
    description: user.email,
    presentation: "actionSheet",
    actions: [
      { label: "Reset password", id: "reset" },
      { label: user.disabledAt ? "Enable" : "Disable", id: "disable" },
      { label: "Delete", id: "remove", role: "destructive" },
      { label: "Cancel", id: "cancel", role: "cancel" },
    ],
  });

  if (action === "reset") {
    const password = await prompt({ title: `New password for ${user.name}`, label: "At least 12 characters", value: "", confirm: "Reset", masked: true });

    if (password !== null) await run(() => call("user/resetPassword", { userId: user.id, password }));
  }

  if (action === "disable") await run(() => call("user/setDisabled", { userId: user.id, disabled: !user.disabledAt }));

  if (action === "remove" && (await confirm(`Delete ${user.name}?`, "This removes their account and their connected storages from Fileee. Files in their buckets aren't touched.", "Delete"))) {
    await run(() => call("user/remove", { userId: user.id }));
  }
}

/** Admins only: who can sign in. */
export function Users() {
  const users = load<User[]>("user/list");
  const name = signal("");
  const email = signal("");
  const password = signal("");
  const role = signal<"user" | "admin">("user");
  const error = signal<string | null>(null);

  const create = async () => {
    error.set(null);

    if (!name().trim() || !email().trim()) return error.set("Enter a name and email.");
    if (password().length < 12) return error.set("Use a password of at least 12 characters.");

    if (await run(() => call("user/create", { name: name(), email: email(), password: password(), role: role() }))) {
      name.set("");
      email.set("");
      password.set("");
    }
  };

  return (
    <Page title="Users">
      <Scroll class="flex-1" contentClass={contentClass()}>
        <Loaded of={users}>
          {(list) => (
            <Card>
              <Each of={list()} key={(u) => u.id}>
                {(u) => (
                  <Row
                    icon="user-round"
                    title={`${u().name}${u().id === me()?.id ? " (you)" : ""}`}
                    subtitle={`${u().email} · ${u().role === "admin" ? "Admin" : "User"}${u().disabledAt ? " · Disabled" : ""}`}
                    muted={Boolean(u().disabledAt)}
                    onPress={() => userMenu(u())}
                  />
                )}
              </Each>
            </Card>
          )}
        </Loaded>

        <View class="gap-3">
          <SectionTitle title="Add a user" />
          <Field label="Name" value={name()} onChange={(e) => name.set(e.value)} />
          <Field label="Email" value={email()} onChange={(e) => email.set(e.value)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Field label="Password" value={password()} onChange={(e) => password.set(e.value)} masked autoComplete="new-password" hint="At least 12 characters. Share it with them safely." />
          <Chips
            options={[
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ]}
            value={role()}
            onChange={(v) => role.set(v)}
          />
          <ErrorText message={error()} />
          <Button title="Add user" onPress={create} />
        </View>
      </Scroll>
    </Page>
  );
}
