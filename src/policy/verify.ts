import { z } from "zod";
import type { PackGate } from "../gates/gate.js";
import { PACK_GATES } from "../gates/registry.js";
import { ThresholdsSchema } from "./thresholds.js";

/**
 * The gate-ID vocabulary has one owner: the registry. These enums are a projection of it, so
 * a policy.yaml can only name gates that exist and can only give them the severity the
 * registry declares.
 */
function idsBySeverity(gates: readonly PackGate[], severity: "blocking" | "advisory"): [string, ...string[]] {
  const ids = gates.filter(gate => gate.severity === severity).map(gate => gate.id);
  if (ids.length === 0) throw new Error(`the gate registry declares no ${severity} pack gate`);
  return ids as [string, ...string[]];
}

export function verifyPolicySchemaFor(gates: readonly PackGate[]) {
  const blocking = z.enum(idsBySeverity(gates, "blocking"));
  const advisory = z.enum(idsBySeverity(gates, "advisory"));
  const required = [...blocking.options, ...advisory.options];
  const Gate = z.object({ id: z.union([blocking, advisory]), severity: z.enum(["blocking", "advisory"]) }).strict();
  return z.object({
    schemaVersion: z.literal(1),
    gates: z.array(Gate),
    thresholds: ThresholdsSchema,
  }).strict().superRefine((policy, context) => {
    const counts = new Map<string, number>();
    for (const gate of policy.gates) counts.set(gate.id, (counts.get(gate.id) ?? 0) + 1);
    for (const id of required) {
      if (counts.get(id) !== 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["gates"], message: `required gate ${JSON.stringify(id)} must appear exactly once` });
    }
    for (const gate of policy.gates) {
      const expected = (blocking.options as readonly string[]).includes(gate.id) ? "blocking" : "advisory";
      if (gate.severity !== expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ["gates", policy.gates.indexOf(gate), "severity"], message: `${gate.id} must be ${expected}` });
    }
  });
}

export const BlockingGateIdSchema = z.enum(idsBySeverity(PACK_GATES, "blocking"));
export const AdvisoryGateIdSchema = z.enum(idsBySeverity(PACK_GATES, "advisory"));
export const REQUIRED_BLOCKING_GATES = BlockingGateIdSchema.options;
export const REQUIRED_ADVISORY_GATES = AdvisoryGateIdSchema.options;

export const VerifyPolicySchema = verifyPolicySchemaFor(PACK_GATES);
export type VerifyPolicy = z.infer<typeof VerifyPolicySchema>;
