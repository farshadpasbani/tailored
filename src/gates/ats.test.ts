import { describe, it, expect } from "vitest";
import { parseChecks, keywordCoverage, analyzeAts } from "./ats.js";

const goodCv = `Jane Doe
jane@example.com
SUMMARY
ML engineer who builds deterministic guardrails around stochastic models.
EXPERIENCE
Built and shipped production models in Python and PyTorch, owning each feature
from the evaluation harness through to deployment, with a strong focus on
correctness, observability, and making the unhappy path fail loudly in continuous
integration rather than quietly in production over several years of work.
EDUCATION
BSc Computer Science.
SKILLS
machine learning, mlops`;

describe("parseChecks", () => {
  it("passes a normal CV", () => { expect(parseChecks(goodCv).ok).toBe(true); });
  it("fails an image-only PDF (no text layer)", () => {
    const r = parseChecks("  \n  "); expect(r.textLayer).toBe(false); expect(r.ok).toBe(false);
  });
  it("fails when no contact email is present", () => {
    const r = parseChecks("SUMMARY\nEXPERIENCE\nEDUCATION\nSKILLS\n" + "x".repeat(300));
    expect(r.contact).toBe(false); expect(r.ok).toBe(false);
  });
  it("fails when fewer than 3 standard headings are present", () => {
    const r = parseChecks("jane@example.com\nEXPERIENCE\n" + "x".repeat(300));
    expect(r.headings).toBeLessThan(3); expect(r.ok).toBe(false);
  });
});

describe("keywordCoverage", () => {
  it("matches case-insensitively", () => {
    expect(keywordCoverage("Built in PYTHON", ["python"], {}).covered).toEqual(["python"]);
  });
  it("matches a synonym", () => {
    const r = keywordCoverage("strong ML background", ["machine learning"], { "machine learning": ["ML"] });
    expect(r.covered).toEqual(["machine learning"]); expect(r.missing).toEqual([]);
  });
  it("is word-boundary aware (no java inside javascript)", () => {
    expect(keywordCoverage("expert in javascript", ["java"], {}).missing).toEqual(["java"]);
  });
  it("computes ratio and missing list", () => {
    const r = keywordCoverage("python only", ["python", "pytorch"], {});
    expect(r.ratio).toBeCloseTo(0.5); expect(r.missing).toEqual(["pytorch"]);
  });
  it("ratio is 1 for an empty term list", () => {
    expect(keywordCoverage("anything", [], {}).ratio).toBe(1);
  });
});

describe("analyzeAts", () => {
  const jd = { role: "ML", mustHave: ["python", "pytorch"], niceToHave: ["aws"], synonyms: {} };
  it("passes when parseable and coverage meets min", () => {
    expect(analyzeAts(goodCv, jd, 0.5).ok).toBe(true); // python present, pytorch present -> 1.0
  });
  it("fails when coverage below min", () => {
    const r = analyzeAts(goodCv, { ...jd, mustHave: ["python", "rust", "go"] }, 0.8);
    expect(r.ok).toBe(false); expect(r.must.missing).toContain("rust");
  });
  it("nice-to-have never affects ok", () => {
    const r = analyzeAts(goodCv, { ...jd, niceToHave: ["kubernetes"] }, 0.5);
    expect(r.ok).toBe(true); expect(r.nice.missing).toContain("kubernetes");
  });
  it("fails when not parseable even if coverage is perfect", () => {
    expect(analyzeAts("python pytorch", jd, 0.5).ok).toBe(false); // no headings/contact/short
  });
});
