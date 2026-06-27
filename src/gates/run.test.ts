import { describe, it, expect } from "vitest";
import { extractPdfText } from "./run.js";

describe("extractPdfText", () => {
  it("returns pdftotext stdout via the injected runner", async () => {
    const fake = async (cmd: string, args: string[]) => {
      expect(cmd).toBe("pdftotext");
      expect(args).toContain("-");
      return "Jane Doe\njane@x.com\nEXPERIENCE\n";
    };
    expect(await extractPdfText("cv.pdf", fake)).toContain("EXPERIENCE");
  });
});
