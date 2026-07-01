import { describe, it, expect } from "vitest";
import { lineAt, htmlToText, normalizeNumber, countWords } from "./text.js";

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

describe("htmlToText", () => {
  it("strips tags, leaving the rendered text", () => {
    expect(htmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
  it("drops style and script contents entirely, not just the tags", () => {
    const html = "<style>.name{font-size:25pt}</style><p>Alex</p><script>var x=40;</script>";
    expect(htmlToText(html)).toBe("Alex");
  });
  it("decodes common HTML entities", () => {
    expect(htmlToText("Q&amp;A &lt;tag&gt; &quot;quote&quot; &#39;s&#39; a&nbsp;b")).toBe(`Q&A <tag> "quote" 's' a b`);
  });
});

describe("normalizeNumber", () => {
  it("treats a bare percentage and its bare number as the same value", () => {
    expect(normalizeNumber("40%")).toBe(40);
    expect(normalizeNumber("40")).toBe(40);
  });
  it("expands a currency amount with a magnitude suffix", () => {
    expect(normalizeNumber("£1.2m")).toBe(1_200_000);
    expect(normalizeNumber("1200000")).toBe(1_200_000);
  });
  it("strips thousands separators", () => {
    expect(normalizeNumber("$50,000")).toBe(50_000);
  });
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("one two three")).toBe(3);
  });
  it("is 0 for empty or whitespace-only text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
