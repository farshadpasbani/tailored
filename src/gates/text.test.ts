import { describe, it, expect } from "vitest";
import { lineAt } from "./text.js";

describe("lineAt", () => {
  it("is 1-based and returns 1 for the first line", () => {
    expect(lineAt("hello world", 0)).toBe(1);
    expect(lineAt("hello world", 6)).toBe(1);
  });
  it("counts newlines before the index", () => {
    const text = "one\ntwo\nthree";
    expect(lineAt(text, text.indexOf("two"))).toBe(2);
    expect(lineAt(text, text.indexOf("three"))).toBe(3);
  });
  it("reports the line of the newline character itself as the line it ends", () => {
    // index of the first '\n' is still on line 1
    expect(lineAt("a\nb", 1)).toBe(1);
  });
});
