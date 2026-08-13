import type { AddHighlightsResponse, TextNodeEntry } from "../types.js";
import { extractTextTagPairs } from "./extractTextTags.js";
import { attachNotePopover } from "./notePopover.js";

export function highlight(range: Range, color: string): void {
  const [text_tag_pairs, text_nodes, startOffset, endOffset] = extractTextTagPairs(range);
  const { startSpan, endSpan, middleElements } = surroundContents(text_nodes, startOffset, endOffset, color);
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
      const triggers = [startSpan, endSpan, ...middleElements];
      triggers.forEach((el) => {
        el.dataset.highlightId = created._id;
      });
      attachNotePopover(triggers, created._id, "");
    });
}

/**
 * Wraps the selected text nodes in colored `<span>`s. Start/end boundary
 * nodes always get a real wrapping span. "Middle" nodes (fully inside the
 * selection) are handled per-node: if the node's parent element is
 * structurally an ancestor of another node's parent in this same
 * highlight (e.g. a large wrapper's own whitespace text node sitting
 * directly between two of its child elements — a real bug this fixes),
 * coloring that parent's entire background would highlight far more than
 * was selected, so that node gets wrapped individually instead. Otherwise
 * the parent is genuinely standalone and gets its background colored
 * directly, same as before.
 *
 * Returns every resulting element (spans + any directly-colored standalone
 * parents) so the caller can tag them (`data-highlight-id`) and attach a
 * note popover — hovering *anywhere* across the visually highlighted range
 * should trigger it, not just the two boundary spans.
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
): {
  startSpan: HTMLSpanElement;
  endSpan: HTMLSpanElement;
  middleElements: HTMLElement[];
} {
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

  // Parents of every node in this highlight — used to detect when a middle
  // node's own parent is actually a shared ancestor container rather than
  // a tight wrapper around just that node.
  const allParents = text_nodes
    .map((tn) => tn.node.parentElement)
    .filter((p): p is HTMLElement => p !== null);

  const middleElements: HTMLElement[] = [];
  for (let k = 1; k < text_nodes.length - 1; k++) {
    const node = text_nodes[k].node;
    const parent = node.parentElement;
    if (!parent) continue;

    const isSharedAncestor = allParents.some(
      (other) => other !== parent && parent.contains(other),
    );

    if (isSharedAncestor) {
      const middleRange = document.createRange();
      middleRange.selectNodeContents(node);
      const middleSpan = document.createElement("span");
      middleSpan.style.backgroundColor = color;
      middleRange.surroundContents(middleSpan);
      middleElements.push(middleSpan);
    } else {
      parent.style.backgroundColor = color;
      middleElements.push(parent);
    }
  }

  return { startSpan, endSpan, middleElements };
}
