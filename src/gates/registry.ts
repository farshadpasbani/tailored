// The gate registry: the single module that owns which gates exist, their IDs, their
// severities, their order, and the named sets. policy/verify.ts derives its ID vocabulary
// from here, verify/pack.ts assembles a receipt from here, and the CLI dispatches from here.
// Adding a gate is one gate file plus one entry below; anything more is a regression.
//
// The registry dispatches and normalises. It never re-implements a check: every entry either
// delegates to a gate module or states, in one line, why the verdict is already settled.

import { aiTellGate } from "./aiTell.js";
import { atsGate, legacyAtsGate } from "./ats.js";
import { claimIntegrityGate } from "./claimIntegrity.js";
import { distinctnessGate } from "./distinct.js";
import { editorialGate } from "./editorial.js";
import { fitBlockersGate, legacyFitGate } from "./fit.js";
import { aggregateUpstream, type Gate, type GateCommand, type GateSeverity, type PackGate } from "./gate.js";
import { accessibilityGate, impactGate } from "./impact.js";
import { ipGuardGate, protectedTopicsGate } from "./ipGuard.js";
import { pageFitGate } from "./pageFit.js";
import { prohibitedClaimsGate } from "./prohibitedClaims.js";
import { evidenceAltitudeGate, strategySelectionGate } from "./strategy.js";
import { traceGate } from "./trace.js";

/**
 * A gate whose verdict is settled before any gate runs: verify-pack refuses to start unless
 * the input parses and the corpus snapshot is eligible, so reaching the gate lane is the
 * proof. The finding exists so the receipt records that the check was in force.
 */
function settled(id: string, severity: GateSeverity): PackGate {
  return { id, severity, run: async () => ({ id, ok: true, messages: [] }), command: null };
}

/** A gate whose evidence is produced per artifact inside the staging transaction. */
function aggregated(id: string, severity: GateSeverity): PackGate {
  return { id, severity, run: async input => aggregateUpstream(id, input.upstream), command: null };
}

/**
 * The gates a verify-pack receipt records, in receipt order. Membership is declared, never
 * inferred from a gate's shape: these IDs and severities are the vocabulary that existing
 * policy.yaml files and receipts already speak, so adding a line here changes what every
 * policy file in the world must contain. Giving a terminal-only gate a receipt lane must not
 * be enough to promote it.
 */
export const PACK_GATES: readonly PackGate[] = [
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
];

/** Legacy checks that only ever ran at a terminal. No receipt has recorded one. */
const TERMINAL_ONLY_GATES: readonly Gate[] = [
  pageFitGate,
  ipGuardGate,
  legacyAtsGate,
  legacyFitGate,
  traceGate,
];

/** Every gate the product runs, pack lane first. */
export const GATES: readonly Gate[] = [...PACK_GATES, ...TERMINAL_ONLY_GATES];

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
