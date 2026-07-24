import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { issueBaselineReceipt, parseRequirements, prepareRequirementsBaseline, type Requirements, type VerifiedRequirements } from "../requirements/schema.js";
import { analyzeRequirementFit } from "./fit.js";
import { analyzeRequirementAts } from "./ats.js";
import type { Canon } from "../canon/schema.js";

const policy = { allowCandidateAttested: true, minConfidence: 0.5, allowedUses: ["fit"], allowedSensitivities: ["public", "private"], allowedProvenanceTypes: ["candidate-attested", "artifact"] } as const;
const ats = (term: string, start: number) => ({ literals: [{ term, source: { quote: term, location: "requirements", span: { start, end: start + term.length } } }], aliases: [] });
const jd = "Python AWS LLM-as-judge No sponsorship";

function requirements(): Requirements {
  const raw: Requirements = {
    schemaVersion: 2, role: "Staff Engineer", archivedJd: { sha256: createHash("sha256").update(jd).digest("hex") },
    frozenAt: "2026-07-12T12:00:00.000Z",
    requirements: [
      { id: "direct", source: { quote: "Python", location: "requirements", span: { start: 0, end: 6 } }, classification: { frozen: "hard", current: "hard" }, weight: 4, eligibilityImpact: "none", ats: ats("Python", 0), evidence: { kind: "direct", factIds: ["fact-python"] } },
      { id: "transferable", source: { quote: "AWS", location: "requirements", span: { start: 7, end: 10 } }, classification: { frozen: "preferred", current: "preferred" }, weight: 2, eligibilityImpact: "none", ats: ats("AWS", 7), evidence: { kind: "transferable", factIds: ["fact-azure"], note: "Cloud concepts transfer" } },
      { id: "gap", source: { quote: "LLM-as-judge", location: "requirements", span: { start: 11, end: 23 } }, classification: { frozen: "hard", current: "hard" }, weight: 3, eligibilityImpact: "none", ats: ats("LLM-as-judge", 11), evidence: { kind: "gap", note: "No matching fact" } },
      { id: "sponsorship", source: { quote: "No sponsorship", location: "eligibility", span: { start: 24, end: 38 } }, classification: { frozen: "hard", current: "hard" }, weight: 1, eligibilityImpact: "uncertain", ats: { literals: [], aliases: [] }, evidence: { kind: "gap", note: "Candidate status requires confirmation" } },
    ],
    baseline: { canonical: "pending", sha256: "0".repeat(64), receiptSha256: "0".repeat(64) }, changes: [],
  };
  const prepared = prepareRequirementsBaseline(raw.requirements);
  const receipt = issueBaselineReceipt(prepared.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
  raw.baseline = { ...prepared, receiptSha256: receipt.sha256 };
  return raw;
}

function canonFor(raw: Requirements): Canon {
  const ids = [...new Set(raw.requirements.flatMap((item) => item.evidence.kind === "direct" || item.evidence.kind === "transferable" ? item.evidence.factIds : []))];
  return { schemaVersion: 2, identity: { name: "Jane", role: "Engineer" }, skills: [], projects: [], experience: [], education: [], certifications: [], publications: [], protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {}, facts: ids.map((id) => ({ id, statement: id, kind: "skill", subject: id, provenance: { type: "artifact", source: "test" }, verifiedOn: "2026-07-12", status: "verified", confidence: 1, allowedUses: ["fit"], sensitivity: "public" })) };
}
function verify(raw: Requirements, canon = canonFor(raw)): VerifiedRequirements {
  const receipt = issueBaselineReceipt(raw.baseline.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
  const parsed = parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === receipt.sha256 ? receipt : undefined });
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.data;
}
function analyze(raw: Requirements) { const canon = canonFor(raw); return analyzeRequirementFit(verify(raw, canon), canon, policy); }

