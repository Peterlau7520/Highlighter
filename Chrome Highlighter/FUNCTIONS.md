# Frontend Function Index

Top-down reference for every function in the Chrome Highlighter frontend.
Each function has inline TypeScript types — hover in VS Code for the signature,
`Ctrl+Shift+O` for a per-file outline, `Ctrl+T` to jump to any symbol across
the whole project.

> **Content scripts are bundled, not raw ES modules.** Chrome's static
> `content_scripts` array doesn't support real ES modules the way the
> service worker does, so only the two entry points are listed in
> `manifest.json` (`content/main.js`, `content/displayHistory.js`) and they —
> plus everything they import (`util.ts`, `extractTextTags.ts`, `paint.ts`,
> `content/notePopover.ts`, `lib/urlChange.ts`, `lib/sanitizeNote.ts`, and
> `sanitizeNote.ts`'s `dompurify` dependency) — are bundled into standalone,
> import-free files by **esbuild** (`npm run bundle-content`), not by `tsc`
> itself. This is also why each bundle is ~77kb rather than a few kb:
> `dompurify` gets inlined into *both* entry-point bundles independently
> (esbuild isn't code-splitting a shared chunk here — that would require ESM
> output, which content scripts can't use).

## Chrome Extension Code Execution Order

**Background service worker** (`background.ts`) — initializes first, boots when
the extension loads or an event it listens to triggers.

**Popup** (`popups/popup.ts`) — runs only when the user opens the toolbar popup
or the onboarding tab.

**Content scripts** (`content/main.ts`, `content/displayHistory.ts`) — injected
as ES modules into every matching page. Each entry point imports its own
dependencies; there is no shared global scope between them.

## Index

| File | Function | Signature | Purpose | Calls |
|---|---|---|---|---|
| `background.ts` | `onInstalled` listener | — | On first install, opens `popups/popup.html` as a full tab so a new user is prompted to sign in immediately | — |
| `background.ts` | `handleGetHighlights` | `(msg: GetHighlightsMessage, ...) => true` | Ensures a fresh session, then `GET /highlights`; responds `{error:"auth_required"}` + sets toolbar badge if not signed in | `ensureFreshSession`, backend API |
| `background.ts` | `handleAddHighlights` | `(msg: AddHighlightsMessage, ...) => true` | Ensures a fresh session, then `POST /addhighlight`; responds `{error:"auth_required"}` + sets toolbar badge if not signed in | `ensureFreshSession`, backend API |
| `background.ts` | `clearAuthBadge` | `() => void` | Clears the `"!"` toolbar badge after a successful request | — |
| `background.ts` | `setAuthBadge` | `() => void` | Sets a red `"!"` badge nudging the user to re-sign-in | — |
| `background.ts` | `onHistoryStateUpdated` listener | — | Fires on SPA (same-document) navigations, e.g. `history.pushState` link clicks. Forwards a `url_changed` message to the tab's content script so it can re-render highlights for the new URL | `shouldNotifyUrlChange`, `chrome.tabs.sendMessage` |
| `background.ts` | `handleUpdateNote` | `(msg: UpdateNoteMessage, ...) => true` | Ensures a fresh session, then `PATCH /highlights/:id` with the sanitized note; responds `{error:"auth_required"}` + sets toolbar badge if not signed in | `ensureFreshSession`, backend API |
| `lib/urlChange.ts` | `shouldNotifyUrlChange` | `(details: {frameId: number}) => boolean` | `frameId === 0` check — ignores iframe-internal navigations so only top-level URL changes trigger a re-render | — |
| `lib/urlChange.ts` | `isUrlChangedMessage` | `(message: unknown) => message is UrlChangedMessage` | Type guard for the `url_changed` message shape | — |
| `lib/sanitizeNote.ts` | `sanitizeNoteHtml` | `(html: string) => string` | DOMPurify sanitize, allowlisting only `b,strong,i,em,u,br,p,div,ul,ol,li` and no attributes. Called before saving a note and — the load-bearing call — before rendering one, since that's where script-execution risk actually lives | DOMPurify |
| `lib/auth.ts` | `getSession` | `() => Promise<Session \| null>` | Reads `{sessionToken, expiresAt, user}` from `chrome.storage.local` | — |
| `lib/auth.ts` | `saveSession` | `(session: Session) => Promise<void>` | Writes session to `chrome.storage.local` | — |
| `lib/auth.ts` | `clearSession` | `() => Promise<void>` | Removes session from storage | — |
| `lib/auth.ts` | `ensureFreshSession` | `() => Promise<Session \| null>` | Returns a valid session, silently refreshing via `chrome.identity.getAuthToken({interactive:false})` + `POST /auth/google` if expired; `null` if silent refresh fails | Google Identity API, backend `/auth/google` |
| `lib/auth.ts` | `signInInteractive` | `() => Promise<Session>` | Shows Google's consent screen (`{interactive:true}`) and exchanges the token; must be called from a real user gesture | Google Identity API, backend `/auth/google` |
| `lib/auth.ts` | `signOut` | `() => Promise<void>` | Revokes the cached Google token and clears the stored session | Google Identity API |
| `popups/popup.ts` | `render` | `() => Promise<void>` | Shows "Signed in as {email}" + Sign out, or a Sign in button, based on the stored session | `getSession` |
| `popups/popup.ts` | Sign-in / Sign-out handlers | — | Call `signInInteractive()` / `signOut()` and re-render; closes the tab if opened as the onboarding tab | `lib/auth.ts` |
| `content/main.ts` | `mouseup` listener | — | Skips entirely if the mouseup happened inside our own note popover (not real page content); otherwise detects a text selection (2ms debounce) and shows the color-picker tooltip | `isEventInsideNotePopover`, `showTooltip`, `removeTooltip` |
| `content/main.ts` | `showTooltip` | `(selection: Selection) => void` | Renders a floating 4-swatch color-picker near the selection start | `removeTooltip`, `highlight` |
| `content/main.ts` | `removeTooltip` | `(where: string) => void` | Removes the tooltip element from the DOM | — |
| `content/paint.ts` | `highlight` | `(range: Range, color: string) => void` | Applies the chosen color to the selection, sends it to the backend to be saved, then — once the created record comes back with its `_id` — tags every trigger element (start/end spans + any middle elements) with `data-highlight-id` and attaches a note popover to all of them | `extractTextTagPairs`, `surroundContents`, `attachNotePopover`, background (`add_highlights`) |
| `content/paint.ts` | `surroundContents` | `(text_nodes: TextNodeEntry[], startOffset: number, endOffset: number, color?: string) => {startSpan, endSpan, middleElements}` | Wraps the start/end boundary nodes in real `<span>`s. For each "middle" node, checks whether its parent element structurally contains (`.contains()`) another node's parent in the same highlight — if so, that parent is a shared ancestor container (e.g. a large wrapper's own whitespace text node sitting between two of its child elements), not a tight wrapper, so the node is wrapped individually instead of coloring the whole parent's background (a real bug this fixes: coloring an ancestor container highlighted far more of the page than was selected). Otherwise colors the standalone parent directly, as before. Returns every resulting element. Shared by `paint.ts`'s `highlight()` and `displayHistory.ts`'s `highlight_text_tag_pairs` — one place that creates highlight spans | — |
| `content/notePopover.ts` | `attachNotePopover` | `(triggers: HTMLElement[], highlightId: string, initialNote: string) => void` | Hover-to-preview, click-to-edit note popover shared across *all* of a highlight's trigger elements (start/end spans, plus any middle elements) — so hovering anywhere across the visually highlighted range shows it, not just its two boundary spans. Edit mode: `contenteditable` + Bold/Italic/Underline toolbar (`execCommand`). Collapses and saves (via `update_note`) on `focusout`, not `mouseleave`, so clicking a toolbar button mid-edit doesn't prematurely collapse it | `sanitizeNoteHtml`, background (`update_note`) |
| `content/notePopover.ts` | `isEventInsideNotePopover` | `(target: EventTarget \| null) => boolean` | `target.closest("#my-ext-note-popover")` check. Lets `main.ts`'s page-wide `mouseup` listener ignore selections made inside our own injected note UI instead of treating them as page text to highlight | — |
| `content/extractTextTags.ts` | `extractTextTagPairs` | `(range: Range) => [TextTagPair[], TextNodeEntry[], number, number]` | Walks the range's text nodes, records `{text, tag}` pairs used to relocate the highlight on reload | — |
| `content/util.ts` | `indexOfAll` | `(str: string, needle: string) => number[]` | Returns all non-overlapping match indices of `needle` in `str` | — |
| `content/displayHistory.ts` | `displayHighlightHistory` | `() => Promise<void>` | Runs on injection, and again on every SPA URL change; fetches saved highlights for the page and re-applies them; silently skips on auth failure | background (`get_highlights`), `highlight_text_tag_pairs` |
| `content/displayHistory.ts` | `highlight_text_tag_pairs` | `(element: HighlightRecord) => number \| undefined` | Re-locates one saved highlight's text/tag sequence, re-wraps it via the shared `surroundContents`, tags every returned element with `data-highlight-id`, and attaches a note popover seeded with the saved `note`. Naturally idempotent: once a node is wrapped, its parent tag becomes `SPAN`, so re-running against already-highlighted content is a no-op instead of double-wrapping | `indexOfAll`, `surroundContents`, `attachNotePopover` |
| `content/displayHistory.ts` | `onMessage` listener (`url_changed`) | — | On SPA navigation, waits `SPA_RENDER_SETTLE_MS` (300ms, for the framework's async re-render) then re-runs `displayHighlightHistory` | `isUrlChangedMessage`, `displayHighlightHistory` |

## Shared Types (`types.ts`)

| Type | Shape |
|---|---|
| `GoogleUser` | `{ email: string; name?: string; picture?: string; sub?: string }` |
| `Session` | `{ sessionToken: string; expiresAt: number; user: GoogleUser }` |
| `TextTagPair` | `{ text: string; tag: string }` |
| `TextNodeEntry` | `{ node: Text; text: string }` |
| `HighlightRecord` | `{ _id, text, tag?, text_tag_pairs, startOffset, endOffset, color?, url?, note? }` |
| `GetHighlightsMessage` | `{ type: "get_highlights"; url: string }` |
| `UrlChangedMessage` | `{ type: "url_changed"; url: string }` — background → content script, on SPA navigation |
| `AddHighlightsMessage` | `{ type: "add_highlights"; url, text, tag?, text_tag_pairs, startOffset, endOffset, color }` |
| `UpdateNoteMessage` | `{ type: "update_note"; highlightId: string; note: string }` |
| `GetHighlightsResponse` | `{ highlights: HighlightRecord[] } \| { error: string }` |
| `AddHighlightsResponse` | `{ highlight: HighlightRecord } \| { error: string }` |
| `UpdateNoteResponse` | `{ success: true } \| { error: string }` |

## Call-flow diagram

Five flows: **signing in**, **creating** a highlight, **restoring** saved
highlights on page load, **re-rendering on SPA navigation**, and
**adding/editing a note**. Creating/restoring both gate on a valid session
first.

```mermaid
flowchart TD
    subgraph SignIn["Signing in"]
        S0["onInstalled (first run)<br/>or toolbar icon click"] --> S1["popup.ts render()"]
        S1 -->|not signed in| S2["Sign in with Google button"]
        S2 --> S3["signInInteractive()<br/>(lib/auth.ts)"]
        S3 -->|Google consent screen| S4["POST /auth/google"]
        S4 --> S5[(users collection)]
        S4 --> S6["session stored in<br/>chrome.storage.local"]
    end

    subgraph Create["Creating a highlight"]
        A["mouseup listener<br/>(main.ts)"] --> B["showTooltip()<br/>(main.ts)"]
        B -->|swatch clicked| C["highlight(range, color)<br/>(paint.ts)"]
        C --> D["extractTextTagPairs(range)<br/>(extractTextTags.ts)"]
        C --> E["surroundContents(...)<br/>(paint.ts)"]
        C -->|"add_highlights" message| F["background.ts<br/>handleAddHighlights"]
        F --> AUTH1["ensureFreshSession()"]
        AUTH1 -->|valid| G2["POST /addhighlight<br/>+ Authorization header"]
        AUTH1 -->|invalid| BADGE["set toolbar badge '!'"]
        G2 --> G[(highlights collection)]
        G2 -->|"{highlight} incl. _id"| T["tag spans data-highlight-id<br/>attachNotePopover([startSpan,endSpan], _id, '')"]
    end

    subgraph Restore["Restoring highlights on load"]
        H["displayHighlightHistory()<br/>(displayHistory.ts)"] -->|"get_highlights" message| I["background.ts<br/>handleGetHighlights"]
        I --> AUTH2["ensureFreshSession()"]
        AUTH2 -->|valid| I2["GET /highlights<br/>+ Authorization header"]
        AUTH2 -->|invalid| BADGE
        I2 --> G
        I2 --> H
        H --> J["highlight_text_tag_pairs(element)<br/>(displayHistory.ts)"]
        J --> K["indexOfAll()<br/>(util.ts)"]
        J --> L["surroundContents(...)<br/>(paint.ts, shared)"]
        L --> M["tag spans, attachNotePopover(..., element.note)"]
    end

    subgraph SPA["Re-rendering on SPA navigation"]
        N["chrome.webNavigation<br/>.onHistoryStateUpdated"] --> O["shouldNotifyUrlChange(details)<br/>(lib/urlChange.ts)"]
        O -->|top-level frame| P["chrome.tabs.sendMessage<br/>{type:'url_changed', url}"]
        O -->|iframe: skip| Q["(no-op)"]
        P --> R["displayHistory.ts<br/>onMessage listener"]
        R --> S["isUrlChangedMessage(message)<br/>(lib/urlChange.ts)"]
        S -->|true, after 300ms settle| H
    end

    subgraph Notes["Adding / editing a note"]
        U["mouseenter on trigger span<br/>(notePopover.ts)"] --> V["show preview:<br/>sanitizeNoteHtml(note) or '+ Add note'"]
        V -->|click| W["enter edit mode:<br/>contenteditable + B/I/U toolbar"]
        W -->|focusout, not mouseleave| X["sanitizeNoteHtml(box.innerHTML)"]
        X -->|unchanged| V
        X -->|changed| Y["'update_note' message"]
        Y --> Z["background.ts<br/>handleUpdateNote"]
        Z --> AUTH3["ensureFreshSession()"]
        AUTH3 -->|valid| Z2["PATCH /highlights/:id<br/>+ Authorization header"]
        AUTH3 -->|invalid| BADGE
        Z2 --> G
    end
```
