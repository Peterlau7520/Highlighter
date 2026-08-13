import { sanitizeNoteHtml } from "../lib/sanitizeNote.js";
import type { UpdateNoteResponse } from "../types.js";

const POPOVER_ID = "my-ext-note-popover";
const HIDE_GRACE_MS = 150;
const FONT_FAMILY =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
const FORMAT_COMMANDS = [
  { command: "bold", label: "B", style: "font-weight:700;" },
  { command: "italic", label: "I", style: "font-style:italic;" },
  { command: "underline", label: "U", style: "text-decoration:underline;" },
] as const;

/**
 * Attaches a hover-to-preview, click-to-edit note popover shared across a
 * highlight's trigger elements (its start/end spans — see
 * content/paint.ts's surroundContents). All triggers show/edit the same
 * underlying note.
 *
 * - Hover a trigger → sanitized read-only preview (or a "+ Add note"
 *   placeholder), positioned under the trigger.
 * - Click the popover → contenteditable box + Bold/Italic/Underline
 *   toolbar. The popover stays open for the whole edit session — clicks
 *   and text selection inside it (toolbar buttons, the editable box
 *   itself) must NOT be treated as "entering edit mode" again, which is
 *   why every interaction below is guarded by `editing`.
 * - Losing focus (not just mouse leaving — see below) while editing →
 *   sanitizes, saves via `update_note` if changed, and collapses.
 *
 * @param triggers - the highlight's wrapping span(s)
 * @param highlightId - the highlight's `_id`, used as the update target
 * @param initialNote - the note's current sanitized HTML, or "" if none yet
 */
export function attachNotePopover(
  triggers: HTMLElement[],
  highlightId: string,
  initialNote: string,
): void {
  let note = initialNote;
  let editing = false;
  let popover: HTMLDivElement | null = null;
  let editableBox: HTMLDivElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelHide(): void {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
  }

  function scheduleHide(): void {
    if (editing) return;
    cancelHide();
    hideTimer = setTimeout(removePopover, HIDE_GRACE_MS);
  }

  function removePopover(): void {
    popover?.remove();
    popover = null;
    editableBox = null;
    editing = false;
  }

  function positionNear(target: HTMLElement, el: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    el.style.position = "absolute";
    el.style.top = `${rect.bottom + window.scrollY + 6}px`;
    el.style.left = `${rect.left + window.scrollX}px`;
  }

  function showPreview(target: HTMLElement): void {
    if (popover) return;
    const div = document.createElement("div");
    div.id = POPOVER_ID;
    div.style.cssText =
      `z-index:999999;background:#fff;color:#222;border:1px solid #e2e2e2;` +
      `border-radius:8px;padding:8px 10px;font:13px/1.4 ${FONT_FAMILY};` +
      `max-width:240px;box-shadow:0 4px 16px rgba(0,0,0,0.14);cursor:text;` +
      `opacity:0;transition:opacity 120ms ease-out;`;
    div.innerHTML = note
      ? sanitizeNoteHtml(note)
      : '<span style="color:#9a9a9a;font-style:italic;">+ Add note</span>';
    positionNear(target, div);

    div.addEventListener("mousedown", (e) => {
      if (editing) return; // already editing — let the click/selection through
      e.preventDefault(); // don't steal the page's text selection/focus
      enterEditMode(div);
    });
    div.addEventListener("mouseenter", cancelHide);
    div.addEventListener("mouseleave", scheduleHide);

    document.body.appendChild(div);
    popover = div;
    requestAnimationFrame(() => {
      div.style.opacity = "1";
    });
  }

  function refreshToolbarState(toolbar: HTMLDivElement): void {
    toolbar.querySelectorAll<HTMLButtonElement>("button[data-command]").forEach((button) => {
      const command = button.dataset.command;
      const active = !!command && document.queryCommandState(command);
      button.style.background = active ? "#dbe6ff" : "transparent";
      button.style.borderColor = active ? "#8fb3ff" : "#d8d8d8";
    });
  }

  function enterEditMode(container: HTMLDivElement): void {
    editing = true;
    cancelHide();
    container.style.cursor = "default";
    container.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.style.cssText =
      "display:flex;gap:4px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #eee;";
    FORMAT_COMMANDS.forEach(({ command, label, style }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.command = command;
      button.textContent = label;
      button.title = command[0].toUpperCase() + command.slice(1);
      button.style.cssText =
        `${style}width:22px;height:22px;line-height:20px;padding:0;` +
        "font-size:12px;cursor:pointer;border:1px solid #d8d8d8;" +
        "border-radius:4px;background:transparent;color:#333;";
      // mousedown (not click) + preventDefault, so focus never leaves the
      // editable box — otherwise the box's focusout would fire and collapse
      // the popover before the format command even runs.
      button.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.execCommand(command);
        refreshToolbarState(toolbar);
      });
      toolbar.appendChild(button);
    });

    const box = document.createElement("div");
    box.contentEditable = "true";
    box.style.cssText =
      `min-width:180px;min-height:44px;font:13px/1.4 ${FONT_FAMILY};` +
      "outline:none;border:1px solid #d8d8d8;border-radius:4px;" +
      "padding:6px;background:#fff;";
    box.innerHTML = sanitizeNoteHtml(note);
    box.addEventListener("mouseup", () => refreshToolbarState(toolbar));
    box.addEventListener("keyup", () => refreshToolbarState(toolbar));
    box.addEventListener("focus", () => {
      box.style.borderColor = "#8fb3ff";
      box.style.boxShadow = "0 0 0 2px rgba(90,140,255,0.15)";
    });
    box.addEventListener("blur", () => {
      box.style.borderColor = "#d8d8d8";
      box.style.boxShadow = "none";
    });

    container.appendChild(toolbar);
    container.appendChild(box);
    editableBox = box;
    box.focus();

    // Using focusout (not mouseleave) to detect "left the area": clicking a
    // toolbar button, or selecting text with the mouse, momentarily
    // interacts outside strict box bounds, which would falsely trigger a
    // mouse-based collapse mid-edit.
    container.addEventListener("focusout", (e) => {
      const next = (e as FocusEvent).relatedTarget as Node | null;
      if (next && container.contains(next)) return; // focus moved within the popover (e.g. a toolbar button)
      void saveAndCollapse();
    });
  }

  async function saveAndCollapse(): Promise<void> {
    const box = editableBox;
    removePopover();
    if (!box) return;

    const sanitized = sanitizeNoteHtml(box.innerHTML);
    if (sanitized === note) return; // nothing changed, skip the write
    note = sanitized;

    const response: UpdateNoteResponse = await chrome.runtime.sendMessage({
      type: "update_note",
      highlightId,
      note,
    });
    if (response.error) {
      console.log("could not save note:", response.error);
    }
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("mouseenter", () => {
      cancelHide();
      showPreview(trigger);
    });
    trigger.addEventListener("mouseleave", scheduleHide);
  });
}

/**
 * Whether an event target is inside the note popover (preview or edit
 * mode). Used by content/main.ts to skip its page-wide `mouseup` handler
 * when a selection happens inside our own injected UI rather than real
 * page content — otherwise selecting/editing note text would also pop up
 * the highlight color-picker tooltip on top of it.
 */
export function isEventInsideNotePopover(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`#${POPOVER_ID}`) !== null;
}
