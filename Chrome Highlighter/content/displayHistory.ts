import type { HighlightRecord, GetHighlightsResponse } from "../types.js";
import { indexOfAll } from "./util.js";

async function displayHighlightHistory(): Promise<void> {
  console.log("sending message");
  console.log(window.location.href);

  const response: GetHighlightsResponse = await chrome.runtime.sendMessage({
    type: "get_highlights",
    url: window.location.href,
  });

  if (response.error) {
    console.log("could not load highlight history:", response.error);
    return;
  }

  const highlights: HighlightRecord[] | [] = response.highlights ?? [];
  console.log(typeof highlights);
  console.log("highlights", highlights);

  highlights.forEach((element: HighlightRecord) => {
    console.log("dissecting and highlighting", element.text);
    try {
      highlight_text_tag_pairs(element);
    } catch (e) {
      console.log("highlight_text_tag_pairs threw:", e);
    }
  });
}

function highlight_text_tag_pairs(
  element: HighlightRecord,
): number | undefined {
  console.log("element", element);
  const { text_tag_pairs, startOffset, endOffset } = element;
  const color = element.color ?? "cyan";

  const body = document.body.innerText;
  const indices = indexOfAll(body, text_tag_pairs[0].text);
  if (indices.length === 0) return -1;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const tag = node.parentElement?.tagName;
        if (tag === "SCRIPT" || tag === "STYLE")
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const nodes: Node[] = [];
  if (walker.currentNode.nodeType === Node.TEXT_NODE)
    nodes.push(walker.currentNode);
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (let i = 0; i < nodes.length; i++) {
    if (
      nodes[i].textContent?.includes(text_tag_pairs[0].text) &&
      nodes[i].parentElement?.tagName === text_tag_pairs[0].tag
    ) {
      let count = 1;
      let j = i + 1;
      while (
        count < text_tag_pairs.length &&
        nodes[j].textContent?.includes(text_tag_pairs[count].text) &&
        nodes[j].parentElement?.tagName === text_tag_pairs[count].tag
      ) {
        j++;
        count++;
      }

      if (count === text_tag_pairs.length) {
        const startRange: Range = document.createRange();
        startRange.setStart(nodes[i], startOffset);
        startRange.setEnd(
          nodes[i],
          startOffset + text_tag_pairs[0].text.length,
        );
        const startSpan = document.createElement("span");
        startSpan.style.backgroundColor = color;

        const endRange: Range = document.createRange();
        endRange.setStart(
          nodes[i + count - 1],
          text_tag_pairs.length > 1 ? 0 : startOffset,
        );
        endRange.setEnd(nodes[i + count - 1], endOffset);
        const endSpan = document.createElement("span");
        endSpan.style.backgroundColor = color;

        startRange.surroundContents(startSpan);
        endRange.surroundContents(endSpan);

        for (let k = i + 1; k < i + count - 1; k++) {
          const parent = nodes[k].parentElement;
          if (parent) parent.style.backgroundColor = color;
        }

        break;
      }
    }
  }
}

displayHighlightHistory();
