# Chrome Highlighter — Code Flow

## 1. Extension Startup

`manifest.json` declares:

- **Service worker**: `background.js` (ES module, runs in background)
- **Content scripts**: injected into every `https://*` and `http://localhost/*` page as ES modules. Only the two entry points are listed — they import the rest:
  1. `content/main.js` — user interaction (selection, tooltip)
  2. `content/displayHistory.js` — restores saved highlights on page load
  - *(imported by the entry points: `util.js`, `extractTextTags.js`, `paint.js`)*
- **Permissions**: `activeTab`, `scripting`, `tabs`, `identity` (Google OAuth), `storage`
- **OAuth2**: Google client ID with `openid`, `email`, `profile` scopes

On first install, `background.js` opens `popups/popup.html` as a full tab so the user is immediately prompted to sign in.

---

## 2. Highlight History — Loading on Page Load

Triggered automatically when `displayHistory.js` is injected.

```
displayHistory.ts               background.ts                auth.ts                 Backend
      |                                |                          |                       |
      |-- sendMessage(get_highlights) -->|                         |                       |
      |       { url: window.location.href }                       |                       |
      |                                |-- ensureFreshSession() -->|                       |
      |                                |                          |-- getSession()         |
      |                                |                          |   (chrome.storage.local)
      |                                |                          |                       |
      |                                |        [cache hit: session valid & not expiring soon]
      |                                |<---------- return session ---|                   |
      |                                |                          |                       |
      |                                |        [cache miss or near-expiry]               |
      |                                |                          |-- getGoogleAuthToken(false)
      |                                |                          |   (chrome.identity, silent, no UI)
      |                                |                          |-- exchangeGoogleToken() -> POST /auth/google
      |                                |                          |-- saveSession()        |
      |                                |<---------- return session ---|                   |
      |                                |                          |                       |
      |                                |        [no token / exchange failed]              |
      |                                |                          |-- clearSession()       |
      |                                |<---------- return null --|                       |
      |                                |                          |                       |
      |                     [session null]                        |                       |
      |                                |-- setAuthBadge() (shows "!" on toolbar)          |
      |<-- { error: "auth_required" } --|                         |                       |
      |   (log & bail)                 |                          |                       |
      |                                |                          |                       |
      |                     [session valid]                       |                       |
      |                                |-- GET /highlights?url=… (Bearer token) --------->|
      |                                |<----------------------- { highlights: [...] } ---|
      |                                |-- clearAuthBadge()       |                       |
      |<-- { highlights: [...] } -------|                         |                       |
      |                                |                          |                       |
      | for each highlight:            |                          |                       |
      |   highlight_text_tag_pairs(element)                       |                       |
      |   - TreeWalker over page text nodes                       |                       |
      |   - match text_tag_pairs sequence                         |                       |
      |   - recreate <span> with saved color via Range.surroundContents()
```

### `highlight_text_tag_pairs` (in `displayHistory.ts`)

Given a saved `HighlightRecord` `{ text_tag_pairs, startOffset, endOffset, color }`:

1. Finds the first matching text node using `indexOfAll` (from `util.ts`) on `document.body.innerText`.
2. Walks all text nodes via `TreeWalker` (skipping `SCRIPT`/`STYLE`).
3. Scans for a run of consecutive nodes whose `textContent` + parent `tagName` matches `text_tag_pairs` in order.
4. Wraps the first node slice and last node slice each in a `<span style="background-color: color">` via `Range.surroundContents()`.
5. Sets `backgroundColor` directly on parent elements of any middle nodes.

---

## 3. Highlight Creation — User Action

Triggered when the user selects text and picks a color.

```
User selects text
      |
      v
main.ts: mouseup event (2ms delay for browser to settle selection)
      |-- window.getSelection() has text?
      |   yes → showTooltip(selection)
      |   no  → removeTooltip()
      |
showTooltip(selection: Selection):
  - clones selection range, collapses to start, getBoundingClientRect()
  - appends floating <div id="my-ext-tooltip"> with 4 color swatches
    (cyan, yellow, red, green)
  - each swatch: mousedown → removeTooltip() → highlight(range, color)
      |
      v
paint.ts: highlight(range: Range, color: string)
      |
      |-- extractTextTagPairs(range)  [extractTextTags.ts]
      |     - TreeWalker over range.commonAncestorContainer, SHOW_TEXT
      |     - collects all text nodes intersecting the range
      |     - builds text_tag_pairs: TextTagPair[]  →  [{ text, tag }, ...]
      |     - trims first/last node text to exact selection offsets
      |     - returns [text_tag_pairs, text_nodes, startOffset, endOffset]
      |
      |-- surroundContents(text_nodes, startOffset, endOffset, color)
      |     - wraps first text node slice in colored <span>
      |     - wraps last text node slice in colored <span>
      |     - sets backgroundColor on parent elements of middle nodes
      |
      |-- window.getSelection()?.removeAllRanges()
      |
      |-- chrome.runtime.sendMessage(add_highlights)
            { url, text, text_tag_pairs, startOffset, endOffset, color }

background.ts: add_highlights handler
      |-- ensureFreshSession()  [same auth flow as above]
      |
      |   [session null] → setAuthBadge(), respond { error: "auth_required" }
      |
      |   [session valid] → POST /addhighlight
      |       body: { url, text, tag, text_tag_pairs, startOffset, endOffset, color }
      |       header: Authorization: Bearer <sessionToken>
      |<-- { highlight: <created record> }
      |-- clearAuthBadge()
      |-- senderResponse({ highlight: data })
```

