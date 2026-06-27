import type { Jd } from "../jd/schema.js";

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
  const covered: string[] = [], missing: string[] = [];
  for (const term of terms) {
    const variants = [term, ...(synonyms[term] ?? [])];
    (variants.some((v) => present(text, v)) ? covered : missing).push(term);
  }
  const ratio = terms.length === 0 ? 1 : covered.length / terms.length;
  return { covered, missing, ratio };
}

export function analyzeAts(cvText: string, jd: Jd, min: number) {
  const parse = parseChecks(cvText);
  const must = keywordCoverage(cvText, jd.mustHave, jd.synonyms);
  const nice = keywordCoverage(cvText, jd.niceToHave, jd.synonyms);
  const ok = parse.ok && must.ratio >= min;
  return { ok, parse, must, nice, min };
}
