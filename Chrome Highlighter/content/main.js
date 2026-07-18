console.log("content.js is alive");
/**
 * Dependencies:
 * paint.js's highlight function,
 *
 */

/**
 * Fires on every mouseup on the page. Waits 2ms for the browser to finish
 * updating the selection, then reads the current text selection: if it's
 * non-empty, shows the color-picker tooltip via `showTooltip`; otherwise
 * removes any existing tooltip.
 */
document.addEventListener("mouseup", async () => {
  await new Promise((resolve) => setTimeout(resolve, 2));
  //wait for 2 seconds

  const selection = window.getSelection();
  const text = selection.toString();

  // const selection = window.getSelection();
  // const text = selection.toString().trim();

  if (!text) {
    removeTooltip("firedfrom mouseup 0 text highlight");
    return;
  }

  console.log("text", text);

  const range = selection.getRangeAt(0);
  //Yes, by default, it is 1 (or 0 if no text is selected at all) because Google Chrome uses the Blink layout engine,

  showTooltip(selection);
});

/**
 * Renders a floating tooltip with 4 color swatches near the start of
 * `selection`. Mousedown on a swatch removes the tooltip and calls
 * `highlight(range, color)` (paint.js) to persist the highlight.
 *
 * @param {Selection} selection - the current window selection
 */
function showTooltip(selection) {
  removeTooltip("firedfrom mouseup"); // clear any existing one
  const range = selection.getRangeAt(0); // capture before it's lost
  const startRange = range.cloneRange();
  startRange.collapse(true);
  const startRect = startRange.getBoundingClientRect();
  const top = startRect.top + window.scrollY - 60;
  const left = startRect.left + window.scrollX;

  const tooltip = document.createElement("div");
  tooltip.id = "my-ext-tooltip";
  //top: ${rect.top - 40}px;
  const colors = ["cyan", "yellow", "red", "green"];
  tooltip.innerHTML = `
        <div style="
        position: absolute;
        top: ${top}px;
        left: ${left}px;
        background: #333;
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 13px;
        z-index: 999999;
        ">
        <span id="highlight-btn">Highlight?</span>
                <div style="display: flex; gap: 6px; margin-top: 4px;">
        ${colors
          .map(
            (c) =>
              `<span class="my-ext-swatch" data-color="${c}" style="display:inline-block;width:14px;height:14px;background:${c};border:1px solid #fff;border-radius:3px;cursor:pointer;"></span>`,
          )
          .join("")}
        </div>
        </div>
    `;

  // tooltip.querySelector("#highlight-btn").addEventListener("mousedown", (e) => {
  //   e.preventDefault();
  //   e.stopPropagation(); // stop document mousedown from removing tooltip
  //   console.log("clicked");
  //   removeTooltip("fired from mousedown");
  //   highlight(range);
  // });
  tooltip.querySelectorAll(".my-ext-swatch").forEach((swatch) => {
    swatch.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation(); // stop document mousedown from removing tooltip
      const color = swatch.dataset.color;
      console.log("clicked", color);
      removeTooltip("fired from swatch mousedown");
      highlight(range, color);
    });
  });

  document.body.appendChild(tooltip);
}

/**
 * Removes the tooltip element from the DOM if present.
 *
 * @param {string} where - debug label logged to trace which caller triggered the removal
 */
function removeTooltip(where) {
  console.log(`removing ${where}`);
  document.getElementById("my-ext-tooltip")?.remove();
}
