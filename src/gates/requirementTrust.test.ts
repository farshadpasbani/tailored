import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Canon } from "../canon/schema.js";
import { issueBaselineReceipt, parseRequirements, prepareRequirementsBaseline, type Requirements, type VerifiedRequirements } from "../requirements/schema.js";
import { analyzeRequirementFit } from "./fit.js";

const policy = { allowCandidateAttested: true, minConfidence: 0.5, allowedUses: ["fit"], allowedSensitivities: ["public", "private"], allowedProvenanceTypes: ["candidate-attested", "artifact"] } as const;

function fixture(status: "verified" | "candidate-attested" | "unverified" | "disputed" = "verified"): { requirements: Requirements; canon: Canon } {
  const requirements: Requirements = { schemaVersion: 2, role: "Engineer", archivedJd: { sha256: createHash("sha256").update("Python").digest("hex") }, frozenAt: "2026-07-12T12:00:00.000Z", requirements: [{ id: "req", source: { quote: "Python", location: "line 1", span: { start: 0, end: 6 } }, classification: { frozen: "hard", current: "hard" }, weight: 3, eligibilityImpact: "none", ats: { literals: [{ term: "Python", source: { quote: "Python", location: "line 1", span: { start: 0, end: 6 } } }], aliases: [] }, evidence: { kind: "direct", factIds: ["fact"] } }], baseline: { canonical: "pending", sha256: "0".repeat(64), receiptSha256: "0".repeat(64) }, changes: [] };
  const prepared = prepareRequirementsBaseline(requirements.requirements);
  const receipt = issueBaselineReceipt(prepared.sha256, { frozenAt: requirements.frozenAt, archivedJdSha256: requirements.archivedJd.sha256, issuer: "test" });
  requirements.baseline = { ...prepared, receiptSha256: receipt.sha256 };
  return {
    requirements,
    canon: { schemaVersion: 2, identity: { name: "Jane", role: "Engineer" }, skills: [], projects: [], experience: [], education: [], certifications: [], publications: [], protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {}, facts: [{ id: "fact", statement: "Python", kind: "skill", subject: "Python", provenance: { type: "artifact", source: "portfolio" }, verifiedOn: "2026-07-12", status, confidence: 1, allowedUses: ["fit"], sensitivity: "public" }] },
  };
}

function verify(requirements: Requirements, canon: Canon): VerifiedRequirements {
  const receipt = issueBaselineReceipt(requirements.baseline.sha256, { frozenAt: requirements.frozenAt, archivedJdSha256: requirements.archivedJd.sha256, issuer: "test" });
  const parsed = parseRequirements(requirements, { archivedJdText: "Python", canon, baselineReceiptResolver: () => receipt });
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.data;
}

describe("fit-eligible canon fact policy", () => {
  it("awards verified evidence and invalidates fit after a status change", () => {
    const { requirements, canon } = fixture();
    const verified = verify(requirements, canon);
    expect(analyzeRequirementFit(verified, canon, policy).score).toBe(1);
    canon.facts[0].status = "disputed";
    expect(analyzeRequirementFit(verified, canon, policy)).toMatchObject({ score: 0, verdict: "WEAK" });
  });

  it("rejects unverified, disputed, zero/low confidence, no-fit-use, confidential, and disallowed provenance facts", () => {
    const mutations: Array<(canon: Canon) => void> = [
      (c) => { c.facts[0].status = "unverified"; }, (c) => { c.facts[0].status = "disputed"; },
      (c) => { c.facts[0].confidence = 0; }, (c) => { c.facts[0].confidence = 0.4; },
      (c) => { c.facts[0].allowedUses = ["cv"]; }, (c) => { c.facts[0].sensitivity = "confidential"; },
      (c) => { c.facts[0].provenance.type = "external"; },
    ];
    for (const mutate of mutations) { const { requirements, canon } = fixture(); mutate(canon); expect(analyzeRequirementFit(verify(requirements, canon), canon, policy).score).toBe(0); }
  });

  it("requires explicit candidate-attested permission", () => {
    const { requirements, canon } = fixture("candidate-attested");
    const verified = verify(requirements, canon);
    expect(analyzeRequirementFit(verified, canon, { ...policy, allowCandidateAttested: false }).score).toBe(0);
    expect(analyzeRequirementFit(verified, canon, policy).score).toBe(1);
  });

  it("rejects non-finite fit inputs even when a caller bypasses schema parsing", () => {
    const { requirements, canon } = fixture();
    requirements.requirements[0].weight = Number.POSITIVE_INFINITY;
    expect(() => analyzeRequirementFit(requirements, canon, policy)).toThrow(/Verified fit requires/);
  });
});
