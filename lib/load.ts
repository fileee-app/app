import { resource } from "nsh";
import { call, changes } from "./api";

/** A procedure's result, loaded again after every change the app makes. */
export const load = <T>(path: string, input?: () => unknown) =>
  resource(
    () => ({ n: changes(), input: input?.() }),
    (source) => call<T>(path, source.input),
  );
