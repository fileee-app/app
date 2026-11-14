import { signal } from "nsh";
import { Button, ErrorText, Field } from "../components/ui";
import { completeSetup, host } from "../lib/api";
import { AuthLayout } from "./auth-layout";

/** A new server's first run: its name and the first admin, as the web setup page asks. */
export function Setup(props: { tokenRequired: boolean; onDone: () => void }) {
  const appName = signal("");
  const name = signal("");
  const email = signal("");
  const password = signal("");
  const setupToken = signal("");
  const error = signal<string | null>(null);
  const busy = signal(false);

  const submit = async () => {
    error.set(null);

    if (!name().trim() || !email().trim()) return error.set("Enter your name and email.");
    if (password().length < 12) return error.set("Use a password of at least 12 characters.");
    if (props.tokenRequired && !setupToken().trim()) return error.set("Enter the setup token.");

    busy.set(true);

    try {
      await completeSetup({
        appName: appName(),
        name: name(),
        email: email(),
        password: password(),
        setupToken: setupToken(),
      });
      props.onDone();
    } catch (e) {
      error.set((e as Error).message);
    } finally {
      busy.set(false);
    }
  };

  return (
    <AuthLayout title="Set up Fileee" subtitle={`${host()} is new. Name it and create the first admin account.`}>
      <Field label="App name (optional)" value={appName()} onChange={(e) => appName.set(e.value)} placeholder="Fileee" />
      <Field label="Your name" value={name()} onChange={(e) => name.set(e.value)} autoComplete="name" />
      <Field
        label="Email"
        value={email()}
        onChange={(e) => email.set(e.value)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      <Field
        label="Password"
        value={password()}
        onChange={(e) => password.set(e.value)}
        masked
        autoComplete="new-password"
        hint="At least 12 characters."
      />
      <If when={props.tokenRequired}>
        <Field
          label="Setup token"
          value={setupToken()}
          onChange={(e) => setupToken.set(e.value)}
          autoCapitalize="none"
          autoCorrect={false}
          hint="The SETUP_TOKEN the server was started with."
        />
      </If>
      <ErrorText message={error()} />
      <Button title={busy() ? "Setting up…" : "Create admin account"} onPress={submit} disabled={busy()} />
    </AuthLayout>
  );
}
