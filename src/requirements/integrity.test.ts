import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Canon } from "../canon/schema.js";
import {
  issueBaselineReceipt,
  prepareRequirementsBaseline,
  createChangeReceipt,
  parseRequirements,
  type Requirement,
  type ReceiptResolver,
} from "./schema.js";

function freezeBaseline(requirements: Requirement[], input: { frozenAt: string; archivedJdSha256: string; issuer: string }) {
  const prepared = prepareRequirementsBaseline(requirements);
  const receipt = issueBaselineReceipt(prepared.sha256, input);
  return { ...prepared, receiptSha256: receipt.sha256 };
}

function trustedBaseline(raw: ReturnType<typeof frozen>, issuer = "trusted-reviewer") {
  return issueBaselineReceipt(raw.baseline.sha256, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer });
}

const jd = "Must have Python. Sponsorship is not available.";
const canon = {
  schemaVersion: 2, identity: { name: "Jane", role: "Engineer" }, skills: [], projects: [], experience: [], education: [], certifications: [], publications: [], protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {},
  facts: [{ id: "fact-python", statement: "Uses Python", kind: "skill", subject: "Python", provenance: { type: "candidate-attested", source: "candidate" }, verifiedOn: "2026-07-12", status: "candidate-attested", confidence: 1, allowedUses: ["fit"], sensitivity: "public" }],
} satisfies Canon;

function requirement(): Requirement {
  return {
    id: "req-python",
    source: { quote: "Must have Python", location: "sentence 1", span: { start: 0, end: 16 } },
    classification: { frozen: "hard", current: "hard" }, weight: 3,
    eligibilityImpact: "none", ats: { literals: [{ term: "Python", source: { quote: "Python", location: "sentence 1", span: { start: 10, end: 16 } } }], aliases: [] }, evidence: { kind: "direct", factIds: ["fact-python"] },
  };
}

function frozen() {
  const requirements = [requirement()];
  const baseline = freezeBaseline(requirements, {
    frozenAt: "2026-07-12T12:00:00.000Z",
    archivedJdSha256: createHash("sha256").update(jd).digest("hex"),
    issuer: "trusted-reviewer",
  });
  return { schemaVersion: 2 as const, role: "Engineer", archivedJd: { sha256: createHash("sha256").update(jd).digest("hex") }, frozenAt: "2026-07-12T12:00:00.000Z", requirements, baseline, changes: [] };
}

