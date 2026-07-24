import { z } from "zod";

const nonBlank = z.string().refine(value => value.trim().length > 0, "must not be blank");
const uniqueIds = z.array(nonBlank).min(1).superRefine((values, context) => {
  if (new Set(values).size !== values.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "IDs must be unique" });
});

export const StrategySchema = z.object({
  schemaVersion: z.literal(1),
  selectedProjectIds: uniqueIds,
  rationale: nonBlank,
  openingMove: nonBlank.optional(),
  argument: nonBlank.optional(),
  anchorFactIds: uniqueIds.optional(),
}).strict();
export type Strategy = z.infer<typeof StrategySchema>;

interface StrategyFact {
  id: string;
  status: string;
  confidence: number;
  allowedUses: string[];
  sensitivity: string;
  provenance: { type: string };
  metrics?: Array<{ denominator?: string; scale?: string; timeframe?: string }>;
}
interface StrategyAuthority { projectIds: string[]; facts: StrategyFact[]; minConfidence: number; }

export function analyzeStrategy(strategy: Strategy, authority: StrategyAuthority): { selection: string[]; evidence: string[] } {
  const projects = new Set(authority.projectIds), facts = new Map(authority.facts.map(fact => [fact.id, fact]));
  const selection = [
    ...(!strategy.openingMove ? ["missing strategy openingMove"] : []),
    ...(!strategy.argument ? ["missing strategy argument"] : []),
    ...strategy.selectedProjectIds.filter(id => !projects.has(id)).map(id => `unknown selected project ${id}`),
    ...(authority.projectIds.length > 1 && strategy.selectedProjectIds.length === authority.projectIds.length && strategy.selectedProjectIds.every(id => projects.has(id)) ? ["selected every available project; selection is not role-specific"] : []),
  ].sort();
  const evidence = ["semantic evidence altitude requires human review under strategy schema v1"];
  if (!strategy.anchorFactIds) evidence.push("missing strategy anchorFactIds");
  else for (const id of strategy.anchorFactIds) {
    const fact = facts.get(id);
    if (!fact) { evidence.push(`unknown anchor fact ${id}`); continue; }
    if (!(["verified", "candidate-attested"] as string[]).includes(fact.status)) evidence.push(`anchor fact ${id} status ${fact.status}`);
    if (fact.confidence === 0 || fact.confidence < authority.minConfidence) evidence.push(`anchor fact ${id} confidence ${fact.confidence} does not meet authority minimum ${authority.minConfidence}`);
    if (fact.sensitivity === "confidential") evidence.push(`anchor fact ${id} sensitivity confidential`);
    if (!fact.allowedUses.includes("fit") || !fact.allowedUses.some(use => use === "cv" || use === "cover")) evidence.push(`anchor fact ${id} is not allowed for fit and outward application use`);
    if (fact.provenance.type === "candidate-attested") evidence.push(`anchor fact ${id} provenance candidate-attested is not independently verified`);
    if (fact.metrics?.some(metric => !metric.denominator || !metric.scale || !metric.timeframe)) evidence.push(`anchor fact ${id} has incomplete structured metrics`);
  }
  return { selection, evidence: evidence.sort() };
}
