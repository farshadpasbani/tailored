import { z } from "zod";

const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const Binding = z.object({ id: z.string().min(1), sha256: Digest }).strict();
const OutputBinding = Binding.extend({ file: z.string().min(1) }).strict();
export const FindingSchema = z.object({
  id: z.string().min(1), severity: z.enum(["blocking", "advisory"]), ok: z.boolean(),
  messages: z.array(z.string()),
  disposition: z.enum(["review-required", "accepted", "waived"]).optional(),
  resolution: z.object({ attestationId: z.string().min(1).optional(), waiverId: z.string().min(1).optional() }).strict().optional(),
}).strict().superRefine((finding, context) => {
  if (finding.severity === "advisory" && !finding.ok && !finding.disposition) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["disposition"], message: "Advisory findings require an explicit disposition" });
  }
  if (finding.disposition === "accepted" && (!finding.resolution?.attestationId || finding.resolution.waiverId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolution"], message: "Accepted findings require exactly one attestation" });
  if (finding.disposition === "waived" && (!finding.resolution?.waiverId || finding.resolution.attestationId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolution"], message: "Waived findings require exactly one waiver" });
  if (finding.disposition === "review-required" && finding.resolution) context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolution"], message: "Review-required findings cannot claim a resolution" });
});

export const VerifyReceiptSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("tailored.verify-pack"), state: z.literal("ready-for-human"),
  engine: z.object({ version: z.string().min(1), revision: z.string().min(1), revisionSha256: Digest }).strict(),
  bindings: z.object({
    descriptor: Binding,
    packSha256: Digest,
    inputs: z.record(z.string(), Binding), artifacts: z.array(Binding), outputs: z.array(OutputBinding),
    corpusDescriptor: Binding, corpusMembers: z.array(Binding), waivers: z.array(Binding), attestations: z.array(Binding),
  }).strict(),
  findings: z.array(FindingSchema), receiptSha256: Digest,
}).strict();

export type PackFinding = z.infer<typeof FindingSchema>;
export type VerifyReceipt = z.infer<typeof VerifyReceiptSchema>;
