import type { UrlChangedMessage } from "../types.js";

/**
 * Whether a chrome.webNavigation.onHistoryStateUpdated event is for the
 * tab's top-level document (as opposed to an iframe doing its own
 * client-side routing, e.g. an embedded widget) — only top-level
 * navigations should trigger a highlight re-render.
 */
export function shouldNotifyUrlChange(details: { frameId: number }): boolean {
  return details.frameId === 0;
}

/** Type guard for the `url_changed` message background.ts sends to content scripts. */
export function isUrlChangedMessage(
  message: unknown,
): message is UrlChangedMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "url_changed"
  );
}
