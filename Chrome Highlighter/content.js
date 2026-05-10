console.log("content.js is alive");
document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (!text) {
    removeTooltip("firedfrom mouseup 0 text highlight");
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  showTooltip(rect, selection);
});

function showTooltip(rect, selection) {
  removeTooltip("firedfrom mouseup"); // clear any existing one
  const range = selection.getRangeAt(0); // capture before it's lost

  const tooltip = document.createElement("div");
  tooltip.id = "my-ext-tooltip";
  tooltip.innerHTML = `
        <div style="
        position: fixed;
        top: ${rect.top - 40}px;
        left: ${rect.left}px;
        background: #333;
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 13px;
        z-index: 999999;
        ">
        <span id="highlight-btn">Highlight?</span>
        </div>
    `;

  tooltip.querySelector("#highlight-btn").addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation(); // stop document mousedown from removing tooltip
    console.log("clicked");
    removeTooltip("fired from mousedown");
    highlight(range);
  });
  document.body.appendChild(tooltip);
}

function highlight(range) {
  //extract text tag pairs
  const [text_tag_pairs, text_nodes, startOffset, endOffset] =
    extractTextTagPairs(range);
  // surroundContents
  surroundContents(range, text_nodes, startOffset, endOffset);

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
    })
    .then((response) => {
      console.log("Added successfully", response);
    });
}

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

  return [text_tag_pairs, text_nodes, range.startOffset, range.endOffset];
}

function surroundContents(
  range,
  text_nodes = undefined,
  startOffset,
  endOffset,
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
  startSpan.style.backgroundColor = "cyan";
  // is span by reference?
  const endRange = document.createRange();
  endRange.setStart(
    text_nodes.at(-1)["node"],
    text_nodes.length > 1 ? 0 : startOffset,
  );
  endRange.setEnd(text_nodes.at(-1)["node"], endOffset);
  let endSpan = document.createElement("span");
  endSpan.style.backgroundColor = "cyan";

  startRange.surroundContents(startSpan);
  endRange.surroundContents(endSpan);

  // first node and last node, we need to consider the offset?
  for (let k = 1; k < text_nodes.length - 1; k++) {
    text_nodes[k]["node"].parentElement.style.backgroundColor = "cyan";
  }
  return;
}

function removeTooltip(where) {
  console.log(`removing ${where}`);
  document.getElementById("my-ext-tooltip")?.remove();
}

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
        startSpan.style.backgroundColor = "cyan";
        // is span by reference?
        const endRange = document.createRange();
        endRange.setStart(
          nodes[i + count - 1],
          text_tag_pairs.length > 1 ? 0 : startOffset,
        );
        endRange.setEnd(nodes[i + count - 1], endOffset);
        let endSpan = document.createElement("span");
        endSpan.style.backgroundColor = "cyan";

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

function indexOfAll(str, needle) {
  const indices = [];
  let i = 0;
  while ((i = str.indexOf(needle, i)) !== -1) {
    indices.push(i);
    i += needle.length; // skip past this match to avoid infinite loop on empty string
  }
  return indices;
}

displayHighlightHistory();
