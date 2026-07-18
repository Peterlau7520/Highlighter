/**
 * Walks every text node intersected by `range` and records each node's text
 * content plus its parent tag name as a `text_tag_pairs` entry (used later
 * to relocate this same highlight on page reload, see displayHistory.js).
 * Trims the first and last node's recorded text to the exact selection
 * offsets.
 *
 * @param {Range} range - the DOM range being highlighted
 * @returns {[Array<{text: string, tag: string}>, Array<{node: Text, text: string}>, number, number]}
 *   `[text_tag_pairs, text_nodes, startOffset, endOffset]`
 */
function extractTextTagPairs(range) {
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // Check if this text node is within the range
        if (range.intersectsNode(node)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  const text_tag_pairs = [];
  const text_nodes = [];
  if (walker.currentNode.nodeType === Node.TEXT_NODE) {
    text_tag_pairs.push({
      text: walker.currentNode.textContent,
      tag: walker.currentNode.parentElement.tagName,
    });
    text_nodes.push({
      node: walker.currentNode,
      text: walker.currentNode.textContent,
    });
  }
  while (walker.nextNode()) {
    text_tag_pairs.push({
      text: walker.currentNode.textContent,
      tag: walker.currentNode.parentElement.tagName,
    });
    text_nodes.push({
      node: walker.currentNode,
      text: walker.currentNode.textContent,
    });
  }

  text_nodes[0]["text"] = text_nodes[0]["node"].textContent.slice(
    range.startOffset,
  );
  text_tag_pairs[0]["text"] = text_nodes[0]["text"];

  if (text_nodes.length > 1) {
    text_nodes.at(-1)["text"] = text_nodes
      .at(-1)
      ["node"].textContent.slice(0, range.endOffset);
    text_tag_pairs.at(-1)["text"] = text_nodes.at(-1)["text"];
  } else {
    text_nodes.at(-1)["text"] = text_nodes
      .at(-1)
      ["node"].textContent.slice(range.startOffset, range.endOffset);
    text_tag_pairs.at(-1)["text"] = text_nodes.at(-1)["text"];
  }
  //startOffset, the first letter's index in that Range;
  //endOffset, the total number of characters counted from the very beginning of that text nod
  return [text_tag_pairs, text_nodes, range.startOffset, range.endOffset];
}
