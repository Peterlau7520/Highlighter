import { ensureFreshSession } from "./lib/auth.js";

/**
 * Entry point for the extension. Fires when the toolbar icon is clicked and
 * injects all content scripts into the active tab.
 *
 * Note: manifest.json has no `default_popup`, so popups/popup.js is not
 * actually wired up — this listener is what runs on icon click, not the popup.
 *
 * @param {chrome.tabs.Tab} tab - the tab that was active when the icon was clicked
 */
// chrome.action.onClicked.addListener((tab) => {
//   chrome.scripting
//     .executeScript({
//       target: { tabId: tab.id },
//       files: [
//         "content/displayHistory.js",
//         "content/extractTextTags.js",
//         "content/main.js",
//         "content/paint.js",
//         "content/util.js",
//       ],
//     })
//     .catch((err) => console.error("Injection failed:", err));
// });

console.log("loaded");

/**
 * First-run onboarding: opens the popup UI as a full tab so a brand-new
 * user is prompted to sign in with Google immediately, instead of having to
 * discover the toolbar icon on their own.
 */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("popups/popup.html") });
  }
});

/**
 * Clears the "please sign in again" badge, e.g. after a request succeeds.
 */
function clearAuthBadge() {
  chrome.action.setBadgeText({ text: "" });
}

/**
 * Sets a lightweight toolbar badge nudging the user to relogin, used
 * instead of forcing a popup open whenever silent session refresh fails.
 */
function setAuthBadge() {
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
}

/**
 * Handles `get_highlights` messages sent from content scripts
 * (displayHistory.js). Ensures a valid session (silently refreshing if
 * needed), fetches saved highlights for `message.url` from the backend
 * (`GET /highlights`), and returns them to the sender as
 * `{ highlights: [...] }`. Responds `{ error: "auth_required" }` if the
 * user isn't signed in and silent refresh fails.
 *
 * Returns `true` to keep the message channel open for the async response.
 */
chrome.runtime.onMessage.addListener(
  function (message, sender, senderResponse) {
    if (message.type === "get_highlights") {
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
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          const data = await response.json();
          clearAuthBadge();
          senderResponse({ highlights: data });
        } catch (err) {
          senderResponse({ error: err.message });
        }
      })();
    }
    return true;
  },
);
/**
 * Handles `add_highlights` messages sent from content scripts (paint.js,
 * via `highlight()`). Ensures a valid session (silently refreshing if
 * needed), persists a new highlight to the backend (`POST /addhighlight`)
 * with its text/tag pairs, offsets, url and color, and returns the created
 * record to the sender as `{ highlight: ... }`. Responds
 * `{ error: "auth_required" }` if the user isn't signed in and silent
 * refresh fails.
 *
 * Returns `true` to keep the message channel open for the async response.
 */
chrome.runtime.onMessage.addListener(
  function (message, sender, senderResponse) {
    if (message.type === "add_highlights") {
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
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          const data = await response.json();
          clearAuthBadge();
          senderResponse({ highlight: data });
        } catch (err) {
          senderResponse({ error: err.message });
        }
      })();
    }
    return true;
  },
);

//update highlights

//edit or delete highlights
