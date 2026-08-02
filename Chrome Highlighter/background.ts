import { ensureFreshSession } from "./lib/auth.js";
import { shouldNotifyUrlChange } from "./lib/urlChange.js";
import type {
  GetHighlightsMessage,
  GetHighlightsResponse,
  AddHighlightsMessage,
  AddHighlightsResponse,
  UrlChangedMessage,
} from "./types.js";

console.log("loaded");

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("popups/popup.html") });
  }
});

/**
 * SPA (same-document) navigations — e.g. clicking an in-app link on a site
 * using history.pushState/replaceState routing — don't re-inject content
 * scripts, so displayHistory.ts never gets a chance to re-run on its own.
 * This forwards a url_changed message so it can.
 */
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (!shouldNotifyUrlChange(details)) return;
  const message: UrlChangedMessage = { type: "url_changed", url: details.url };
  chrome.tabs.sendMessage(details.tabId, message).catch(() => {
    // No content script in this tab (e.g. non-matching origin) — expected, not an error.
  });
});

function clearAuthBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

function setAuthBadge(): void {
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
}

function handleGetHighlights(
  message: GetHighlightsMessage,
  _sender: chrome.runtime.MessageSender,
  senderResponse: (response: GetHighlightsResponse) => void,
): true {
  (async () => {
    const session = await ensureFreshSession();
    if (!session) {
      setAuthBadge();
      senderResponse({ error: "auth_required" });
      return;
    }

    const url = new URL("http://localhost:3000/highlights");
    url.search = new URLSearchParams({ url: message.url }).toString();
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${session.sessionToken}` },
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      clearAuthBadge();
      senderResponse({ highlights: data });
    } catch (err) {
      senderResponse({ error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true;
}

function handleAddHighlights(
  message: AddHighlightsMessage,
  _sender: chrome.runtime.MessageSender,
  senderResponse: (response: AddHighlightsResponse) => void,
): true {
  (async () => {
    const session = await ensureFreshSession();
    if (!session) {
      setAuthBadge();
      senderResponse({ error: "auth_required" });
      return;
    }

    const url = new URL("http://localhost:3000/addhighlight");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          url: message.url,
          text: message.text,
          tag: message.tag,
          text_tag_pairs: message.text_tag_pairs,
          startOffset: message.startOffset,
          endOffset: message.endOffset,
          color: message.color,
        }),
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      clearAuthBadge();
      senderResponse({ highlight: data });
    } catch (err) {
      senderResponse({ error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, senderResponse) => {
  if (message.type === "get_highlights") {
    return handleGetHighlights(message, sender, senderResponse);
  }
  if (message.type === "add_highlights") {
    return handleAddHighlights(message, sender, senderResponse);
  }
  return true;
});
