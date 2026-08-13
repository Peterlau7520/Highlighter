import type { AddHighlightsResponse, TextNodeEntry } from "../types.js";
import { extractTextTagPairs } from "./extractTextTags.js";
import { attachNotePopover } from "./notePopover.js";

export function highlight(range: Range, color: string): void {
  const [text_tag_pairs, text_nodes, startOffset, endOffset] = extractTextTagPairs(range);
  const { startSpan, endSpan } = surroundContents(text_nodes, startOffset, endOffset, color);
  window.getSelection()?.removeAllRanges();

  chrome.runtime
    .sendMessage({
      type: "add_highlights",
      url: window.location.href,
      text: range.toString(),
      text_tag_pairs,
      startOffset,
      endOffset,
      color,
    })
    .then((response: AddHighlightsResponse) => {
      if (response.error || !response.highlight) {
        console.log("could not save highlight:", response.error);
        return;
      }
      console.log("Added successfully", response);

      const { highlight: created } = response;
      const triggers = [startSpan, endSpan];
      triggers.forEach((span) => {
        span.dataset.highlightId = created._id;
      });
      attachNotePopover(triggers, created._id, "");
    });
}

/**
 * Wraps the selected text nodes in colored `<span>`s (the highlight's
 * start/end boundary spans get real wrapping elements; nodes in between
 * just get their parent's backgroundColor set directly). Returns the two
 * wrapping spans so the caller can tag them (`data-highlight-id`) and
 * attach a note popover once the highlight's id is known.
 *
 * Shared by content/paint.ts's `highlight()` (new highlight) and
 * content/displayHistory.ts's `highlight_text_tag_pairs` (restoring saved
 * highlights) — one place that creates highlight spans.
 */
export function surroundContents(
  text_nodes: TextNodeEntry[],
  startOffset: number,
  endOffset: number,
  color = "cyan",
): { startSpan: HTMLSpanElement; endSpan: HTMLSpanElement } {
  const lastNode = text_nodes[text_nodes.length - 1];

  const startRange = document.createRange();
  startRange.setStart(text_nodes[0].node, startOffset);
  startRange.setEnd(text_nodes[0].node, startOffset + text_nodes[0].text.length);
  const startSpan = document.createElement("span");
  startSpan.style.backgroundColor = color;

  const endRange = document.createRange();
  endRange.setStart(lastNode.node, text_nodes.length > 1 ? 0 : startOffset);
  endRange.setEnd(lastNode.node, endOffset);
  const endSpan = document.createElement("span");
  endSpan.style.backgroundColor = color;

  startRange.surroundContents(startSpan);
  endRange.surroundContents(endSpan);

  for (let k = 1; k < text_nodes.length - 1; k++) {
    const parent = text_nodes[k].node.parentElement;
    if (parent) parent.style.backgroundColor = color;
  }

  return { startSpan, endSpan };
}
