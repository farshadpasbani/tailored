// The pack quality standards: one home for every number a gate compares a document against.
// Before card 3 the same figures were written in up to four places at once - the policy
// schema, a gate's defaults, a CLI flag's default string, and smoke's own copy - so tightening
// a floor in one place quietly left the others loose.

import { z } from "zod";

/**
 * The thresholds a policy.yaml may set, with the range each must stay inside. Shape and
 * ranges are a compatibility surface: policy files in the wild already carry these eight
 * keys, so this schema is moved here unchanged and gains no defaults - a policy file must
 * still state all eight, and `THRESHOLDS` below is what the code falls back on where no
 * policy is in force, not a way to omit them.
 */
export const ThresholdsSchema = z.object({
  atsMinimum: z.number().min(0).max(1),
  fitMinimumConfidence: z.number().min(0).max(1),
  fitMinimumScore: z.number().min(0).max(1),
  minimumFontPt: z.number().positive(),
  minimumMarginMm: z.number().nonnegative(),
  minimumLineHeight: z.number().positive(),
  maximumSharedRuns: z.number().int().nonnegative(),
  maximumSignaturePhrases: z.number().int().nonnegative(),
}).strict();

/** The quality standards a gate reads. Same eight numbers the policy schema accepts. */
export type GateThresholds = z.infer<typeof ThresholdsSchema>;

/**
 * The default value of every policy-settable quality standard: what a gate uses when no
 * policy.yaml is in force. `satisfies` rather than a type annotation, so each value keeps its
 * literal type for the callers that render it into a flag default, while the compiler - not a
 * comment - holds this object to exactly the set the policy schema accepts.
 */
export const POLICY_DEFAULTS = {
  /** Must-have keyword coverage a rendered CV has to reach. */
  atsMinimum: 0.8,
  /** Confidence a canon fact needs before it may award fit weight. */
  fitMinimumConfidence: 0.5,
  /** Weighted requirement-evidence score a pack has to reach. */
  fitMinimumScore: 0.8,
  /** Readability floors: page-fit must come from selecting less, not compressing what stays. */
  minimumFontPt: 9,
  minimumMarginMm: 8,
  minimumLineHeight: 1.28,
  /** Anti-template tolerances: zero shared runs and zero signature phrases. */
  maximumSharedRuns: 0,
  maximumSignaturePhrases: 0,
} as const satisfies GateThresholds;

/**
 * Every standard, policy-settable or not. The extras below are standards only a command
 * applies today, so no policy.yaml names them; they live here because a threshold written
 * twice in src/ is the duplication this module exists to end.
 */
export const THRESHOLDS = {
  ...POLICY_DEFAULTS,
  /** Word caps for the six-second skim. */
  summaryMaxWords: 60,
  bulletMaxWords: 45,
  skillMaxWords: 18,
  /** Pages a rendered document may run to. */
  maximumPages: 1,
  /**
   * The legacy triage bands: must-have coverage of the canon at or above which drafting is
   * worth it, and below which the role is a skip. Deliberately separate from `atsMinimum`
   * even though they start equal - one asks whether a rendered PDF survives a screener, the
   * other whether a role is worth writing for.
   */
  legacyFitApplyRatio: 0.8,
  legacyFitSkipRatio: 0.5,
} as const;
