/**
 * Called when the user picks a color from the tooltip. Extracts the
 * text/tag structure of `range` via `extractTextTagPairs`, visually wraps
 * it in colored spans via `surroundContents`, clears the browser selection,
 * then sends an `add_highlights` message to background.js to persist it.
 *
 * @param {Range} range - the DOM range that was selected
 * @param {string} color - CSS color name/value chosen from the tooltip
 */
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
      if (response.error) {
        // e.g. "auth_required" — not signed in and silent refresh failed.
        // background.js already surfaces this via the toolbar badge, so just skip.
        console.log("could not save highlight:", response.error);
        return;
      }
      console.log("Added successfully", response);
    });
}

/**
 * Applies the highlight color to the DOM: wraps the relevant slice of the
 * first and last text node in colored `<span>`s, and sets `backgroundColor`
 * directly on the parent elements of any nodes in between. Re-derives
 * `text_nodes`/offsets from `range` if not passed explicitly.
 *
 * @param {Range} range - the DOM range being highlighted
 * @param {Array<{node: Text, text: string}>} [text_nodes] - text nodes spanned by the range, from extractTextTagPairs
 * @param {number} startOffset - character offset into the first text node
 * @param {number} endOffset - character offset into the last text node
 * @param {string} [color="cyan"] - CSS color to apply
 */
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
