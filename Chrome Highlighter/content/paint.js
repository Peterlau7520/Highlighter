function highlight(range, color) {
  //extract text tag pairs
  const [text_tag_pairs, text_nodes, startOffset, endOffset] =
    extractTextTagPairs(range);
  // surroundContents
  surroundContents(range, text_nodes, startOffset, endOffset, color);

  // range.surroundContents(span);
  // const span = document.createElement("div");
  // span.style.backgroundColor = "cyan";
  // span.appendChild(range.extractContents());
  // range.insertNode(span);

  //adding highlight
  window.getSelection().removeAllRanges();
  chrome.runtime
    .sendMessage({
      type: "add_highlights",
      url: window.location.href,
      text: range.toString(),
      text_tag_pairs: text_tag_pairs,
      startOffset: startOffset,
      endOffset: endOffset,
      color: color,
    })
    .then((response) => {
      console.log("Added successfully", response);
    });
}

function surroundContents(
  range,
  text_nodes = undefined,
  startOffset,
  endOffset,
  color = "cyan",
) {
  if (text_nodes === undefined) {
    const [_, text_nodes, startOffset, endOffset] = extractTextTagPairs(range);
  }

  const startRange = document.createRange();
  startRange.setStart(text_nodes[0]["node"], startOffset);
  startRange.setEnd(
    text_nodes[0]["node"],
    startOffset + text_nodes[0]["text"].length,
  );
  let startSpan = document.createElement("span");
  startSpan.style.backgroundColor = color;
  // is span by reference?
  const endRange = document.createRange();
  endRange.setStart(
    text_nodes.at(-1)["node"],
    text_nodes.length > 1 ? 0 : startOffset,
  );
  endRange.setEnd(text_nodes.at(-1)["node"], endOffset);
  let endSpan = document.createElement("span");
  endSpan.style.backgroundColor = color;

  startRange.surroundContents(startSpan);
  endRange.surroundContents(endSpan);

  // first node and last node, we need to consider the offset?
  for (let k = 1; k < text_nodes.length - 1; k++) {
    text_nodes[k]["node"].parentElement.style.backgroundColor = color;
  }
  return;
}
