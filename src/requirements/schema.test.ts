import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Canon } from "../canon/schema.js";
import { issueBaselineReceipt, loadRequirements, parseRequirements, prepareRequirementsBaseline, type Requirement } from "./schema.js";

function freezeBaseline(requirements: Requirement[], input: { frozenAt: string; archivedJdSha256: string; issuer: string }) {
  const prepared = prepareRequirementsBaseline(requirements);
  const receipt = issueBaselineReceipt(prepared.sha256, input);
  return { baseline: { ...prepared, receiptSha256: receipt.sha256 }, receipt };
}

const jd = "Must have Python. Sponsorship is not available.";
const sha256 = createHash("sha256").update(jd).digest("hex");
const canon = {
  schemaVersion: 2,
  identity: { name: "Jane", role: "Engineer" },
  skills: [], projects: [], experience: [], education: [], certifications: [], publications: [],
  protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {},
  facts: [{
    id: "fact-python", statement: "Uses Python", kind: "skill", subject: "Python",
    provenance: { type: "candidate-attested", source: "candidate" }, verifiedOn: "2026-07-12",
    status: "candidate-attested", confidence: 1, allowedUses: ["cv"], sensitivity: "public",
  }],
} satisfies Canon;

function valid() {
  const requirements = [{
    id: "req-python",
    source: { quote: "Must have Python", location: "opening sentence", span: { start: 0, end: 16 } },
    classification: { frozen: "hard" as const, current: "hard" as const },
    weight: 3,
    eligibilityImpact: "none" as const,
    ats: { literals: [{ term: "Python", source: { quote: "Python", location: "opening sentence", span: { start: 10, end: 16 } } }], aliases: [] },
    evidence: { kind: "direct" as const, factIds: ["fact-python"] },
  }];
  return {
    schemaVersion: 2,
    role: "Engineer",
    company: "Example",
    archivedJd: { sha256 },
    frozenAt: "2026-07-12T12:00:00.000Z",
    requirements,
    baseline: freezeBaseline(requirements, { frozenAt: "2026-07-12T12:00:00.000Z", archivedJdSha256: sha256, issuer: "test" }).baseline,
    changes: [],
  };
}

describe("requirements v2 parsing", () => {
  it("refuses to issue a malformed baseline receipt", () => {
    const validInput = { frozenAt: "2026-07-12T12:00:00.000Z", archivedJdSha256: sha256, issuer: "test" };
    for (const [baselineSha256, input] of [
      ["not-a-hash", validInput],
      ["a".repeat(64), { ...validInput, frozenAt: "not-an-instant" }],
      ["a".repeat(64), { ...validInput, archivedJdSha256: "not-a-hash" }],
      ["a".repeat(64), { ...validInput, issuer: "" }],
      ["a".repeat(64), { ...validInput, issuer: "   " }],
    ] as const) {
      expect(() => issueBaselineReceipt(baselineSha256, input)).toThrow();
    }
  });

  it("accepts a frozen requirement-evidence map", () => {
    const raw = valid();
    const receipt = issueBaselineReceipt(raw.baseline.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
    const result = parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: () => receipt });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty requirement list", () => {
    expect(parseRequirements({ ...valid(), requirements: [] }, { archivedJdText: jd, canon }).ok).toBe(false);
  });

  it("rejects missing archived-JD input and a stale archived-JD hash", () => {
    expect(parseRequirements(valid(), { canon }).ok).toBe(false);
    const stale = parseRequirements(valid(), { archivedJdText: `${jd} changed`, canon });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.errors.join("\n")).toMatch(/archivedJd\.sha256.*does not match/);
  });

  it("rejects a source quote absent from the hash-bound JD", () => {
    const raw = valid();
    raw.requirements[0].source.quote = "Must have Rust";
    const result = parseRequirements(raw, { archivedJdText: jd, canon });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/source\.quote.*not present/);
  });

  it("rejects duplicate and case-colliding requirement IDs", () => {
    const raw = valid();
    raw.requirements.push({ ...raw.requirements[0], id: "REQ-PYTHON" });
    const result = parseRequirements(raw, { archivedJdText: jd, canon });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/case-collides/);
  });

  it("rejects unknown and case-mismatched fact IDs", () => {
    for (const id of ["fact-rust", "FACT-PYTHON"]) {
      const raw = valid();
      raw.requirements[0].evidence = { kind: "direct", factIds: [id] };
      const result = parseRequirements(raw, { archivedJdText: jd, canon });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.join("\n")).toMatch(/Unknown canon fact ID|case does not match/);
    }
  });

  it("rejects an embedded classification waiver because post-freeze changes belong in changes[]", () => {
    const raw = valid();
    raw.requirements[0].classification.current = "preferred";
    const missing = parseRequirements(raw, { archivedJdText: jd, canon });
    expect(missing.ok).toBe(false);
    raw.requirements[0].classification.waiver = {
      id: "waiver-reclassify", date: "2026-07-12", approvedBy: "Jane", reason: "Employer clarification",
      archivedJdSha256: sha256,
      receiptSha256: "a".repeat(64),
    };
    expect(parseRequirements(raw, { archivedJdText: jd, canon }).ok).toBe(false);
  });

  it("rejects malformed waivers and non-positive weights", () => {
    const raw = valid();
    raw.requirements[0].weight = 0;
    Reflect.set(raw.requirements[0], "evidence", { kind: "waived", waiver: { id: "w", date: "tomorrow" } });
    expect(parseRequirements(raw, { archivedJdText: jd, canon }).ok).toBe(false);
  });

  it("is re-entrant and does not mutate caller input", () => {
    const raw = valid();
    const before = structuredClone(raw);
    const receipt = issueBaselineReceipt(raw.baseline.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
    const context = { archivedJdText: jd, canon, baselineReceiptResolver: () => receipt };
    expect(parseRequirements(raw, context)).toEqual(parseRequirements(raw, context));
    expect(raw).toEqual(before);
  });

  it("reloads the same persisted YAML and fails closed on a missing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "tailored-requirements-"));
    const requirementsPath = join(dir, "requirements.yaml");
    const jdPath = join(dir, "job-description.md");
    writeFileSync(requirementsPath, JSON.stringify(valid()));
    writeFileSync(jdPath, jd);
    const raw = valid();
    const baselineReceiptResolver = () => issueBaselineReceipt(raw.baseline.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
    expect(loadRequirements(requirementsPath, { archivedJdPath: jdPath, canon, baselineReceiptResolver })).toEqual(
      loadRequirements(requirementsPath, { archivedJdPath: jdPath, canon, baselineReceiptResolver }),
    );
    const missing = loadRequirements(join(dir, "missing.yaml"), { archivedJdPath: jdPath, canon });
    expect(missing.ok).toBe(false);
  });
});
