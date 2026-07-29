import type { Canon, FactV2Schema } from "../canon/schema.js";
import type { Jd } from "../jd/schema.js";
import { keywordCoverage } from "./ats.js";
import { loadCanon } from "../canon/load.js";
import { loadJd } from "../jd/load.js";
import { GateInputError, loadCommandRequirements, RECEIPT_OPTIONS, REQUIREMENTS_OPTIONS, type Gate } from "./gate.js";
import { isVerifiedRequirements, type Requirement, type VerifiedRequirements } from "../requirements/schema.js";
import type { z } from "zod";

export type FitVerdict = "APPLY" | "APPLY-WITH-GAPS" | "SKIP";

/** Flatten a canon's textual content (summary, skills, projects, experience,
 * education, certifications, publications, claims) into one searchable string,
 * so a keyword-coverage matcher can be run against it. */
export function canonToText(canon: Canon): string {
  const parts: string[] = [];
  if (canon.summary) parts.push(canon.summary);
  for (const s of canon.skills) parts.push(`${s.label} ${s.value}`);
  for (const p of canon.projects) parts.push([p.name, p.tagline, ...p.bullets].filter(Boolean).join(" "));
  for (const e of canon.experience) parts.push([e.title, e.org, ...e.bullets].join(" "));
  for (const e of canon.education) parts.push([e.qualification, e.institution, e.note].filter(Boolean).join(" "));
  parts.push(...canon.certifications, ...canon.publications);
  if (canon.claims?.can) parts.push(...canon.claims.can);
  return parts.join("\n");
}

/** Triage a jd against a canon's flattened text: must-have coverage against the
 * canon's full text (reusing the ats gate's synonym-aware matcher) decides the
 * verdict; nice-to-have is reported but never changes it. */
export function analyzeFit(canonText: string, jd: Jd, opts: { apply: number; floor: number }) {
  const must = keywordCoverage(canonText, jd.mustHave, jd.synonyms);
  const nice = keywordCoverage(canonText, jd.niceToHave, jd.synonyms);
  const verdict: FitVerdict = must.ratio >= opts.apply ? "APPLY" : must.ratio < opts.floor ? "SKIP" : "APPLY-WITH-GAPS";
  return { verdict, must, nice, apply: opts.apply, floor: opts.floor };
}

/** Returns an error message if `floor` exceeds `apply` (an incoherent threshold pair), else undefined. */
export function validateThresholds(apply: number, floor: number): string | undefined {
  if (floor > apply) return `--floor (${floor}) must not exceed --apply (${apply})`;
  return undefined;
}

export type RequirementFitVerdict = "STRONG" | "MIXED" | "WEAK" | "BLOCKED";
export type FitEvidencePolicy = {
  allowCandidateAttested: boolean;
  minConfidence: number;
  allowedUses: readonly string[];
  allowedSensitivities: readonly ("public" | "private" | "confidential")[];
  allowedProvenanceTypes: readonly ("candidate-attested" | "artifact" | "external")[];
};

function factEligible(fact: z.infer<typeof FactV2Schema> | undefined, policy: FitEvidencePolicy): boolean {
  if (!fact || !["verified", "candidate-attested"].includes(fact.status)) return false;
  if (fact.status === "candidate-attested" && !policy.allowCandidateAttested) return false;
  if (!(fact.confidence >= policy.minConfidence) || fact.confidence === 0) return false;
  if (!policy.allowedUses.some((use) => fact.allowedUses.includes(use))) return false;
  if (!policy.allowedSensitivities.includes(fact.sensitivity)) return false;
  if (!policy.allowedProvenanceTypes.includes(fact.provenance.type)) return false;
  return true;
}

/** Verified fit authority. The function deliberately accepts no CV text: lexical
 * edits therefore cannot turn vocabulary into candidate evidence. */
