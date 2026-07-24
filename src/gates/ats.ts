import type { Jd } from "../jd/schema.js";
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
