import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "br", "p", "div", "ul", "ol", "li"];

/**
 * Sanitizes a highlight note's HTML before it's stored or rendered back
 * into an arbitrary web page. Only a small set of formatting tags survive;
 * no attributes are allowed at all (so no `onerror=`, no `href`/`src`,
 * nothing event- or URL-based can sneak through).
 *
 * Called both before saving a note (content script) and — the actually
 * load-bearing call — right before rendering one, since a note's HTML
 * could in principle reach the page via any path (see backend/index.js's
 * PATCH /highlights/:id doc comment on the sanitization boundary).
 *
 * @param html - raw HTML, e.g. from a contenteditable box
 * @returns sanitized HTML safe to assign to `innerHTML`
 */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
