import { describe, it, expect } from "vitest";
import { analyzeFit, validateThresholds } from "./fit.js";
import type { Jd } from "../jd/schema.js";

describe("analyzeFit", () => {
  const jd: Jd = { role: "AI Engineer", mustHave: ["python", "typescript"], niceToHave: ["kubernetes"], synonyms: {} };

  it("verdicts APPLY when must-have coverage meets the apply threshold", () => {
    const r = analyzeFit("expert in python and typescript", jd, { apply: 0.8, floor: 0.5 });
    expect(r.verdict).toBe("APPLY");
  });

  it("verdicts SKIP when must-have coverage is below the floor, listing each uncovered must-have", () => {
    const r = analyzeFit("built websites with react", jd, { apply: 0.8, floor: 0.5 });
    expect(r.verdict).toBe("SKIP");
    expect(r.must.missing).toEqual(["python", "typescript"]);
  });

  it("verdicts APPLY-WITH-GAPS between the floor and the apply threshold", () => {
    const r = analyzeFit("expert in python", jd, { apply: 0.8, floor: 0.4 });
    expect(r.verdict).toBe("APPLY-WITH-GAPS");
    expect(r.must.missing).toEqual(["typescript"]);
  });

  it("never lets nice-to-have coverage change the verdict", () => {
    const r = analyzeFit("expert in python and typescript", jd, { apply: 0.8, floor: 0.5 });
    expect(r.verdict).toBe("APPLY");
    expect(r.nice.missing).toEqual(["kubernetes"]);
  });
});

describe("validateThresholds", () => {
  it("rejects a floor above the apply threshold", () => {
    const r = validateThresholds(0.8, 0.9);
    expect(r).toMatch(/--floor.*--apply/);
  });

  it("accepts a floor at or below the apply threshold", () => {
    expect(validateThresholds(0.8, 0.5)).toBeUndefined();
  });
});
