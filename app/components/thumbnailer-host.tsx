import { WebView, type WebViewRef } from "nsh";
import { host } from "../lib/api";
import { onPageError, onPageMessage, wanted } from "../lib/thumbnailer";

/**
 * The web app's thumbnailer page in a web view nobody sees: it decodes PDFs and video for previews.
 * Loaded from the server so it has the server's origin, which the bucket's CORS rule allows.
 */
export function ThumbnailerHost() {
  let web!: WebViewRef;

  return (
    <If when={wanted()}>
      <WebView
        ref={web}
        src={`${host()}/thumbnailer`}
        scrollable={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        class="absolute -left-[2000px] top-0 h-[480px] w-[640px] opacity-0"
        onMessage={(e) => onPageMessage(e.data, web)}
        onError={(e) => onPageError(e.message)}
      />
    </If>
  );
}