describe("requirement-evidence fit authority", () => {
  it("separates direct, transferable, material gaps, and eligibility uncertainty", () => {
    const result = analyze(requirements());
    expect(result.direct.map((r) => r.id)).toEqual(["direct"]);
    expect(result.transferable.map((r) => r.id)).toEqual(["transferable"]);
    expect(result.materialGaps.map((r) => r.id)).toEqual(["gap"]);
    expect(result.eligibilityUncertainties.map((r) => r.id)).toEqual(["sponsorship"]);
    expect(result.score).toBe(0.5);
  });

  it("keeps a hard eligibility blocker visible and blocks regardless of aggregate score", () => {
    const raw = requirements();
    raw.requirements = raw.requirements.map((r) => ({ ...r, evidence: { kind: "direct", factIds: ["fact"] } }));
    raw.requirements[3] = { ...raw.requirements[3], eligibilityImpact: "blocker", evidence: { kind: "gap", note: "No right to work" } };
    const prepared = prepareRequirementsBaseline(raw.requirements);
    const receipt = issueBaselineReceipt(prepared.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
    raw.baseline = { ...prepared, receiptSha256: receipt.sha256 };
    const result = analyze(raw);
    expect(result.score).toBe(0.9);
    expect(result.verdict).toBe("BLOCKED");
    expect(result.hardBlockers.map((r) => r.id)).toEqual(["sponsorship"]);
  });

  it("does not accept CV text, so literal keyword stuffing cannot change fit", () => {
    const before = analyze(requirements());
    const beforeRequirements = requirements();
    const afterRequirements = requirements();
    const atsBefore = analyzeRequirementAts("Python", verify(beforeRequirements), 0);
    const atsAfter = analyzeRequirementAts("Python AWS LLM-as-judge", verify(afterRequirements), 0);
    expect(analyze(requirements())).toEqual(before);
    expect(atsAfter.ratio).toBeGreaterThan(atsBefore.ratio);
    expect(atsAfter.ratio).toBe(1);
  });

  it("handles zero ATS terms without changing fit", () => {
    const raw = requirements();
    raw.requirements.forEach((requirement) => { requirement.ats = { literals: [], aliases: [] }; });
    const prepared = prepareRequirementsBaseline(raw.requirements);
    const receipt = issueBaselineReceipt(prepared.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
    raw.baseline = { ...prepared, receiptSha256: receipt.sha256 };
    expect(analyzeRequirementAts("anything", verify(raw), 0.8)).toMatchObject({ ratio: 1, ok: true });
    expect(analyze(raw).score).toBe(0.5);
  });

  it("scores exact employer literals by default and aliases only under explicit policy", () => {
    const raw = requirements();
    raw.requirements[0].ats.aliases = [{ term: "Py", forLiteral: "Python", reason: "Employer-approved abbreviation" }];
    const prepared = prepareRequirementsBaseline(raw.requirements);
    const receipt = issueBaselineReceipt(prepared.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "test" });
    raw.baseline = { ...prepared, receiptSha256: receipt.sha256 };
    expect(analyzeRequirementAts("Py", verify(raw), 0).ratio).toBe(0);
    expect(analyzeRequirementAts("Py", verify(raw), 0, { includeAliases: true }).covered).toContain("Py");
  });

  it("rejects contradictory eligibility evidence and unsafe runtime weights", () => {
    const contradictory = requirements();
    contradictory.requirements[0].eligibilityImpact = "blocker";
    expect(() => analyzeRequirementFit(contradictory, canonFor(contradictory), policy)).toThrow(/Verified fit requires/);
    const unsafe = requirements();
    unsafe.requirements[0].weight = Number.POSITIVE_INFINITY;
    expect(() => analyzeRequirementFit(unsafe, canonFor(unsafe), policy)).toThrow(/Verified fit requires/);
  });

  it("surfaces receipt-bound reclassification and waived gaps without treating either as evidence", () => {
    const raw = requirements();
    const waiver = {
      id: "waiver-1", date: "2026-07-12", approvedBy: "Jane", reason: "Employer clarification",
      archivedJdSha256: raw.archivedJd.sha256, receiptSha256: "b".repeat(64),
    };
    raw.requirements[2] = {
      ...raw.requirements[2],
      classification: { frozen: "hard", current: "preferred", waiver },
      evidence: { kind: "waived", waiver: { ...waiver, id: "waiver-2" } },
    };
    expect(() => analyzeRequirementFit(raw, canonFor(raw), policy)).toThrow(/Verified fit requires/);
  });
});
