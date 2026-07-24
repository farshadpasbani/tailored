import { z } from "zod";

export const BlockingGateIdSchema = z.enum([
  "canon-schema", "evidence-schema", "requirements-trust", "fit-blockers",
  "protected-topics", "prohibited-claims", "claim-integrity", "pdf-text-layer",
  "page-integrity", "corpus-eligibility",
]);
export const AdvisoryGateIdSchema = z.enum([
  "ats", "ai-tell", "impact", "distinctness", "strategy-selection",
  "evidence-altitude", "editorial", "accessibility",
]);
export const REQUIRED_BLOCKING_GATES = BlockingGateIdSchema.options;
export const REQUIRED_ADVISORY_GATES = AdvisoryGateIdSchema.options;

const Gate = z.object({ id: z.union([BlockingGateIdSchema, AdvisoryGateIdSchema]), severity: z.enum(["blocking", "advisory"]) }).strict();
export const VerifyPolicySchema = z.object({
  schemaVersion: z.literal(1),
  gates: z.array(Gate),
  thresholds: z.object({
    atsMinimum: z.number().min(0).max(1),
    fitMinimumConfidence: z.number().min(0).max(1),
    fitMinimumScore: z.number().min(0).max(1),
    minimumFontPt: z.number().positive(),
    minimumMarginMm: z.number().nonnegative(),
    minimumLineHeight: z.number().positive(),
    maximumSharedRuns: z.number().int().nonnegative(),
    maximumSignaturePhrases: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((policy, context) => {
  const counts = new Map<string, number>();
  for (const gate of policy.gates) counts.set(gate.id, (counts.get(gate.id) ?? 0) + 1);
  for (const id of [...REQUIRED_BLOCKING_GATES, ...REQUIRED_ADVISORY_GATES]) {
    if (counts.get(id) !== 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["gates"], message: `required gate ${JSON.stringify(id)} must appear exactly once` });
  }
  for (const gate of policy.gates) {
    const expected = (REQUIRED_BLOCKING_GATES as readonly string[]).includes(gate.id) ? "blocking" : "advisory";
    if (gate.severity !== expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ["gates", policy.gates.indexOf(gate), "severity"], message: `${gate.id} must be ${expected}` });
  }
});
export type VerifyPolicy = z.infer<typeof VerifyPolicySchema>;