describe("frozen baseline integrity", () => {
  it("requires an externally trusted anchor and rejects internally regenerated weight/ATS bindings", () => {
    const original: any = frozen();
    expect(parseRequirements(original, { archivedJdText: jd, canon }).ok).toBe(false);
    const trusted = trustedBaseline(original);
    expect(parseRequirements(original, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined }).ok).toBe(true);
    const attack = structuredClone(original);
    attack.requirements[0].weight = 99;
    attack.requirements[0].ats.literals[0] = { term: "Must have Python", source: { quote: "Must have Python", location: "sentence 1", span: { start: 0, end: 16 } } };
    attack.baseline = freezeBaseline(attack.requirements, { frozenAt: attack.frozenAt, archivedJdSha256: attack.archivedJd.sha256, issuer: "attacker" });
    const attackerReceipt = trustedBaseline(attack, "attacker");
    expect(parseRequirements(attack, { archivedJdText: jd, canon, baselineReceiptResolver: () => attackerReceipt }).ok).toBe(true);
    expect(parseRequirements(attack, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined }).ok).toBe(false);
  });

  it("rejects tampering every frozen field", () => {
    const mutations: Array<(raw: any) => void> = [
      (raw) => { raw.requirements[0].source.quote = "Must have Rust"; },
      (raw) => { raw.requirements[0].source.location = "elsewhere"; },
      (raw) => { raw.requirements[0].source.span.end = 15; },
      (raw) => { raw.requirements[0].classification.frozen = "preferred"; raw.requirements[0].classification.current = "preferred"; },
      (raw) => { raw.requirements[0].weight = 4; },
      (raw) => { raw.requirements[0].eligibilityImpact = "uncertain"; },
      (raw) => { raw.requirements[0].ats.literals[0].term = "Rust"; },
      (raw) => { raw.requirements[0].evidence = { kind: "gap", note: "tampered" }; },
    ];
    for (const mutate of mutations) {
      const raw = structuredClone(frozen()); mutate(raw);
      const trusted = trustedBaseline(frozen());
      expect(parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => undefined, asOfDate: "2026-07-12" }).ok).toBe(false);
    }
    for (const mutate of [
      (raw: any) => { raw.baseline.canonical += " "; },
      (raw: any) => { raw.baseline.sha256 = "f".repeat(64); },
      (raw: any) => { raw.baseline.receiptSha256 = "f".repeat(64); },
    ]) {
      const raw: any = frozen(); mutate(raw);
      const trusted = trustedBaseline(frozen());
      expect(parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => undefined, asOfDate: "2026-07-12" }).ok).toBe(false);
    }
  });

  it("validates an exact prior-receipt-bound reclassification", () => {
    const raw: any = frozen();
    const before = raw.requirements[0].classification;
    const after = { frozen: "hard", current: "preferred" };
    const waiver = { id: "waiver-1", approvedBy: "Jane", reason: "Employer clarification" };
    const receipt = createChangeReceipt({
      action: "reclassify", issuedOn: "2026-07-12", baselineReceiptSha256: raw.baseline.receiptSha256,
      archivedJdSha256: raw.archivedJd.sha256, requirementId: "req-python", before, after, waiver,
    });
    raw.changes.push({ id: "change-1", action: "reclassify", requirementId: "req-python", changedOn: "2026-07-12", before, after, waiver, receiptSha256: receipt.sha256 });
    const resolver: ReceiptResolver = (hash) => hash === receipt.sha256 ? receipt : undefined;
    const trusted = trustedBaseline(raw);
    const result = parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: resolver, asOfDate: "2026-07-12" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.requirements[0].classification).toMatchObject({ current: "preferred", waiver: { receiptSha256: receipt.sha256 } });
  });

  it("is historically deterministic when no explicit as-of policy is supplied", () => {
    const raw: any = frozen();
    const before = raw.requirements[0].classification;
    const after = { frozen: "hard", current: "preferred" };
    const waiver = { id: "waiver-future-calendar", approvedBy: "Jane", reason: "Historical fixture" };
    const baseline = trustedBaseline(raw);
    const receipt = createChangeReceipt({ action: "reclassify", issuedOn: "2099-01-01", baselineReceiptSha256: raw.baseline.receiptSha256, archivedJdSha256: raw.archivedJd.sha256, requirementId: "req-python", before, after, waiver });
    raw.changes.push({ id: "change-1", action: "reclassify", requirementId: "req-python", changedOn: "2099-01-01", before, after, waiver, receiptSha256: receipt.sha256 });
    const context = { archivedJdText: jd, canon, baselineReceiptResolver: () => baseline, receiptResolver: () => receipt };
    expect(parseRequirements(raw, context)).toEqual(parseRequirements(raw, context));
    expect(parseRequirements(raw, context).ok).toBe(true);
  });

  it("rejects malformed receipt policy even when the frozen baseline has no changes", () => {
    const raw = frozen();
    const trusted = trustedBaseline(raw);
    const context = {
      archivedJdText: jd,
      canon,
      baselineReceiptResolver: (hash: string) => hash === trusted.sha256 ? trusted : undefined,
    };
    for (const policy of [
      { asOfDate: "2026-02-30" },
      { asOfDate: "not-a-date" },
      { maxReceiptAgeDays: -1 },
      { maxReceiptAgeDays: Number.NaN },
      { maxReceiptAgeDays: Number.POSITIVE_INFINITY },
    ]) {
      const result = parseRequirements(raw, { ...context, ...policy });
      expect(result.ok, JSON.stringify(policy)).toBe(false);
    }
    expect(parseRequirements(raw, { ...context, maxReceiptAgeDays: 0 }).ok).toBe(true);
  });

  it("validates a prior-receipt-bound evidence waiver", () => {
    const raw: any = frozen();
    raw.requirements[0].evidence = { kind: "gap", note: "No verified evidence" };
    raw.baseline = freezeBaseline(raw.requirements, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "trusted-reviewer" });
    const before = raw.requirements[0].evidence;
    const after = { kind: "waived", waiver: { id: "waiver-evidence", approvedBy: "Jane", reason: "Proceed with disclosed gap" } };
    const receipt = createChangeReceipt({ action: "waive-evidence", issuedOn: "2026-07-12", baselineReceiptSha256: raw.baseline.receiptSha256, archivedJdSha256: raw.archivedJd.sha256, requirementId: "req-python", before, after, waiver: after.waiver });
    raw.changes.push({ id: "change-1", action: "waive-evidence", requirementId: "req-python", changedOn: "2026-07-12", before, after, receiptSha256: receipt.sha256 });
    const trusted = trustedBaseline(raw);
    const result = parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => receipt, asOfDate: "2026-07-12" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.requirements[0].evidence).toMatchObject({ kind: "waived", waiver: { receiptSha256: receipt.sha256 } });
  });

  it("rejects waiving the evidence gap that keeps eligibility uncertainty visible", () => {
    const raw: any = frozen();
    raw.requirements[0].eligibilityImpact = "uncertain";
    raw.requirements[0].evidence = { kind: "gap", note: "Sponsorship unresolved" };
    raw.baseline = freezeBaseline(raw.requirements, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "trusted-reviewer" });
    const before = raw.requirements[0].evidence;
    const after = { kind: "waived", waiver: { id: "waiver-evidence", approvedBy: "Jane", reason: "Proceed" } };
    const receipt = createChangeReceipt({ action: "waive-evidence", issuedOn: "2026-07-12", baselineReceiptSha256: raw.baseline.receiptSha256, archivedJdSha256: raw.archivedJd.sha256, requirementId: "req-python", before, after, waiver: after.waiver });
    raw.changes.push({ id: "change-1", action: "waive-evidence", requirementId: "req-python", changedOn: "2026-07-12", before, after, receiptSha256: receipt.sha256 });
    const trusted = trustedBaseline(raw);
    expect(parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => receipt, asOfDate: "2026-07-12" }).ok).toBe(false);
  });

  it("rejects fake, missing, replayed, hash-mismatched, future, pre-freeze, and stale receipts", () => {
    const scenarios = ["missing", "fake", "requirement", "jd", "action", "waiver", "future", "prefreeze", "stale"] as const;
    for (const scenario of scenarios) {
      const raw: any = frozen();
      const before = raw.requirements[0].classification;
      const after = { frozen: "hard", current: "preferred" };
      const waiver = { id: "waiver-1", approvedBy: "Jane", reason: "Employer clarification" };
      const issuedOn = scenario === "future" ? "2026-07-13" : scenario === "prefreeze" ? "2026-07-11" : "2026-07-12";
      const receipt = createChangeReceipt({ action: scenario === "action" ? "waive-evidence" : "reclassify", issuedOn, baselineReceiptSha256: raw.baseline.receiptSha256, archivedJdSha256: scenario === "jd" ? "f".repeat(64) : raw.archivedJd.sha256, requirementId: scenario === "requirement" ? "req-other" : "req-python", before, after, waiver });
      if (scenario === "waiver") waiver.approvedBy = "Mallory";
      raw.changes.push({ id: "change-1", action: "reclassify", requirementId: "req-python", changedOn: issuedOn, before, after, waiver, receiptSha256: scenario === "fake" ? "e".repeat(64) : receipt.sha256 });
      const resolver: ReceiptResolver = () => scenario === "missing" ? undefined : receipt;
      const trusted = trustedBaseline(raw);
      const result = parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: resolver, asOfDate: scenario === "stale" ? "2026-09-30" : "2026-07-12", maxReceiptAgeDays: 30 });
      expect(result.ok, scenario).toBe(false);
    }
  });

  it("rejects receipt replay even when change IDs differ", () => {
    const raw: any = frozen();
    const before = raw.requirements[0].classification;
    const after = { frozen: "hard", current: "preferred" };
    const waiver = { id: "waiver-1", approvedBy: "Jane", reason: "Employer clarification" };
    const receipt = createChangeReceipt({ action: "reclassify", issuedOn: "2026-07-12", baselineReceiptSha256: raw.baseline.receiptSha256, archivedJdSha256: raw.archivedJd.sha256, requirementId: "req-python", before, after, waiver });
    const change = { action: "reclassify", requirementId: "req-python", changedOn: "2026-07-12", before, after, waiver, receiptSha256: receipt.sha256 };
    raw.changes.push({ ...change, id: "change-1" }, { ...change, id: "change-2", waiver: { ...change.waiver, id: "waiver-2" } });
    const trusted = trustedBaseline(raw);
    expect(parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => receipt, asOfDate: "2026-07-12" }).ok).toBe(false);
  });

  it("rejects eligibility contradictions and unsafe weights", () => {
    for (const mutate of [
      (raw: any) => { raw.requirements[0].eligibilityImpact = "blocker"; },
      (raw: any) => { raw.requirements[0].weight = 101; },
      (raw: any) => { raw.requirements[0].weight = Number.POSITIVE_INFINITY; },
    ]) {
      const raw: any = frozen(); mutate(raw);
      if (Number.isFinite(raw.requirements[0].weight)) raw.baseline = freezeBaseline(raw.requirements, { frozenAt: raw.frozenAt, archivedJdSha256: raw.archivedJd.sha256, issuer: "trusted-reviewer" });
      const trusted = trustedBaseline(raw);
      expect(parseRequirements(raw, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => undefined, asOfDate: "2026-07-12" }).ok).toBe(false);
    }
    const overflow: any = frozen();
    overflow.requirements = Array.from({ length: 1001 }, (_, index) => ({ ...requirement(), id: `req-${index}` }));
    overflow.baseline = freezeBaseline(overflow.requirements, { frozenAt: overflow.frozenAt, archivedJdSha256: overflow.archivedJd.sha256, issuer: "trusted-reviewer" });
    const trusted = trustedBaseline(overflow);
    expect(parseRequirements(overflow, { archivedJdText: jd, canon, baselineReceiptResolver: (hash) => hash === trusted.sha256 ? trusted : undefined, receiptResolver: () => undefined, asOfDate: "2026-07-12" }).ok).toBe(false);
  });
});
