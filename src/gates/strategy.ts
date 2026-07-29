// The two gates that read the pack's strategy record rather than its documents: whether the
// selection is role-specific, and whether the evidence it anchors on sits at the right
// altitude. Both delegate to analyzeStrategy; neither re-implements the check.

import { analyzeStrategy } from "../strategy/schema.js";
import type { GateInput, PackGate } from "./gate.js";

/** The canon facts and projects a strategy may cite, at the confidence the policy demands. */
function strategyOf(input: GateInput) {
  return analyzeStrategy(input.strategy, {
    projectIds: input.canon.projects.map(project => project.name),
    facts: input.canon.facts,
    minConfidence: input.thresholds.fitMinimumConfidence,
  });
}

export const strategySelectionGate: PackGate = {
  id: "strategy-selection",
  severity: "advisory",
  run: async input => {
    const selection = strategyOf(input).selection;
    return { id: "strategy-selection", ok: selection.length === 0, messages: selection };
  },
  command: null,
};

/**
 * Never `ok`: whether the evidence sits at the right altitude is a human judgement under
 * strategy schema v1, so this gate always reports for review.
 */
export const evidenceAltitudeGate: PackGate = {
  id: "evidence-altitude",
  severity: "advisory",
  run: async input => ({
    id: "evidence-altitude",
    ok: false,
    messages: [
      ...strategyOf(input).evidence,
      ...input.artifacts.filter(artifact => !input.evidence.claims.some(claim => claim.artifact === artifact.id)).map(artifact => `artifact ${artifact.id} has no claim evidence`),
    ],
  }),
  command: null,
};