---

## 4. Auth Flow Details (`lib/auth.ts`)

| Function | Signature | What it does |
|---|---|---|
| `getSession` | `() => Promise<Session \| null>` | Reads `{ sessionToken, expiresAt, user }` from `chrome.storage.local`, or null |
| `saveSession` | `(session: Session) => Promise<void>` | Writes session to `chrome.storage.local` |
| `clearSession` | `() => Promise<void>` | Removes session from storage |
| `getGoogleAuthToken` | `(interactive: boolean) => Promise<string \| null>` | Promisified `chrome.identity.getAuthToken`; `false` = silent (no UI), `true` = shows Google consent screen |
| `exchangeGoogleToken` | `(googleAccessToken: string) => Promise<Session>` | `POST /auth/google` with the Google token → backend returns `Session`, saved to storage |
| `ensureFreshSession` | `() => Promise<Session \| null>` | Cache → silent refresh if missing/near-expiry → return session or null |
| `signInInteractive` | `() => Promise<Session>` | Interactive sign-in (must be called from a real user gesture, e.g. popup button) |
| `signOut` | `() => Promise<void>` | `chrome.identity.clearAllCachedAuthTokens()` + `clearSession()` |

**Session expiry skew**: `REFRESH_SKEW_MS = 5 minutes` — sessions are treated as expired 5 minutes early to avoid requests being rejected mid-flight.

**Auth badge**: If `ensureFreshSession()` returns null, `background.ts` sets a red `"!"` badge on the toolbar icon to nudge the user to re-open the popup and sign in. It is cleared on the next successful request.

---

## 5. File Map

### Source (`Chrome Highlighter/`)

| File | Role |
|---|---|
| `manifest.json` | Extension config, permissions, script declarations |
| `types.ts` | Shared TypeScript interfaces: `Session`, `GoogleUser`, `TextTagPair`, `TextNodeEntry`, `HighlightRecord`, message/response union types |
| `background.ts` | Service worker; handles `get_highlights` and `add_highlights` messages |
| `lib/auth.ts` | Session management (cache, silent refresh, interactive sign-in) |
| `content/displayHistory.ts` | Entry point — on-load: fetches and re-applies saved highlights to the DOM |
| `content/main.ts` | Entry point — mouse selection listener; shows/removes color-picker tooltip |
| `content/paint.ts` | `highlight()`: applies DOM highlight + sends `add_highlights` to background |
| `content/extractTextTags.ts` | `extractTextTagPairs()`: extracts `TextTagPair[]` and offsets from a DOM `Range` |
| `content/util.ts` | `indexOfAll()`: finds all indices of a substring in a string |
| `popups/popup.ts` | Sign-in / sign-out UI (opened on first install or badge click) |
| `popups/popup.html` | Popup HTML shell |
| `backend/index.js` | Node/Express backend — `GET /highlights`, `POST /addhighlight`, `POST /auth/google` |

### Compiled output (`Chrome Highlighter/dist/`)

Mirrors the source structure. Load this folder in Chrome — do not edit files here directly.

---

## 6. Development Workflow

Source files are TypeScript. Chrome loads the compiled JavaScript from `dist/`.

| Command | What it does |
|---|---|
| `npm run build` | Compiles TypeScript → `dist/`, then copies `manifest.json`, icons, and `popup.html` |
| `npm run watch` | Recompiles automatically on every file save (no asset copy — run build once first) |
| `npm run typecheck` | Type-checks without emitting — fast check before committing |

**First-time setup:**
```bash
cd "Chrome Highlighter"
npm install
npm run build
```

**Loading in Chrome:**
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `Chrome Highlighter/dist/`

**Iterating:**
- Run `npm run watch` in a terminal while working
- After each recompile, click the **reload icon** on the extension card in `chrome://extensions`
- Background script changes also require clicking **Service worker** → **Stop** → reload
