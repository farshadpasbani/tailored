import { describe, it, expect } from "vitest";
import { parseJd } from "./load.js";

describe("parseJd", () => {
  it("accepts a minimal valid jd", () => {
    const r = parseJd({ role: "ML Engineer", mustHave: ["python"] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.mustHave).toEqual(["python"]);
      expect(r.data.niceToHave).toEqual([]);
      expect(r.data.synonyms).toEqual({});
    }
  });
  it("rejects empty mustHave", () => {
    const r = parseJd({ role: "X", mustHave: [] });
    expect(r.ok).toBe(false);
  });
  it("rejects missing role", () => {
    const r = parseJd({ mustHave: ["python"] });
    expect(r.ok).toBe(false);
  });
  it("keeps synonyms map", () => {
    const r = parseJd({ role: "X", mustHave: ["machine learning"], synonyms: { "machine learning": ["ML"] } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.synonyms["machine learning"]).toEqual(["ML"]);
  });
});
