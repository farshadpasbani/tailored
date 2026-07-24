import { describe, expect, it } from "vitest";
import { analyzeStrategy, StrategySchema } from "./schema.js";

const complete = { schemaVersion: 1 as const, selectedProjectIds: ["Project A"], rationale: "Role fit", openingMove: "Lead with delivery", argument: "Evidence over assertion", anchorFactIds: ["fact-a"] };
const authority = { projectIds: ["Project A", "Project B"], minConfidence: 0.8, facts: [{ id: "fact-a", status: "verified", confidence: 1, allowedUses: ["fit", "cv"], sensitivity: "public", provenance: { type: "artifact" }, metrics: [{ denominator: "runs", scale: "count", timeframe: "2025" }] }] };

describe("strategy authority", () => {
  it("accepts a complete record and keeps semantic altitude human-owned", () => {
    const strategy = StrategySchema.parse(complete);
    expect(analyzeStrategy(strategy, authority)).toEqual({
      selection: [],
      evidence: ["semantic evidence altitude requires human review under strategy schema v1"],
    });
  });

  it("reads the legacy shape without inventing missing judgement", () => {
    const strategy = StrategySchema.parse({ schemaVersion: 1, selectedProjectIds: ["Project A"], rationale: "Legacy" });
    expect(strategy).not.toHaveProperty("openingMove");
    expect(analyzeStrategy(strategy, authority)).toEqual({
      selection: ["missing strategy argument", "missing strategy openingMove"],
      evidence: ["missing strategy anchorFactIds", "semantic evidence altitude requires human review under strategy schema v1"],
    });
  });

  it("rejects empty or duplicate selections and anchors", () => {
    for (const mutation of [
      { selectedProjectIds: [] }, { selectedProjectIds: ["Project A", "Project A"] },
      { anchorFactIds: [] }, { anchorFactIds: ["fact-a", "fact-a"] }, { openingMove: " " }, { argument: " " },
    ]) expect(StrategySchema.safeParse({ ...complete, ...mutation }).success).toBe(false);
  });

  it("reports unknown, non-selective and weak fact authority deterministically", () => {
    const strategy = StrategySchema.parse({ ...complete, selectedProjectIds: ["Project B", "Project A"], anchorFactIds: ["missing", "weak"] });
    const weak = { id: "weak", status: "unverified", confidence: 0.2, allowedUses: ["fit"], sensitivity: "confidential", provenance: { type: "candidate-attested" }, metrics: [{ denominator: "", scale: "", timeframe: "" }] };
    expect(analyzeStrategy(strategy, { ...authority, facts: [weak] })).toEqual({
      selection: ["selected every available project; selection is not role-specific"],
      evidence: [
        "anchor fact weak confidence 0.2 does not meet authority minimum 0.8", "anchor fact weak has incomplete structured metrics",
        "anchor fact weak is not allowed for fit and outward application use", "anchor fact weak provenance candidate-attested is not independently verified",
        "anchor fact weak sensitivity confidential", "anchor fact weak status unverified",
        "semantic evidence altitude requires human review under strategy schema v1", "unknown anchor fact missing",
      ],
    });
    expect(analyzeStrategy(StrategySchema.parse({ ...complete, selectedProjectIds: ["Unknown"] }), authority).selection).toEqual(["unknown selected project Unknown"]);
    expect(analyzeStrategy(StrategySchema.parse(complete), { ...authority, minConfidence: 0, facts: [{ ...authority.facts[0], confidence: 0 }] }).evidence).toContain("anchor fact fact-a confidence 0 does not meet authority minimum 0");
  });
});
