import type { TextTagPair, TextNodeEntry } from "../types.js";

export function extractTextTagPairs(range: Range): [TextTagPair[], TextNodeEntry[], number, number] {
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    },
  );

  const text_tag_pairs: TextTagPair[] = [];
  const text_nodes: TextNodeEntry[] = [];

  function pushNode(node: Node): void {
    const textNode = node as Text;
    text_tag_pairs.push({
      text: textNode.textContent ?? "",
      tag: textNode.parentElement?.tagName ?? "",
    });
    text_nodes.push({ node: textNode, text: textNode.textContent ?? "" });
  }

  if (walker.currentNode.nodeType === Node.TEXT_NODE) pushNode(walker.currentNode);
  while (walker.nextNode()) pushNode(walker.currentNode);

  text_nodes[0].text = text_nodes[0].node.textContent?.slice(range.startOffset) ?? "";
  text_tag_pairs[0].text = text_nodes[0].text;

  const lastNode = text_nodes[text_nodes.length - 1];
  const lastPair = text_tag_pairs[text_tag_pairs.length - 1];
  if (text_nodes.length > 1) {
    lastNode.text = lastNode.node.textContent?.slice(0, range.endOffset) ?? "";
  } else {
    lastNode.text = lastNode.node.textContent?.slice(range.startOffset, range.endOffset) ?? "";
  }
  lastPair.text = lastNode.text;

  return [text_tag_pairs, text_nodes, range.startOffset, range.endOffset];
}
