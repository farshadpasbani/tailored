import { describe, it, expect } from "vitest";
import { THRESHOLDS, ThresholdsSchema } from "./thresholds.js";
import { VerifyPolicySchema } from "./verify.js";
import { defaultImpactOptions } from "../gates/impact.js";
import { defaultOptions } from "../gates/gate.js";
import { gate } from "../gates/registry.js";
import { PACK_GATES } from "../gates/registry.js";

/** The default string commander would apply to `flag` of the command belonging to gate `id`. */
function flagDefault(id: string, option: string): unknown {
  const command = gate(id).command;
  if (!command) throw new Error(`gate ${id} has no command`);
  return defaultOptions(command)[option];
}

describe("THRESHOLDS", () => {
  it("is itself a valid policy threshold set, so the defaults cannot drift outside the accepted ranges", () => {
    const parsed = ThresholdsSchema.safeParse({
      atsMinimum: THRESHOLDS.atsMinimum,
      fitMinimumConfidence: THRESHOLDS.fitMinimumConfidence,
      fitMinimumScore: THRESHOLDS.fitMinimumScore,
      minimumFontPt: THRESHOLDS.minimumFontPt,
      minimumMarginMm: THRESHOLDS.minimumMarginMm,
      minimumLineHeight: THRESHOLDS.minimumLineHeight,
      maximumSharedRuns: THRESHOLDS.maximumSharedRuns,
      maximumSignaturePhrases: THRESHOLDS.maximumSignaturePhrases,
    });
    expect(parsed.success).toBe(true);
  });

  it("is the set the policy schema accepts - one shape, not two declarations of it", () => {
    const policy = {
      schemaVersion: 1,
      gates: PACK_GATES.map(entry => ({ id: entry.id, severity: entry.severity })),
      thresholds: {
        atsMinimum: 0.8, fitMinimumConfidence: 0.5, fitMinimumScore: 0.8,
        minimumFontPt: 9, minimumMarginMm: 8, minimumLineHeight: 1.28,
        maximumSharedRuns: 0, maximumSignaturePhrases: 0,
      },
    };
    expect(VerifyPolicySchema.safeParse(policy).success).toBe(true);
    // Shape is a compatibility surface: a policy file may not omit a threshold and may not
    // invent one, whatever the defaults above say.
    expect(VerifyPolicySchema.safeParse({ ...policy, thresholds: { ...policy.thresholds, atsMinimum: undefined } }).success).toBe(false);
    expect(VerifyPolicySchema.safeParse({ ...policy, thresholds: { ...policy.thresholds, maximumPages: 1 } }).success).toBe(false);
    expect(VerifyPolicySchema.safeParse({ ...policy, thresholds: { ...policy.thresholds, atsMinimum: 1.5 } }).success).toBe(false);
  });

  it("is where the impact analysis takes its floors and caps from", () => {
    expect(defaultImpactOptions.minFontPt).toBe(THRESHOLDS.minimumFontPt);
    expect(defaultImpactOptions.minMarginMm).toBe(THRESHOLDS.minimumMarginMm);
    expect(defaultImpactOptions.minLineHeight).toBe(THRESHOLDS.minimumLineHeight);
    expect(defaultImpactOptions.summaryMaxWords).toBe(THRESHOLDS.summaryMaxWords);
    expect(defaultImpactOptions.bulletMaxWords).toBe(THRESHOLDS.bulletMaxWords);
    expect(defaultImpactOptions.skillMaxWords).toBe(THRESHOLDS.skillMaxWords);
  });

  it("is where every CLI flag default comes from, so the terminal cannot disagree with the policy", () => {
    expect(flagDefault("impact", "minFont")).toBe(String(THRESHOLDS.minimumFontPt));
    expect(flagDefault("impact", "minMargin")).toBe(String(THRESHOLDS.minimumMarginMm));
    expect(flagDefault("impact", "minLineHeight")).toBe(String(THRESHOLDS.minimumLineHeight));
    expect(flagDefault("impact", "summaryMaxWords")).toBe(String(THRESHOLDS.summaryMaxWords));
    expect(flagDefault("impact", "bulletMaxWords")).toBe(String(THRESHOLDS.bulletMaxWords));
    expect(flagDefault("impact", "skillMaxWords")).toBe(String(THRESHOLDS.skillMaxWords));
    expect(flagDefault("ats", "min")).toBe(String(THRESHOLDS.atsMinimum));
    expect(flagDefault("legacy-ats", "min")).toBe(String(THRESHOLDS.atsMinimum));
    expect(flagDefault("page-fit", "max")).toBe(String(THRESHOLDS.maximumPages));
    expect(flagDefault("distinctness", "maxShared")).toBe(String(THRESHOLDS.maximumSharedRuns));
    expect(flagDefault("distinctness", "maxSignatures")).toBe(String(THRESHOLDS.maximumSignaturePhrases));
    expect(flagDefault("legacy-fit", "apply")).toBe(String(THRESHOLDS.legacyFitApplyRatio));
    expect(flagDefault("legacy-fit", "floor")).toBe(String(THRESHOLDS.legacyFitSkipRatio));
  });

  it("keeps the published flag defaults at the values callers already script against", () => {
    // Card 3 gave these one home; it must not have moved any of them. job-apply's battery
    // and every documented example depend on the printed defaults.
    expect(flagDefault("ats", "min")).toBe("0.8");
    expect(flagDefault("legacy-fit", "apply")).toBe("0.8");
    expect(flagDefault("legacy-fit", "floor")).toBe("0.5");
    expect(flagDefault("page-fit", "max")).toBe("1");
    expect(flagDefault("impact", "minFont")).toBe("9");
    expect(flagDefault("impact", "minMargin")).toBe("8");
    expect(flagDefault("impact", "minLineHeight")).toBe("1.28");
    expect(flagDefault("impact", "summaryMaxWords")).toBe("60");
    expect(flagDefault("impact", "bulletMaxWords")).toBe("45");
    expect(flagDefault("impact", "skillMaxWords")).toBe("18");
    expect(flagDefault("distinctness", "maxShared")).toBe("0");
  });
});
