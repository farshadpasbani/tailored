import type { Jd } from "../jd/schema.js";
import { loadCanon } from "../canon/load.js";
import { loadJd } from "../jd/load.js";
import { GateInputError, loadCommandRequirements, ratioOption, RECEIPT_OPTIONS, REQUIREMENTS_OPTIONS, type Gate, type PackGate } from "./gate.js";
import { extractPdfText } from "./run.js";
import { THRESHOLDS } from "../policy/thresholds.js";
import { isVerifiedRequirements, type VerifiedRequirements } from "../requirements/schema.js";

const HEADINGS = ["summary", "profile", "experience", "education", "skills", "projects"];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function norm(s: string): string { return s.toLowerCase().replace(/\s+/g, " "); }

/** Whole-word, case-insensitive presence of `term` in already-normalised `text`. */
function present(text: string, term: string): boolean {
  const t = norm(term).trim();
  if (!t) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(text);
}

export function parseChecks(cvText: string) {
  const text = norm(cvText);
  const textLayer = cvText.replace(/\s/g, "").length >= 200;
  const contact = EMAIL.test(cvText);
  const headings = HEADINGS.filter((h) => present(text, h)).length;
  const ok = textLayer && contact && headings >= 3;
  return { textLayer, contact, headings, ok };
}

export function keywordCoverage(cvText: string, terms: string[], synonyms: Record<string, string[]>) {
  const text = norm(cvText);
  // Index the synonym map by normalised key so lookup is case/whitespace-insensitive.
  const synByNorm = new Map<string, string[]>();
  for (const [key, vals] of Object.entries(synonyms)) synByNorm.set(norm(key).trim(), vals);
  // Dedupe terms by normalised form, keeping first-seen original spelling.
  const seen = new Set<string>();
  const uniqueTerms = terms.filter((t) => { const k = norm(t).trim(); return seen.has(k) ? false : (seen.add(k), true); });
  const covered: string[] = [], missing: string[] = [], synonymOnly: string[] = [];
  for (const term of uniqueTerms) {
    const literal = present(text, term);
    const bySynonym = (synByNorm.get(norm(term).trim()) ?? []).some((v) => present(text, v));
    (literal || bySynonym ? covered : missing).push(term);
    // A synonym can hide a term the JD names literally; report it so a human
    // waives the substitution consciously instead of the gate absorbing it.
    if (!literal && bySynonym) synonymOnly.push(term);
  }
  const ratio = uniqueTerms.length === 0 ? 1 : covered.length / uniqueTerms.length;
  return { covered, missing, synonymOnly, ratio };
}

export function analyzeAts(cvText: string, jd: Jd, min: number) {
  const parse = parseChecks(cvText);
  const must = keywordCoverage(cvText, jd.mustHave, jd.synonyms);
  const nice = keywordCoverage(cvText, jd.niceToHave, jd.synonyms);
  const ok = parse.ok && must.ratio >= min;
  return { ok, parse, must, nice, min };
}

/** Literal ATS vocabulary report for requirements v2. It is intentionally
 * independent of the requirement-evidence fit calculation. */
export function analyzeRequirementAts(cvText: string, requirements: VerifiedRequirements, min: number, policy: { includeAliases: boolean } = { includeAliases: false }) {
  if (!isVerifiedRequirements(requirements)) throw new TypeError("Requirements ATS requires externally anchored requirements returned by parseRequirements or loadRequirements");
  const literals = requirements.requirements.flatMap((requirement) => requirement.ats.literals.map((literal) => literal.term));
  const aliases = policy.includeAliases ? requirements.requirements.flatMap((requirement) => requirement.ats.aliases.map((alias) => alias.term)) : [];
  const terms = [...literals, ...aliases];
  const coverage = keywordCoverage(cvText, terms, {});
  return { ...coverage, min, policy, ok: coverage.ratio >= min };
}

