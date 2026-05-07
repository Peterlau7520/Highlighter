const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
  acceptNode(node) {
    const tag = node.parentElement?.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") {
      return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  },
});

while (walker.nextNode()) {
  console.log(walker.currentNode, walker.currentNode.parentElement?.tagName);
}
