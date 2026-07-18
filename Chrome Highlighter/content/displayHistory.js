/**
 * Dependencies:
 * util.js's indexOfAll function,
 *
 */

/**
 * Runs immediately on injection. Asks background.js for all saved
 * highlights on the current page (`get_highlights`), then re-applies each
 * one to the DOM via `highlight_text_tag_pairs`, so highlights persist
 * across page reloads.
 */
async function displayHighlightHistory() {
  //
  console.log("sending message");
  console.log(window.location.href);
  const { highlights, error } = await chrome.runtime.sendMessage({
    type: "get_highlights",
    url: window.location.href,
  }); //returning a Promise object
  if (error) {
    // e.g. "auth_required" — not signed in and silent refresh failed.
    // background.js already surfaces this via the toolbar badge, so just skip.
    console.log("could not load highlight history:", error);
    return;
  }
  console.log(typeof highlights);
  console.log("highlights", highlights);

  // for each highlight's text_tag_pairs; double for loop
  highlights.forEach((element) => {
    //const savedText = range.toString();
    console.log("dissecting and highlighting", element.text);
    try {
      highlight_text_tag_pairs(element);
    } catch (e) {
      console.log("highlight_text_tag_pairs threw:", e);
    }
  });
}

/**
 * Given one saved highlight record (its `text_tag_pairs`, offsets, and
 * color), searches the page's text nodes for a run matching that recorded
 * text/tag sequence and re-wraps them in colored spans/backgrounds — the
 * reload-time counterpart to `surroundContents` in paint.js.
 *
 * @param {object} element - a saved highlight record from the backend
 * @param {Array<{text: string, tag: string}>} element.text_tag_pairs
 * @param {number} element.startOffset
 * @param {number} element.endOffset
 * @param {string} [element.color]
 * @returns {number|undefined} -1 if no matching text was found on the page, otherwise undefined
 */
function highlight_text_tag_pairs(element) {
  console.log("element", element);
  const text_tag_pairs = element.text_tag_pairs;
  const startOffset = element.startOffset;
  const endOffset = element.endOffset;
  const color = element.color == undefined ? "cyan" : element.color;

  const body = document.body.innerText;
  const indices = indexOfAll(body, text_tag_pairs[0]["text"]);
  if (indices.length === 0) {
    return -1;
  }
  // get the list of nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const tag = node.parentElement?.tagName;
        if (tag === "SCRIPT" || tag === "STYLE") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let nodes = [];
  if (walker.currentNode.nodeType === Node.TEXT_NODE) {
    nodes.push(walker.currentNode);
  }
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (let i = 0; i < nodes.length; i++) {
    if (
      nodes[i].textContent.includes(text_tag_pairs[0]["text"]) &&
      nodes[i].parentElement?.tagName === text_tag_pairs[0]["tag"]
    ) {
      let count = 1;
      let j = i + 1;
      while (
        count < text_tag_pairs.length &&
        nodes[j].textContent.includes(text_tag_pairs[count]["text"]) &&
        nodes[j].parentElement?.tagName === text_tag_pairs[count]["tag"]
      ) {
        j += 1;
        count += 1;
      }
      // the no. of text_tag pairs matches with the count
      if (count === text_tag_pairs.length) {
        // first node and last node, we need to consider the offset?
        const startRange = document.createRange();
        startRange.setStart(nodes[i], startOffset); //covers the highlighted portion of the first text node:
        startRange.setEnd(
          nodes[i],
          startOffset + text_tag_pairs[0]["text"].length,
        );
        let startSpan = document.createElement("span");
        startSpan.style.backgroundColor = color;
        // is span by reference?
        const endRange = document.createRange();
        endRange.setStart(
          nodes[i + count - 1],
          text_tag_pairs.length > 1 ? 0 : startOffset,
        );
        endRange.setEnd(nodes[i + count - 1], endOffset); //covers the highlighted portion of the last text node:
        let endSpan = document.createElement("span");
        endSpan.style.backgroundColor = color;

        startRange.surroundContents(startSpan);
        endRange.surroundContents(endSpan);

        //startSpan and endSpan range objects are already styled.
        for (let k = i + 1; k < i + count - 1; k++) {
          nodes[k].parentElement.style.backgroundColor = color;
        }

        //**Todo */
        //wrap startSpan and endSpan with another span that shows a tooltip for removal;
        //removal could based just based on record id..

        break;
      }
    }
    // try each index in indices -----> if the trailing nodes match all the text_tag_pairs
  }
}

displayHighlightHistory();
