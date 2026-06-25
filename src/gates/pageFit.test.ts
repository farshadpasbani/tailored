import { describe, it, expect } from "vitest";
import { parsePdfinfoPages, assertPageFit } from "./pageFit.js";
describe("page-fit", () => {
  it("parses the page count from pdfinfo output", () => { expect(parsePdfinfoPages("Title:\nPages:          2\nEncrypted: no")).toBe(2); });
  it("throws a clear error when no count is present", () => { expect(() => parsePdfinfoPages("garbage")).toThrow(/page count/i); });
  it("fails the assertion when over the max", async () => {
    const fakeRun = async () => "Pages: 3";
    expect(await assertPageFit("x.pdf", 2, fakeRun)).toEqual({ ok: false, pages: 3, max: 2 });
  });
});
