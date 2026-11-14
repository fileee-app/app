import { FileDetailsView } from "../components/file-details";
import { Loaded } from "../components/loaded";
import { Page } from "../components/page";
import { contentClass } from "../components/ui";
import { load } from "../lib/load";
import { nav } from "../lib/nav";
import type { FileDetails } from "../lib/types";

export function FilePage(props: { fileId: string; title: string }) {
  const { fileId } = props;
  const file = load<FileDetails>("file/get", () => ({ fileId }));

  return (
    <Page title={file()?.name ?? props.title}>
      <Loaded of={file}>{(f) => <FileDetailsView file={f()} onTrashed={() => nav.pop()} class={contentClass()} />}</Loaded>
    </Page>
  );
}
