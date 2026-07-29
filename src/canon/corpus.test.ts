import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { canonCorpus, CANON_CORPUS_FIELDS } from "./corpus.js";
import type { Canon } from "./schema.js";

const minimalCanon: Canon = {
  schemaVersion: 2,
  identity: { name: "Jane Doe", role: "Engineer" },
  skills: [],
  projects: [],
  experience: [],
  education: [],
  certifications: [],
  publications: [],
  protectedTopics: [],
  verifiedFacts: {},
  talkingPoints: {},
  ipBoundaries: [],
  discretion: {},
  draftingGuidance: {},
  facts: [],
};

const fullCanon: Canon = {
  ...minimalCanon,
  identity: {
    name: "Jane Doe", role: "Senior AI Engineer",
    location: "Bristol, UK", email: "jane@example.com", phone: "+44 117 496 0123",
    links: [{ label: "GitHub", url: "https://github.com/jane" }],
  },
  summary: "Builds deterministic guardrails around stochastic models.",
  skills: [{ label: "Languages", value: "TypeScript, Python" }],
  projects: [{ name: "Gatehouse", tagline: "a policy layer", year: "2024", bullets: ["Cut review time by 40%."], links: [{ label: "Repo", url: "https://example.com/gatehouse" }] }],
  experience: [{ title: "Senior AI Engineer", org: "Meridian Labs", location: "Bristol", start: "Jan 2022", end: "Present", bullets: ["Shipped a retrieval service."] }],
  education: [{ qualification: "BSc Computer Science", institution: "University of Leeds", result: "First", year: "2016", note: "dissertation on ranking" }],
  certifications: ["AWS Certified Solutions Architect"],
  publications: ["Grounding language models in retrieved evidence"],
  claims: { can: ["speak to production incident response"] },
};

describe("canonCorpus", () => {
  it("carries every field the fit matcher read", () => {
    const text = canonCorpus(fullCanon);
    for (const expected of [
      "deterministic guardrails", "TypeScript", "Python", "Gatehouse", "a policy layer",
      "Cut review time by 40%.", "Senior AI Engineer", "Meridian Labs", "Shipped a retrieval service.",
      "BSc Computer Science", "University of Leeds", "dissertation on ranking",
      "AWS Certified Solutions Architect", "Grounding language models",
      "production incident response",
    ]) expect(text).toContain(expected);
  });

  it("carries every field the trace corpus read, including the identity block and the dates a claim traces to", () => {
    const text = canonCorpus(fullCanon);
    for (const expected of [
      "Jane Doe", "Senior AI Engineer", "Bristol, UK", "jane@example.com", "+44 117 496 0123",
      "Jan 2022", "Present", "2016", "First",
    ]) expect(text).toContain(expected);
  });

  it("carries no canon field neither reader read, so a claim cannot trace to prose no gate has vetted", () => {
    const canon: Canon = {
      ...fullCanon,
      protectedTopics: ["RAAC survey work"],
      ipBoundaries: ["never name the client"],
      facts: [{
        id: "f1", statement: "Reduced latency to 37ms", kind: "metric", subject: "service",
        provenance: { type: "artifact", source: "dashboard" }, verifiedOn: "2026-01-01",
        status: "verified", confidence: 1, allowedUses: ["fit"], sensitivity: "public",
      }],
      numbersThatStand: { approved: ["93% first-pass yield"], rule: "only these" },
      positioning: { coreThesis: "gates over vibes", defaultPositioning: ["deterministic"] },
      talkingPoints: { tp1: { addedOn: "2026-01-01", useFor: "agentic", rule: "lead with the gate", hierarchy: ["a"], proof: "shipped 12 gates", keyWord: "gate", line: "the model proposes" } },
    };
    const text = canonCorpus(canon);
    for (const excluded of ["RAAC survey work", "never name the client", "37ms", "93% first-pass yield", "gates over vibes", "shipped 12 gates"]) {
      expect(text).not.toContain(excluded);
    }
  });

  it("keeps the rendered link and location strings out, so a number inside a URL cannot pass as canon evidence", () => {
    const text = canonCorpus(fullCanon);
    expect(text).not.toContain("https://github.com/jane");
    expect(text).not.toContain("https://example.com/gatehouse");
  });

  it("survives a canon with every optional field absent without emitting placeholder text", () => {
    const text = canonCorpus(minimalCanon);
    expect(text).toContain("Jane Doe");
    expect(text).not.toMatch(/undefined|null|\[object/);
  });

  it("declares its field set, so a reader can see what a claim may trace to", () => {
    expect(CANON_CORPUS_FIELDS).toContain("identity.name");
    expect(CANON_CORPUS_FIELDS).toContain("claims.can");
    expect(CANON_CORPUS_FIELDS).not.toContain("facts");
  });
});

describe("one projection", () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("is the only canon-to-text flattening in the gate layer", () => {
    for (const path of ["../gates/fit.ts", "../gates/trace.ts", "../gates/distinct.ts"]) {
      const text = source(path);
      expect(text, `${path} must not define its own canon projection`).not.toMatch(/function canon(ToText|Corpus)\b/);
      expect(text, `${path} must read the one projection`).toContain('from "../canon/corpus.js"');
    }
  });
});
