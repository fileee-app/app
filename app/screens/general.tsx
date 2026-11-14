import { Scroll, signal } from "nsh";
import { Page } from "../components/page";
import { Button, contentClass, Field } from "../components/ui";
import { call } from "../lib/api";
import { run } from "../lib/run";

/** Admins only: the server's name, shown on the login page. */
export function General() {
  const appName = signal("");

  void call<{ appName: string }>("setup/status").then((s) => appName.set(s.appName));

  return (
    <Page title="General">
      <Scroll class="flex-1" contentClass={contentClass()}>
        <Field label="App name" value={appName()} onChange={(e) => appName.set(e.value)} hint="Leave blank for “Fileee”." />
        <Button title="Save" onPress={() => run(() => call("settings/update", { appName: appName() }))} />
      </Scroll>
    </Page>
  );
}
