import { signal } from "nsh";
import { Button, ErrorText, Field } from "../components/ui";
import { changeServer, host, signIn } from "../lib/api";
import { AuthLayout } from "./auth-layout";

/** Step two: email and password, the same account as the web app. */
export function Login(props: { appName: string; onSignedIn: () => void; onChangeServer: () => void }) {
  const email = signal("");
  const password = signal("");
  const error = signal<string | null>(null);
  const busy = signal(false);

  const submit = async () => {
    if (!email().trim() || !password()) return error.set("Enter your email and password.");

    busy.set(true);
    error.set(null);

    try {
      await signIn(email(), password());
      props.onSignedIn();
    } catch (e) {
      error.set((e as Error).message);
    } finally {
      busy.set(false);
    }
  };

  return (
    <AuthLayout title={`Sign in to ${props.appName}`} subtitle={host()}>
      <Field
        label="Email"
        value={email()}
        onChange={({ value }) => email.set(value)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        autoFocus
      />
      <Field
        label="Password"
        value={password()}
        onChange={({ value }) => password.set(value)}
        onSubmit={submit}
        masked
        autoComplete="current-password"
        returnKeyType="go"
      />
      <ErrorText message={error()} />
      <Button title={busy() ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy()} />
      <Button
        title="Use another server"
        variant="ghost"
        onPress={async () => {
          await changeServer();
          props.onChangeServer();
        }}
      />
    </AuthLayout>
  );
}
