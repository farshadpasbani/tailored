// The gate registry: the single module that owns which gates exist, their IDs, their
// severities, their order, and the named sets. policy/verify.ts derives its ID vocabulary
// from here, verify/pack.ts assembles a receipt from here, and the CLI dispatches from here.
// Adding a gate is one gate file plus one entry in GATES; anything more is a regression.
//
// The registry dispatches and normalises. It never re-implements a check: every entry either
// delegates to a gate module or states, in one line, why the verdict is already settled.

import { analyzeStrategy } from "../strategy/schema.js";
import { aiTellGate } from "./aiTell.js";
import { atsGate, legacyAtsGate } from "./ats.js";
import { claimIntegrityGate } from "./claimIntegrity.js";
import { distinctnessGate } from "./distinct.js";
import { editorialGate } from "./editorial.js";
import { fitBlockersGate, legacyFitGate } from "./fit.js";
import { aggregateUpstream, type Gate, type GateCommand, type GateInput, type GateSeverity } from "./gate.js";
import { accessibilityGate, impactGate } from "./impact.js";
import { ipGuardGate, protectedTopicsGate } from "./ipGuard.js";
import { pageFitGate } from "./pageFit.js";
import { prohibitedClaimsGate } from "./prohibitedClaims.js";
import { traceGate } from "./trace.js";

/**
 * A gate whose verdict is settled before any gate runs: verify-pack refuses to start unless
 * the input parses and the corpus snapshot is eligible, so reaching the gate lane is the
 * proof. The finding exists so the receipt records that the check was in force.
 */
function settled(id: string, severity: GateSeverity): Gate {
  return { id, severity, run: async () => ({ id, ok: true, messages: [] }), command: null };
}

/** A gate whose evidence is produced per artifact inside the staging transaction. */
function aggregated(id: string, severity: GateSeverity): Gate {
  return { id, severity, run: async input => aggregateUpstream(id, input.upstream), command: null };
}

/** The canon facts and projects a strategy may cite, at the confidence the policy demands. */
function strategyOf(input: GateInput) {
  return analyzeStrategy(input.strategy, {
    projectIds: input.canon.projects.map(project => project.name),
    facts: input.canon.facts,
    minConfidence: input.thresholds.fitMinimumConfidence,
  });
}

const strategySelectionGate: Gate = {
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
const evidenceAltitudeGate: Gate = {
  id: "evidence-altitude",
  severity: "advisory",
  run: async input => {
    return {
      id: "evidence-altitude",
      ok: false,
      messages: [
        ...strategyOf(input).evidence,
        ...input.artifacts.filter(artifact => !input.evidence.claims.some(claim => claim.artifact === artifact.id)).map(artifact => `artifact ${artifact.id} has no claim evidence`),
      ],
    };
  },
  command: null,
};

/**
 * Every gate the product runs. The first block is the pack lane, in receipt order: its IDs
 * and severities are the vocabulary policy.yaml files and receipts already speak, so this
 * order and this spelling are a compatibility contract. The second block is terminal-only
 * legacy checks that no receipt has ever recorded; they never reach policy or verify-pack.
 */
export const GATES: readonly Gate[] = [
  settled("canon-schema", "blocking"),
  settled("evidence-schema", "blocking"),
  settled("requirements-trust", "blocking"),
  fitBlockersGate,
  protectedTopicsGate,
  prohibitedClaimsGate,
  claimIntegrityGate,
  aggregated("pdf-text-layer", "blocking"),
  aggregated("page-integrity", "blocking"),
  settled("corpus-eligibility", "blocking"),
  atsGate,
  aiTellGate,
  impactGate,
  distinctnessGate,
  strategySelectionGate,
  evidenceAltitudeGate,
  editorialGate,
  accessibilityGate,

  pageFitGate,
  ipGuardGate,
  legacyAtsGate,
  legacyFitGate,
  traceGate,
];

/** The gates a verify-pack receipt records, in receipt order. */
export const PACK_GATES: readonly Gate[] = GATES.filter(entry => entry.run !== null);

/** Every gate that exposes a standalone CLI command, in registry order. */
export function gateCommands(gates: readonly Gate[] = GATES): readonly GateCommand[] {
  return gates.flatMap(entry => entry.command ? [entry.command] : []);
}

/** Look a gate up by ID. Throws rather than returning undefined: an unknown ID is a bug. */
export function gate(id: string, gates: readonly Gate[] = GATES): Gate {
  const found = gates.find(entry => entry.id === id);
  if (!found) throw new Error(`no gate ${JSON.stringify(id)} in the registry`);
  return found;
}

/**
 * The named set `tailored smoke` runs over the bundled example: the checks that need no
 * evidence file, in the order smoke reports them.
 */
export const SMOKE_SET: readonly string[] = ["ai-tell", "trace", "impact", "page-fit", "fit-blockers", "legacy-ats"];