export const atsGate: PackGate = {
  id: "ats",
  severity: "advisory",
  run: async input => {
    const reports = input.artifacts.map(artifact => analyzeRequirementAts(artifact.pdfText, input.requirements, input.thresholds.atsMinimum));
    return {
      id: "ats",
      ok: reports.every(report => report.ok),
      messages: reports.flatMap(report => report.missing.map(term => `missing literal: ${term}`)),
    };
  },
  command: {
    name: "requirements-ats",
    description: "report literal ATS vocabulary separately from verified requirement fit",
    arguments: [{ name: "<pdf>", description: "rendered CV PDF" }],
    options: [
      ...REQUIREMENTS_OPTIONS,
      { flags: "--min <ratio>", description: "minimum literal ATS term coverage", default: String(THRESHOLDS.atsMinimum) },
      { flags: "--include-ats-aliases", description: "explicitly include reviewed aliases/paraphrases in the ATS score" },
      ...RECEIPT_OPTIONS,
    ],
    run: async (args, options) => {
      const pdf = args[0] as string;
      const min = ratioOption(options.min, "--min");
      const canon = loadCanon(options.canon as string);
      if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
      const requirements = loadCommandRequirements(options, canon.data);
      let text: string;
      try { text = await extractPdfText(pdf); }
      catch (error) { throw new GateInputError((error as Error).message); }
      const parse = parseChecks(text);
      const result = analyzeRequirementAts(text, requirements, min, { includeAliases: Boolean(options.includeAtsAliases) });
      const summary = `ATS ${result.policy.includeAliases ? "literal+alias" : "literal"} vocabulary ${Math.round(result.ratio * 100)}% (${result.covered.length}/${result.covered.length + result.missing.length}); verified fit is not inferred`;
      const ok = parse.ok && result.ok;
      return {
        id: "ats", ok,
        messages: [...parseMessages(parse), ...result.missing.map(term => `  missing ATS term: ${term}`)],
        summary: ok ? summary : `${parse.ok ? "parseable" : "not parseable"}; ${summary}`,
      };
    },
  },
};

/** The parse-survival notes both ATS commands print before their coverage verdict. */
function parseMessages(parse: ReturnType<typeof parseChecks>): string[] {
  return [
    ...(parse.textLayer ? [] : ["  parse: no text layer (image-only PDF?)"]),
    ...(parse.contact ? [] : ["  parse: no contact email found"]),
    ...(parse.headings < 3 ? [`  parse: only ${parse.headings}/3 standard headings found`] : []),
  ];
}

/**
 * Terminal-only. The pack lane scores ATS vocabulary against a hash-bound requirement map
 * (`ats`); this command scores the same document against a loose jd.yaml keyword list, which
 * no receipt will accept as authority.
 */
export const legacyAtsGate: Gate = {
  id: "legacy-ats",
  severity: "advisory",
  run: null,
  command: {
    name: "ats",
    description: "check a rendered CV PDF parses for ATS and covers a job's must-have keywords",
    arguments: [{ name: "<pdf>", description: "path to the rendered CV PDF" }],
    options: [
      { flags: "--jd <jd>", description: "path to jd.yaml (role keywords)", required: true },
      { flags: "--min <ratio>", description: "minimum must-have coverage to pass (0..1)", default: String(THRESHOLDS.atsMinimum) },
    ],
    run: async (args, options) => {
      const pdf = args[0] as string;
      const min = ratioOption(options.min, "--min");
      const jd = loadJd(options.jd as string);
      if (!jd.ok) throw new GateInputError(`invalid jd\n  ${jd.errors.join("\n  ")}`);
      // An orphan synonym key (a synonym for a term that is not gated) does nothing; it is
      // almost always a typo, so say so before the coverage verdict.
      const messages = Object.keys(jd.data.synonyms)
        .filter(key => ![...jd.data.mustHave, ...jd.data.niceToHave].includes(key))
        .map(key => `WARN: synonym key "${key}" is not in mustHave/niceToHave`);
      let text: string;
      try { text = await extractPdfText(pdf); }
      catch (error) { throw new GateInputError((error as Error).message, messages); }
      const result = analyzeAts(text, jd.data, min);
      messages.push(...parseMessages(result.parse));
      messages.push(...result.must.missing.map(term => `  missing must-have: ${term}`));
      messages.push(...[...result.must.synonymOnly, ...result.nice.synonymOnly].map(term =>
        `  WARN: "${term}" covered only via synonym; the JD names it literally - surface this to the candidate as add-or-waive, a screener greps the literal string`));
      const percent = Math.round(result.must.ratio * 100);
      return {
        id: "legacy-ats", ok: result.ok, messages,
        summary: result.ok
          ? `ats - parseable, must-have coverage ${percent}% (${result.must.covered.length}/${jd.data.mustHave.length}); nice-to-have ${Math.round(result.nice.ratio * 100)}%`
          : `ats: ${result.parse.ok ? "parseable" : "not parseable"}, must-have coverage ${percent}% (${result.must.covered.length}/${jd.data.mustHave.length}), min ${Math.round(min * 100)}%`,
      };
    },
  },
};
