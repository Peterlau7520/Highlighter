// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeNoteHtml } from "./sanitizeNote.js";

describe("sanitizeNoteHtml", () => {
  it("strips <script> tags entirely", () => {
    expect(sanitizeNoteHtml("hi<script>alert(1)</script>there")).toBe(
      "hithere",
    );
  });

  it("strips event handler attributes", () => {
    expect(sanitizeNoteHtml('<img src=x onerror="alert(1)">')).not.toContain(
      "onerror",
    );
  });

  it("strips disallowed tags but keeps their text content", () => {
    expect(sanitizeNoteHtml("<a href='https://evil.example'>click</a>")).toBe(
      "click",
    );
  });

  it("strips all attributes, even on allowed tags", () => {
    expect(sanitizeNoteHtml('<b style="color:red" class="x">bold</b>')).toBe(
      "<b>bold</b>",
    );
  });

  it("keeps allowlisted formatting tags", () => {
    expect(sanitizeNoteHtml("<b>bold</b> <i>italic</i> <u>underline</u>")).toBe(
      "<b>bold</b> <i>italic</i> <u>underline</u>",
    );
    expect(sanitizeNoteHtml("<ul><li>one</li><li>two</li></ul>")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });
});
