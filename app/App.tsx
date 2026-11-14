import { effect, mount, platform, Text, View } from "nsh";
import { NavPage, NavStack } from "nsh/base";
import { isAvailable as hasMenuBar, Menu, Window } from "nsh/desktop";
import { TabBar } from "nsh/mobile";
import { ChoiceSheetHost } from "./components/choice-sheet";
import { FolderPickerHost } from "./components/folder-picker";
import { createHeader, Header } from "./components/page";
import { PromptHost } from "./components/prompt";
import { ServerMenuHost } from "./components/server-menu";
import { UploadSheetHost } from "./components/upload-sheet";
import { Sidebar } from "./components/sidebar";
import { ThumbnailerHost } from "./components/thumbnailer-host";
import { UploadTray } from "./components/upload-tray";
import { Button } from "./components/ui";
import { appName, host, restore, signOut } from "./lib/api";
import { nav, openSection, section, stack, tabBarHeight, type Route, type Section } from "./lib/nav";
import { enterMain, openServer, returnTo, signedOut, stage } from "./lib/stage";
import { Account } from "./screens/account";
import { Connect } from "./screens/connect";
import { FilePage } from "./screens/file";
import { FolderPage } from "./screens/folder";
import { General } from "./screens/general";
import { Home } from "./screens/home";
import { Login } from "./screens/login";
import { Missing } from "./screens/missing";
import { Search } from "./screens/search";
import { Settings } from "./screens/settings";
import { Setup } from "./screens/setup";
import { SharePage } from "./screens/share";
import { StorageForm } from "./screens/storage-form";
import { Storages } from "./screens/storages";
import { Trash } from "./screens/trash";
import { Users } from "./screens/users";

// A saved session that ended moves on to the next server; a server that's down shows its login screen.
restore()
  .then((signedIn) => (signedIn ? enterMain() : signedOut()))
  .catch(() => stage.set(host() ? { name: "login", appName: appName() } : { name: "connect" }));

function Screen(props: { route: Route }) {
  const r = props.route;

  switch (r.name) {
    case "home":
      return <Home />;
    case "search":
      return <Search />;
    case "trash":
      return <Trash />;
    case "settings":
      return <Settings />;
    case "folder":
      return <FolderPage storageId={r.storageId} folderId={r.folderId} title={r.title} />;
    case "file":
      return <FilePage fileId={r.fileId} title={r.title} />;
    case "missing":
      return <Missing storageId={r.storageId} />;
    case "share":
      return <SharePage fileId={r.fileId} folderId={r.folderId} title={r.title} />;
    case "account":
      return <Account />;
    case "general":
      return <General />;
    case "storages":
      return <Storages />;
    case "storage-form":
      return <StorageForm storage={r.storage} />;
    case "users":
      return <Users />;
  }
}

const SECTIONS: Section[] = ["home", "search", "trash", "settings"];

const TABS = [
  { title: "Home", icon: platform.select({ ios: "house", android: "android:ic_menu_gallery" }) },
  { title: "Search", icon: platform.select({ ios: "magnifyingglass", android: "android:ic_menu_search" }) },
  { title: "Trash", icon: platform.select({ ios: "trash", android: "android:ic_menu_delete" }) },
  { title: "Settings", icon: platform.select({ ios: "gearshape", android: "android:ic_menu_preferences" }) },
];

/** The desktops' window chrome and menu bar: the sections with their shortcuts, and text editing for the fields. */
function useMenuBar() {
  if (!hasMenuBar) return;

  // The app draws the window's top: the sidebar holds the traffic lights, each page its toolbar.
  effect(() => Window.get("main")?.set({ titleBar: { style: "hidden", height: 52 } }));

  effect(() =>
    Menu.setApplicationMenu([
      {
        label: "Fileee",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { label: "Settings…", shortcut: "mod+,", onSelect: () => openSection("settings") },
          { label: "Sign out", onSelect: () => void signOut().then(signedOut) },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "showAll" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
      },
      {
        label: "Go",
        submenu: [
          { label: "Home", shortcut: "mod+1", onSelect: () => openSection("home") },
          { label: "Search", shortcut: "mod+k", onSelect: () => openSection("search") },
          { label: "Trash", shortcut: "mod+3", onSelect: () => openSection("trash") },
          { label: "Back", shortcut: "mod+[", disabled: nav.routes().length < 2, onSelect: () => nav.pop() },
        ],
      },
      { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "toggleFullScreen" }, { type: "separator" }, { role: "close" }] },
    ]),
  );
}

/** Signed in: a sidebar beside the stack on desktops, a tab bar under it on phones. */
function Main() {
  useMenuBar();

  return (
    <View class="flex-1 flex-row bg-background">
      <If when={platform.desktop}>
        <Sidebar />
      </If>
      <View class="flex-1">
        {/* A new stack per section: keyed by the stack, so switching sections mounts a fresh one. */}
        <Each of={[stack()]}>
          {(s) => (
            <NavStack state={s()} style={{ flex: 1 }}>
              {(route) => {
                // Returned straight from here: NavStack takes a NavPage only from its child function.
                // Phones' pages draw their header themselves (Page); a tab's own page has the server menu.
                const header = createHeader(SECTIONS.includes(route.name as Section));

                return (
                  <NavPage title={header.title()} headerVisible={false} class="bg-background">
                    <Header.Provider value={platform.desktop ? null : header}>
                      <Screen route={route} />
                    </Header.Provider>
                  </NavPage>
                );
              }}
            </NavStack>
          )}
        </Each>
        <UploadTray />
        <If when={!platform.desktop}>
          <TabBar
            class="absolute bottom-0 left-0 right-0"
            onLayout={(e) => tabBarHeight.set(e.bounds.size.height)}
            items={TABS}
            selectedIndex={SECTIONS.indexOf(section())}
            onChange={({ index }) => openSection(SECTIONS[index]!)}
          />
        </If>
      </View>
      <PromptHost />
      <FolderPickerHost />
      <UploadSheetHost />
      <ChoiceSheetHost />
      <ServerMenuHost />
      <ThumbnailerHost />
    </View>
  );
}

/** Adding a server: back to the one in use. */
const CancelAdd = () => (
  <If when={returnTo()}>
    {(server) => (
      <View class="absolute left-0 top-0 pl-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Button title={`Back to ${server().appName}`} icon="chevron-left" variant="secondary" onPress={() => void openServer(server())} />
      </View>
    )}
  </If>
);

function App() {
  return (
    <View class="flex-1 bg-background">
      {(() => {
        const s = stage();

        switch (s.name) {
          case "loading":
            return (
              <View class="flex-1 items-center justify-center">
                <Text class="text-sm text-muted-foreground">Loading…</Text>
              </View>
            );
          case "connect":
            return (
              <Connect
                onConnected={(status) =>
                  stage.set(
                    status.complete
                      ? { name: "login", appName: status.appName }
                      : { name: "setup", tokenRequired: status.setupTokenRequired },
                  )
                }
              />
            );
          case "setup":
            return <Setup tokenRequired={s.tokenRequired} onDone={enterMain} />;
          case "login":
            return (
              <Login
                appName={s.appName}
                onSignedIn={enterMain}
                onChangeServer={() => stage.set({ name: "connect" })}
              />
            );
          case "main":
            return <Main />;
        }
      })()}
      <If when={stage().name !== "main" && stage().name !== "loading"}>
        <CancelAdd />
      </If>
    </View>
  );
}

mount(App);
