import { signal } from "nsh";
import { Button, ErrorText, Field } from "../components/ui";
import { connect, host, type SetupStatus } from "../lib/api";
import { AuthLayout } from "./auth-layout";

/** Step one: the address of the Fileee server. */
export function Connect(props: { onConnected: (status: SetupStatus) => void }) {
  const address = signal(host());
  const error = signal<string | null>(null);
  const busy = signal(false);

  const submit = async () => {
    if (!address().trim()) return error.set("Enter your Fileee server's address.");

    busy.set(true);
    error.set(null);

    try {
      props.onConnected(await connect(address()));
    } catch (e) {
      error.set(e instanceof TypeError ? "Enter a valid address." : (e as Error).message);
    } finally {
      busy.set(false);
    }
  };

  return (
    <AuthLayout title="Connect to Fileee" subtitle="Enter the address you open Fileee at in your browser.">
      <Field
        label="Server address"
        placeholder="files.example.com"
        value={address()}
        onChange={({ value }) => address.set(value)}
        onSubmit={submit}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        autoFocus
      />
      <ErrorText message={error()} />
      <Button title={busy() ? "Connecting…" : "Continue"} onPress={submit} disabled={busy()} />
    </AuthLayout>
  );
}
