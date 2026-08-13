console.log("content.js is alive");

import { highlight } from "./paint.js";
import { isEventInsideNotePopover } from "./notePopover.js";

document.addEventListener("mouseup", async (e) => {
  // Selecting/editing text inside our own note popover isn't a page
  // selection to offer highlighting on — skip it, otherwise the
  // color-picker tooltip pops up on top of the note editor.
  if (isEventInsideNotePopover(e.target)) return;

  await new Promise((resolve) => setTimeout(resolve, 2));

  const selection = window.getSelection();
  if (!selection) return;

  const text = selection.toString();
  if (!text) {
    removeTooltip("fired from mouseup — no text");
    return;
  }

  console.log("text", text);
  showTooltip(selection);
});

function showTooltip(selection: Selection): void {
  removeTooltip("fired from mouseup");
  const range = selection.getRangeAt(0);
  const startRange = range.cloneRange();
  startRange.collapse(true);
  const startRect = startRange.getBoundingClientRect();
  const top = startRect.top + window.scrollY - 60;
  const left = startRect.left + window.scrollX;

  const tooltip = document.createElement("div");
  tooltip.id = "my-ext-tooltip";

  const colors = ["cyan", "yellow", "red", "green"];
  tooltip.innerHTML = `
    <div style="position:absolute;top:${top}px;left:${left}px;background:#333;color:#fff;padding:4px 8px;border-radius:4px;font-size:13px;z-index:999999;">
      <span id="highlight-btn">Highlight?</span>
      <div style="display:flex;gap:6px;margin-top:4px;">
        ${colors.map((c) => `<span class="my-ext-swatch" data-color="${c}" style="display:inline-block;width:14px;height:14px;background:${c};border:1px solid #fff;border-radius:3px;cursor:pointer;"></span>`).join("")}
      </div>
    </div>
  `;

  tooltip.querySelectorAll(".my-ext-swatch").forEach((el) => {
    const swatch = el as HTMLElement;
    swatch.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const color = swatch.dataset.color ?? "cyan";
      console.log("clicked", color);
      removeTooltip("fired from swatch mousedown");
      highlight(range, color);
    });
  });

  document.body.appendChild(tooltip);
}

function removeTooltip(where: string): void {
  console.log(`removing ${where}`);
  document.getElementById("my-ext-tooltip")?.remove();
}