export function analyzeRequirementFit(requirements: VerifiedRequirements, canon: Canon, policy: FitEvidencePolicy) {
  if (!isVerifiedRequirements(requirements)) throw new TypeError("Verified fit requires requirements returned by parseRequirements or loadRequirements with full trust context");
  if (!(policy.minConfidence >= 0 && policy.minConfidence <= 1)) throw new RangeError("fit evidence minConfidence must be in [0,1]");
  const direct: Requirement[] = [];
  const transferable: Requirement[] = [];
  const materialGaps: Requirement[] = [];
  const waived: Requirement[] = [];
  const hardBlockers: Requirement[] = [];
  const eligibilityUncertainties: Requirement[] = [];
  const reclassified: Requirement[] = [];
  const ineligibleEvidence: Requirement[] = [];
  let earnedWeight = 0;
  let totalWeight = 0;
  for (const requirement of requirements.requirements) {
    if (!Number.isFinite(requirement.weight) || requirement.weight <= 0 || requirement.weight > 100) throw new Error(`Invalid weight for requirement ${JSON.stringify(requirement.id)}: must be finite and in (0,100]`);
    if (requirement.eligibilityImpact !== "none" && requirement.evidence.kind !== "gap") throw new Error(`Eligibility state for requirement ${JSON.stringify(requirement.id)} must retain explicit gap evidence`);
    totalWeight += requirement.weight;
    if (!Number.isFinite(totalWeight) || totalWeight > 1_000) throw new Error("Aggregate requirement weight must be finite and at most 1000");
    const evidenceEligible = requirement.evidence.kind !== "direct" && requirement.evidence.kind !== "transferable"
      ? false
      : requirement.evidence.factIds.every((id) => factEligible(canon.facts.find((fact) => fact.id === id), policy));
    if ((requirement.evidence.kind === "direct" || requirement.evidence.kind === "transferable") && !evidenceEligible) {
      ineligibleEvidence.push(requirement);
    } else if (requirement.evidence.kind === "direct") {
      direct.push(requirement);
      earnedWeight += requirement.weight;
    } else if (requirement.evidence.kind === "transferable") {
      transferable.push(requirement);
      earnedWeight += requirement.weight * 0.5;
    } else if (requirement.evidence.kind === "waived") {
      waived.push(requirement);
    } else if (requirement.eligibilityImpact === "none") {
      materialGaps.push(requirement);
    }
    if (requirement.eligibilityImpact === "blocker") hardBlockers.push(requirement);
    if (requirement.eligibilityImpact === "uncertain") eligibilityUncertainties.push(requirement);
    if (requirement.classification.current !== requirement.classification.frozen) reclassified.push(requirement);
  }
  const score = totalWeight === 0 ? 0 : earnedWeight / totalWeight;
  if (!Number.isFinite(totalWeight) || !Number.isFinite(earnedWeight) || !Number.isFinite(score)) throw new RangeError("fit aggregate is non-finite");
  const verdict: RequirementFitVerdict = hardBlockers.length > 0 ? "BLOCKED" : score >= 0.8 ? "STRONG" : score >= 0.5 ? "MIXED" : "WEAK";
  return { verdict, score, earnedWeight, totalWeight, direct, transferable, materialGaps, waived, hardBlockers, eligibilityUncertainties, reclassified, ineligibleEvidence };
}

/** The evidence a fit calculation is allowed to spend, given the operator's attestation choice. */
export function fitEvidencePolicy(allowCandidateAttested: boolean): FitEvidencePolicy {
  return { allowCandidateAttested, minConfidence: 0.5, allowedUses: ["fit"], allowedSensitivities: ["public", "private"], allowedProvenanceTypes: ["candidate-attested", "artifact", "external"] };
}

