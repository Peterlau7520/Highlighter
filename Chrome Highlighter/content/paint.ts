import type { TextNodeEntry } from "../types.js";
import { extractTextTagPairs } from "./extractTextTags.js";

export function highlight(range: Range, color: string): void {
  const [text_tag_pairs, text_nodes, startOffset, endOffset] = extractTextTagPairs(range);
  surroundContents(text_nodes, startOffset, endOffset, color);
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
    .then((response) => {
      if (response.error) {
        console.log("could not save highlight:", response.error);
        return;
      }
      console.log("Added successfully", response);
    });
}

function surroundContents(
  text_nodes: TextNodeEntry[],
  startOffset: number,
  endOffset: number,
  color = "cyan",
): void {
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
}
