import type {
  HighlightRecord,
  GetHighlightsResponse,
  TextNodeEntry,
} from "../types.js";
import { indexOfAll } from "./util.js";
import { isUrlChangedMessage } from "../lib/urlChange.js";
import { surroundContents } from "./paint.js";
import { attachNotePopover } from "./notePopover.js";

// SPA frameworks typically finish updating the DOM asynchronously *after*
// the URL changes, so wait briefly before re-scanning the page (main.ts's
// mouseup handler has the same "let the page settle" pattern).
const SPA_RENDER_SETTLE_MS = 300;

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
        // Use the stored, pre-trimmed text_tag_pairs[k].text — NOT the
        // current DOM node's full textContent. extractTextTagPairs()
        // trimmed text_tag_pairs[0].text down to `fullText.slice(startOffset)`
        // at creation time specifically so that surroundContents() can
        // compute `startOffset + text_nodes[0].text.length` as the node's
        // true end boundary. Feeding it the untrimmed textContent instead
        // overshoots that boundary by `startOffset` characters.
        const matchedNodes: TextNodeEntry[] = nodes
          .slice(i, i + count)
          .map((node, k) => ({ node: node as Text, text: text_tag_pairs[k].text }));

        const { startSpan, endSpan, middleElements } = surroundContents(
          matchedNodes,
          startOffset,
          endOffset,
          color,
        );

        const triggers = [startSpan, endSpan, ...middleElements];
        triggers.forEach((el) => {
          el.dataset.highlightId = element._id;
        });
        attachNotePopover(triggers, element._id, element.note ?? "");

        break;
      }
    }
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (!isUrlChangedMessage(message)) return;
  console.log("url changed (SPA navigation), re-rendering highlights for", message.url);
  setTimeout(() => {
    displayHighlightHistory();
  }, SPA_RENDER_SETTLE_MS);
});

displayHighlightHistory();
