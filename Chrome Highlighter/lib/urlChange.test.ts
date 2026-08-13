import { describe, expect, it } from "vitest";
import { isUrlChangedMessage, shouldNotifyUrlChange } from "./urlChange.js";

describe("shouldNotifyUrlChange", () => {
  it("returns true for the top-level frame", () => {
    expect(shouldNotifyUrlChange({ frameId: 0 })).toBe(true);
  });

  it("returns false for an iframe", () => {
    expect(shouldNotifyUrlChange({ frameId: 1 })).toBe(false);
    expect(shouldNotifyUrlChange({ frameId: 42 })).toBe(false);
  });
});

describe("isUrlChangedMessage", () => {
  it("returns true for a well-formed url_changed message", () => {
    expect(
      isUrlChangedMessage({ type: "url_changed", url: "https://example.com" }),
    ).toBe(true);
  });

  it("returns false for other message types", () => {
    expect(isUrlChangedMessage({ type: "get_highlights", url: "x" })).toBe(
      false,
    );
  });

  it("returns false for non-object and nullish values", () => {
    expect(isUrlChangedMessage(undefined)).toBe(false);
    expect(isUrlChangedMessage(null)).toBe(false);
    expect(isUrlChangedMessage("url_changed")).toBe(false);
    expect(isUrlChangedMessage(42)).toBe(false);
    expect(isUrlChangedMessage({})).toBe(false);
  });
});
