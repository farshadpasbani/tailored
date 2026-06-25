import { describe, it, expect } from "vitest";
import { lintAiTells } from "./aiTell.js";
describe("lintAiTells", () => {
  it("flags an em dash", () => { const r = lintAiTells("foo — bar"); expect(r).toHaveLength(1); expect(r[0].rule).toBe("em-dash"); });
  it("flags a -- connector and the &mdash; entity", () => {
    expect(lintAiTells("a -- b").some(i => i.rule === "double-hyphen-connector")).toBe(true);
    expect(lintAiTells("a&mdash;b").some(i => i.rule === "mdash-entity")).toBe(true);
  });
  it("flags the &mdash; entity case-insensitively (e.g. &MDASH;)", () => {
    expect(lintAiTells("a&MDASH;b").some(i => i.rule === "mdash-entity")).toBe(true);
  });
  it("does NOT flag en dash ranges or compound hyphens", () => { expect(lintAiTells("2022–Present, low-carbon")).toEqual([]); });
  it("reports a 1-based line number", () => { expect(lintAiTells("ok\nbad — here")[0].line).toBe(2); });
});
