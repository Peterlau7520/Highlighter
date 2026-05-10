async function displayHighlightHistory() {
  //
  console.log("sending message");
  console.log(window.location.href);
  const { highlights } = await chrome.runtime.sendMessage({
    type: "get_highlights",
    url: window.location.href,
  }); //returning a Promise object
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
      if (count === text_tag_pairs.length) {
        // first node and last node, we need to consider the offset?
        const startRange = document.createRange();
        startRange.setStart(nodes[i], startOffset);
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
        endRange.setEnd(nodes[i + count - 1], endOffset);
        let endSpan = document.createElement("span");
        endSpan.style.backgroundColor = color;

        startRange.surroundContents(startSpan);
        endRange.surroundContents(endSpan);

        for (let k = i + 1; k < i + count - 1; k++) {
          nodes[k].parentElement.style.backgroundColor = "cyan";
        }
        break;
      }
    }
    // try each index in indices -----> if the trailing nodes match all the text_tag_pairs
  }
}

displayHighlightHistory();
