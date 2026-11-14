import { Scroll, View } from "nsh";
import { Page } from "../components/page";
import { Card, contentClass, Row } from "../components/ui";
import { user } from "../lib/api";
import { nav } from "../lib/nav";

export function Settings() {
  return (
    <Page title="Settings">
      <Scroll class="flex-1" contentClass={contentClass()}>
        <Card>
          <Row icon="user-round" tile tint="tint-blue-500" chevron title="Account" subtitle={user()?.email} onPress={() => nav.push({ name: "account" })} />
          <Row icon="hard-drive" tile tint="tint-green-500" chevron title="Storages" subtitle="Where your files are kept" onPress={() => nav.push({ name: "storages" })} />
          <If when={user()?.role === "admin"}>
            <View>
              <Row icon="settings" tile tint="tint-slate-500" chevron title="General" subtitle="The server's name" onPress={() => nav.push({ name: "general" })} />
              <Row icon="users-round" tile tint="tint-orange-500" chevron title="Users" subtitle="Who can sign in" onPress={() => nav.push({ name: "users" })} />
            </View>
          </If>
        </Card>
      </Scroll>
    </Page>
  );
}
