// content.js
//alert("content.js is alive");
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
//document.addEventListener("mousedown", removeTooltip);
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
  const span = document.createElement("span");
  span.style.backgroundColor = "cyan";
  // extract text, tag pairs
  const [text_tag_pairs, text_nodes] = extractTextTagPairs(range);
  // surroundContents
  surroundContents(range, text_nodes);

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
  do {
    text_tag_pairs.push({
      text: walker.currentNode.textContent,
      tag: walker.currentNode.parentElement.tagName,
    });
    text_nodes.push(walker.currentNode);
  } while (walker.nextNode());
  return [text_tag_pairs, text_nodes];
}

function surroundContents(range, text_nodes = undefined) {
  if (text_nodes === undefined) {
    const [_, text_nodes] = extractTextTagPairs(range);
  }
  text_nodes.forEach((node) => {
    node.parentElement.style.backgroundColor = "cyan";
  });
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

  // for each highlight's text_pair_tags; double for loop
  highlights.forEach((element) => {
    //const savedText = range.toString();
    console.log("dissecting and highlighting", element.text);
    try {
      highlight_text_tag_pairs(element.text_tag_pairs);
      // element.text_tag_pairs?.forEach((pair) => {
      //   const restoredRange = restoreRange(pair.text, pair.tag);
      //   //console.log("restoredRange", restoredRange);
      //   const span = document.createElement("span");
      //   span.style.backgroundColor = "cyan";
      //   restoredRange.surroundContents(span);
      //   console.log("highlighted");
      // });
    } catch (e) {
      console.log("restoreRange threw:", e);
    }
  });
}

// NEED SOME SERIUOS DEBUGGING
function highlight_text_tag_pairs(text_pair_tags) {
  const body = document.body.innerText;
  const indices = indexOfAll(body, text_pair_tags[0]["text"]);
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

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (let i = 0; i < nodes.length; i++) {
    if (
      nodes[i].textContent.includes(text_pair_tags[0]["text"]) &&
      nodes[i].parentElement?.tagName === text_pair_tags[0]["tag"]
    ) {
      let count = 1;
      let j = i + 1;
      while (
        count < text_pair_tags.length &&
        nodes[j].textContent.includes(text_pair_tags[count]["text"]) &&
        nodes[j].parentElement?.tagName === text_pair_tags[count]["tag"]
      ) {
        j += 1;
        count += 1;
      }
      if (count === text_pair_tags.length) {
        for (let k = i; k < i + count; k++) {
          nodes[k].parentElement.style.backgroundColor = "cyan";
        }
      }
    }

    // try each index in indices -----> if the trailing nodes match all the text_pair_tags
  }
}
// restore later
function restoreRange(savedText, tag) {
  const body = document.body.innerText;
  const index = body.indexOf(savedText);
  const indices = indexOfAll(body, savedText);
  if (indices.length == 0) {
    return -1;
  }

  // text-based walker;
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
  let count = 0;
  while (walker.nextNode()) {
    // check tag here

    // check both text and tag
    if (
      walker.currentNode.textContent.includes(savedText) &&
      walker.currentNode.parentElement?.tagName === tag
    ) {
      // walker.currentNode.parentElement?.tagName short circuited to null / undefined if needed
      const node = walker.currentNode;

      const range = document.createRange();
      start = walker.currentNode.textContent.indexOf(savedText);
      range.setStart(node, start);
      range.setEnd(node, start + savedText.length);
      return range;
    }
  }
  console.log("out not found");
  return null;
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
