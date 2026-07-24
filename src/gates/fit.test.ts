import { describe, it, expect } from "vitest";
import { canonToText, analyzeFit, validateThresholds } from "./fit.js";
import type { Canon } from "../canon/schema.js";
import type { Jd } from "../jd/schema.js";

const minimalCanon: Canon = {
  identity: { name: "Jane Doe", role: "Engineer" },
  skills: [],
  projects: [],
  experience: [],
  education: [],
  certifications: [],
  publications: [],
  protectedTopics: [],
};

describe("canonToText", () => {
  it("includes the summary", () => {
    const canon: Canon = { ...minimalCanon, summary: "Builds deterministic guardrails around stochastic models." };
    expect(canonToText(canon)).toContain("deterministic guardrails");
  });

  it("includes skill labels and values", () => {
    const canon: Canon = { ...minimalCanon, skills: [{ label: "Languages", value: "TypeScript, Python" }] };
    const text = canonToText(canon);
    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
  });

  it("includes project names, taglines, and bullets", () => {
    const canon: Canon = {
      ...minimalCanon,
      projects: [{ name: "Gatehouse", tagline: "a policy layer", bullets: ["Cut review time by two thirds."] }],
    };
    const text = canonToText(canon);
    expect(text).toContain("Gatehouse");
    expect(text).toContain("policy layer");
    expect(text).toContain("Cut review time");
  });

  it("includes experience titles, orgs, and bullets", () => {
    const canon: Canon = {
      ...minimalCanon,
      experience: [{ title: "Senior AI Engineer", org: "Meridian Labs", start: "2022", end: "Present", bullets: ["Shipped a retrieval service."] }],
    };
    const text = canonToText(canon);
    expect(text).toContain("Senior AI Engineer");
    expect(text).toContain("Meridian Labs");
    expect(text).toContain("Shipped a retrieval service");
  });

  it("includes education, certifications, publications, and claims", () => {
    const canon: Canon = {
      ...minimalCanon,
      education: [{ qualification: "BSc Computer Science", institution: "University of Leeds", year: "2016" }],
      certifications: ["AWS Certified Solutions Architect"],
      publications: ["Grounding language models in retrieved evidence"],
      claims: { can: ["speak to production incident response"] },
    };
    const text = canonToText(canon);
    expect(text).toContain("BSc Computer Science");
    expect(text).toContain("University of Leeds");
    expect(text).toContain("AWS Certified Solutions Architect");
    expect(text).toContain("Grounding language models");
    expect(text).toContain("production incident response");
  });
});

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