export const fitBlockersGate: Gate = {
  id: "fit-blockers",
  severity: "blocking",
  run: async input => {
    const fit = analyzeRequirementFit(input.requirements, input.canon, {
      allowCandidateAttested: true,
      minConfidence: input.thresholds.fitMinimumConfidence,
      allowedUses: ["fit"], allowedSensitivities: ["public", "private"],
      allowedProvenanceTypes: ["candidate-attested", "artifact", "external"],
    });
    const floor = input.thresholds.fitMinimumScore;
    return {
      id: "fit-blockers",
      ok: fit.hardBlockers.length === 0 && fit.score >= floor,
      messages: [
        ...fit.hardBlockers.map(requirement => `hard blocker: ${requirement.id}`),
        ...(fit.score < floor ? [`verified fit ${fit.score} is below policy floor ${floor}`] : []),
      ],
    };
  },
  command: {
    name: "fit",
    description: "calculate verified fit only from a frozen requirements-to-canon-evidence map",
    arguments: [],
    options: [
      ...REQUIREMENTS_OPTIONS,
      { flags: "--allow-candidate-attested", description: "explicitly permit candidate-attested facts to award fit weight" },
      ...RECEIPT_OPTIONS,
    ],
    run: async (_args, options) => {
      const canon = loadCanon(options.canon as string);
      if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
      const requirements = loadCommandRequirements(options, canon.data);
      const result = analyzeRequirementFit(requirements, canon.data, fitEvidencePolicy(Boolean(options.allowCandidateAttested)));
      const label = (kind: string, requirements: { id: string }[]) => requirements.map(requirement => `  ${kind}: ${requirement.id}`);
      return {
        id: "fit-blockers",
        // The verdict, not the blocker list, decides the exit code: MIXED still applies.
        ok: !(result.verdict === "BLOCKED" || result.verdict === "WEAK"),
        verdict: result.verdict,
        messages: [
          ...label("direct evidence", result.direct),
          ...label("transferable evidence", result.transferable),
          ...label("material gap", result.materialGaps),
          ...result.waived.map(requirement => `  waived evidence gap: ${requirement.id} (${requirement.evidence.kind === "waived" ? requirement.evidence.waiver.id : ""})`),
          ...label("reclassified by validated prior receipt", result.reclassified),
          ...label("ineligible canon evidence", result.ineligibleEvidence),
          ...label("eligibility uncertain", result.eligibilityUncertainties),
          ...label("HARD BLOCKER", result.hardBlockers),
        ],
        summary: `verified requirement-evidence fit ${Math.round(result.score * 100)}% (${result.earnedWeight}/${result.totalWeight} weighted evidence)`,
      };
    },
  },
};

/**
 * Terminal-only. Keyword coverage of a canon against a loose jd.yaml: a triage signal for
 * whether a role is worth drafting, never the verified fit a receipt records.
 */
export const legacyFitGate: Gate = {
  id: "legacy-fit",
  severity: "advisory",
  run: null,
  command: {
    name: "legacy-fit",
    description: "legacy compatibility: keyword coverage against canon text (not verified fit)",
    arguments: [],
    options: [
      { flags: "--jd <jd>", description: "path to jd.yaml", required: true },
      { flags: "--canon <canon>", description: "path to canon.yaml", required: true },
      { flags: "--apply <ratio>", description: "must-have coverage at/above which the verdict is APPLY", default: "0.8" },
      { flags: "--floor <ratio>", description: "must-have coverage below which the verdict is SKIP", default: "0.5" },
    ],
    run: async (_args, options) => {
      const apply = Number(options.apply), floor = Number(options.floor);
      if (!(apply >= 0 && apply <= 1)) throw new GateInputError(`--apply must be a number in [0,1], got ${JSON.stringify(options.apply)}`);
      if (!(floor >= 0 && floor <= 1)) throw new GateInputError(`--floor must be a number in [0,1], got ${JSON.stringify(options.floor)}`);
      const thresholdError = validateThresholds(apply, floor);
      if (thresholdError) throw new GateInputError(thresholdError);
      const jd = loadJd(options.jd as string);
      if (!jd.ok) throw new GateInputError(`invalid jd\n  ${jd.errors.join("\n  ")}`);
      const canon = loadCanon(options.canon as string);
      if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
      const result = analyzeFit(canonToText(canon.data), jd.data, { apply, floor });
      return {
        id: "legacy-fit",
        ok: result.verdict !== "SKIP",
        verdict: result.verdict,
        messages: result.must.missing.map(term => `  gap: "${term}" not covered by the canon - does the canon genuinely lack it, or is it phrased differently?`),
        summary: `must-have coverage ${Math.round(result.must.ratio * 100)}% (${result.must.covered.length}/${jd.data.mustHave.length}); nice-to-have ${Math.round(result.nice.ratio * 100)}%`,
      };
    },
  },
};
