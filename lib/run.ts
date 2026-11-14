import { AlertDialog } from "nsh/base";
import { changed } from "./api";

/** Runs a user action: reloads lists after it, and shows its error instead of failing silently. */
export async function run(action: () => Promise<unknown>) {
  try {
    await action();
    changed();

    return true;
  } catch (error) {
    await AlertDialog.show({
      title: "That didn't work",
      description: error instanceof Error ? error.message : String(error),
      actions: [{ label: "OK", id: "ok", role: "cancel" }],
    });

    return false;
  }
}

/** Asks before something that can't be undone. */
export async function confirm(title: string, description: string, label: string) {
  const { action } = await AlertDialog.show({
    title,
    description,
    actions: [
      { label: "Cancel", id: "cancel", role: "cancel" },
      { label, id: "ok", role: "destructive" },
    ],
  });

  return action === "ok";
}
