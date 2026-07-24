import { describe, expect, it } from "vitest";
import { extractNumericClaims } from "./trace.js";

describe("shared numeric occurrence tokenizer", () => {
  it("classifies dates, phones, versions, references, percentages, and arbitrary units once", async () => {
    const { tokenizeNumericOccurrences } = await import("./numeric.js");
    const text = "On 2026-07-12, +1 202 555 0142 shipped v2.1 for issue #37; latency was 200ms and quality 90%.";
    const tokens = tokenizeNumericOccurrences(text);
    expect(tokens.map(({ raw, kind, value }) => ({ raw, kind, value }))).toEqual([
      { raw: "2026-07-12", kind: "date", value: undefined },
      { raw: "+1 202 555 0142", kind: "phone", value: 12025550142 },
      { raw: "v2.1", kind: "version", value: undefined },
      { raw: "issue #37", kind: "reference", value: undefined },
      { raw: "200ms", kind: "number", value: 200 },
      { raw: "90%", kind: "number", value: 90 },
    ]);
    expect(extractNumericClaims(text).map((claim) => [claim.raw, claim.value])).toEqual([
      ["+1 202 555 0142", 12025550142], ["200ms", 200], ["90%", 90],
    ]);
  });

  it("does not call a bare year or context-free hash a date/reference", async () => {
    const { tokenizeNumericOccurrences } = await import("./numeric.js");
    expect(tokenizeNumericOccurrences("Processed 2025 requests; served #999 customers.").map((token) => token.kind))
      .toEqual(["number", "number"]);
  });
});
