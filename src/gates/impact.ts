// The impact lint gate: deterministic checks against the six-second recruiter
// skim, distinct from ai-tell (machine tells) and ats (parser survival). Parses
// the authored HTML (structure-aware: .summary, .entry headers, li elements,
// the style block); see skill/references/house-style.md for the contract.

import { htmlToText, countWords, lineAt } from "./text.js";

/**
 * Strip head/style/script, insert a newline at block-element boundaries, then strip
 * remaining tags. Unlike htmlToText, this preserves the inserted newlines (only
 * collapsing horizontal whitespace within each line) so callers can still report
 * which line a match came from.
 */
function blockText(html: string): string {
  const noHead = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, " ");
  const withBreaks = noHead.replace(/<\/(p|li|div|h[1-6]|section)>/gi, "\n");
  return withBreaks
    .split("\n")
    .map((line) => htmlToText(line))
    .join("\n");
}

function normalizeSentence(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?"']/g, "").replace(/\s+/g, " ").trim();
}

interface Sentence { sentence: string; index: number; }

function extractSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let lineStart = 0;
  for (const line of text.split("\n")) {
    let offset = 0;
    for (const part of line.split(/(?<=[.!?])\s+/)) {
      const trimmed = part.trim();
      if (trimmed) out.push({ sentence: trimmed, index: lineStart + line.indexOf(part, offset) });
      offset += part.length;
    }
    lineStart += line.length + 1;
  }
  return out;
}

export interface ReadabilityResult {
  fontPt: number | null;
  marginMm: number[];
  lineHeight: number | null;
  fontOk: boolean;
  marginOk: boolean;
  lineHeightOk: boolean;
  ok: boolean;
}

/** Body font-size, @page margins, and body line-height must not be compressed below the floor to force page-fit. */
export function checkReadability(html: string, minFontPt: number, minMarginMm: number, minLineHeight: number): ReadabilityResult {
  // Several selectors may include "body" (e.g. a shared "html, body { margin: 0 }" reset);
  // take the first body block that actually declares a font-size.
  const bodyBlocks = html.match(/\bbody\s*{[^}]*}/gi) ?? [];
  const fontMatch = bodyBlocks.map((b) => b.match(/font-size:\s*([\d.]+)pt/i)).find(Boolean);
  const fontPt = fontMatch ? Number(fontMatch[1]) : null;

  // Only a unitless line-height counts as declared; a unit-carrying value (14pt, 1.2em)
  // does not scale with font-size the same way, so treat it as absent and fail.
  const lineMatch = bodyBlocks.map((b) => b.match(/line-height:\s*([\d.]+)\s*[;}]/i)).find(Boolean);
  const lineHeight = lineMatch ? Number(lineMatch[1]) : null;

  const pageMatch = html.match(/@page\s*{[^}]*}/i);
  // CSS allows a block's final declaration to omit its semicolon, so terminate
  // on either `;` or the closing `}` rather than requiring a trailing `;`.
  const marginMatch = pageMatch?.[0].match(/margin:\s*([^;}]+)/i);
  const marginMm = marginMatch
    ? [...marginMatch[1].matchAll(/([\d.]+)mm/g)].map((m) => Number(m[1]))
    : [];

  const fontOk = fontPt !== null && fontPt >= minFontPt;
  const marginOk = marginMm.length > 0 && marginMm.every((m) => m >= minMarginMm);
  const lineHeightOk = lineHeight !== null && lineHeight >= minLineHeight;
  return { fontPt, marginMm, lineHeight, fontOk, marginOk, lineHeightOk, ok: fontOk && marginOk && lineHeightOk };
}

export interface SkillViolation { text: string; words: number; }
export interface SkillDensityResult { violations: SkillViolation[]; ok: boolean; }

/** Each .skill value must stay within the word cap; a keyword dump is ATS bait, not a skills row. */
export function checkSkillDensity(html: string, maxWords: number): SkillDensityResult {
  const violations: SkillViolation[] = [];
  for (const m of html.matchAll(/<span[^>]*\bclass="[^"]*\bv\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)) {
    const text = htmlToText(m[1]);
    const words = countWords(text);
    if (words > maxWords) violations.push({ text, words });
  }
  return { violations, ok: violations.length === 0 };
}

export interface SummaryCeilingResult { words: number; ok: boolean; }

/** The .summary paragraph must not exceed the word ceiling; page-fit must come from selection, not padding. */
export function checkSummaryCeiling(html: string, maxWords: number): SummaryCeilingResult {
  const m = html.match(/<p[^>]*\bclass="[^"]*\bsummary\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return { words: 0, ok: true };
  const words = countWords(htmlToText(m[1]));
  return { words, ok: words <= maxWords };
}

export interface DuplicateSentence { sentence: string; locations: { line: number; index: number }[]; }
export interface DuplicateSentencesResult { duplicates: DuplicateSentence[]; ok: boolean; }

/** No normalised sentence of 8+ words may appear twice (the summary restating a bullet verbatim is the canonical failure). */
export function checkDuplicateSentences(html: string): DuplicateSentencesResult {
  const text = blockText(html);
  const byNorm = new Map<string, { sentence: string; locations: { line: number; index: number }[] }>();
  for (const { sentence, index } of extractSentences(text)) {
    const norm = normalizeSentence(sentence);
    if (countWords(norm) < 8) continue;
    const entry = byNorm.get(norm) ?? { sentence, locations: [] };
    entry.locations.push({ line: lineAt(text, index), index });
    byNorm.set(norm, entry);
  }
  const duplicates = [...byNorm.values()].filter((e) => e.locations.length > 1);
  return { duplicates, ok: duplicates.length === 0 };
}

const CONTRAST_RE = /,\s*not\s|;\s*not\s|,\s*never\s/gi;

export interface ContrastResult { count: number; matches: string[]; ok: boolean; }

/** At most one 'X, not Y' rhetorical contrast per document; a second use turns voice into a template. */
export function checkContrast(html: string): ContrastResult {
  const text = blockText(html);
  const matches = text.match(CONTRAST_RE) ?? [];
  return { count: matches.length, matches, ok: matches.length <= 1 };
}

const FIRST_PERSON_RE = /\b(i|i'm|i've|i'll|my)\b/i;
const THIRD_PERSON_RE = /\b(he|she|him|her|his|hers)\b/i;

export interface PersonConsistencyResult { firstPerson: boolean; thirdPerson: boolean; ok: boolean; }

/** The document must not mix third-person self-reference with first person. */
export function checkPersonConsistency(html: string): PersonConsistencyResult {
  const text = blockText(html);
  const firstPerson = FIRST_PERSON_RE.test(text);
  const thirdPerson = THIRD_PERSON_RE.test(text);
  return { firstPerson, thirdPerson, ok: !(firstPerson && thirdPerson) };
}

const YEAR_RE = /\b(19|20)\d{2}\b/;

export interface DatedEntriesResult { undated: { section: string; header: string }[]; ok: boolean; }

/** Every project and experience entry must carry a year in its header line, so recency is legible. */
export function checkDatedEntries(html: string): DatedEntriesResult {
  const undated: { section: string; header: string }[] = [];
  for (const sectionMatch of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)) {
    const heading = htmlToText(sectionMatch[1]);
    if (!/project|experience/i.test(heading)) continue;
    const sectionBody = sectionMatch[2];
    const entries = sectionBody.split(/<div\s+class="entry"[^>]*>/i).slice(1);
    for (const entryHtml of entries) {
      const headerHtml = entryHtml.split(/<ul\b/i)[0];
      const header = htmlToText(headerHtml);
      if (!YEAR_RE.test(header)) undated.push({ section: heading, header });
    }
  }
  return { undated, ok: undated.length === 0 };
}

const WEAK_PHRASE_RE = /^(responsible for|involved in|worked on|helped to)\b/i;

export interface BulletViolation { text: string; reason: "over-bound" | "weak-phrase"; }
export interface BulletBoundsResult { violations: BulletViolation[]; ok: boolean; }

/** Each li must stay within the word bound and must not open with a banned weak phrase. */
export function checkBulletBounds(html: string, maxWords: number): BulletBoundsResult {
  const violations: BulletViolation[] = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = htmlToText(m[1]);
    if (countWords(text) > maxWords) violations.push({ text, reason: "over-bound" });
    if (WEAK_PHRASE_RE.test(text)) violations.push({ text, reason: "weak-phrase" });
  }
  return { violations, ok: violations.length === 0 };
}

export interface ImpactOptions {
  minFontPt: number;
  minMarginMm: number;
  minLineHeight: number;
  summaryMaxWords: number;
  bulletMaxWords: number;
  skillMaxWords: number;
  checkMinFont: boolean;
  checkMinMargin: boolean;
  checkMinLineHeight: boolean;
  checkSummaryCeiling: boolean;
  checkDuplicateSentence: boolean;
  checkSkillDensity: boolean;
  checkContrast: boolean;
  checkPersonConsistency: boolean;
  checkDatedEntries: boolean;
  checkBulletBounds: boolean;
}

export const defaultImpactOptions: ImpactOptions = {
  minFontPt: 9,
  minMarginMm: 8,
  minLineHeight: 1.28,
  summaryMaxWords: 60,
  bulletMaxWords: 45,
  skillMaxWords: 18,
  checkMinFont: true,
  checkMinMargin: true,
  checkMinLineHeight: true,
  checkSummaryCeiling: true,
  checkDuplicateSentence: true,
  checkSkillDensity: true,
  checkContrast: true,
  checkPersonConsistency: true,
  checkDatedEntries: true,
  checkBulletBounds: true,
};

export interface ImpactResult {
  readability: ReadabilityResult | null;
  summary: SummaryCeilingResult | null;
  duplicates: DuplicateSentencesResult | null;
  skills: SkillDensityResult | null;
  contrast: ContrastResult | null;
  person: PersonConsistencyResult | null;
  dated: DatedEntriesResult | null;
  bullets: BulletBoundsResult | null;
  ok: boolean;
}

/** Run every enabled check and combine into one pass/fail verdict. Each check is individually silenceable. */
export function analyzeImpact(html: string, opts: ImpactOptions): ImpactResult {
  const wantReadability = opts.checkMinFont || opts.checkMinMargin || opts.checkMinLineHeight;
  const readability = wantReadability ? checkReadability(html, opts.minFontPt, opts.minMarginMm, opts.minLineHeight) : null;
  // A silenced sub-check (font, margin, or line-height) cannot fail the readability verdict on its own.
  const readabilityOk = !readability || (
    (!opts.checkMinFont || readability.fontOk)
    && (!opts.checkMinMargin || readability.marginOk)
    && (!opts.checkMinLineHeight || readability.lineHeightOk)
  );

  const summary = opts.checkSummaryCeiling ? checkSummaryCeiling(html, opts.summaryMaxWords) : null;
  const duplicates = opts.checkDuplicateSentence ? checkDuplicateSentences(html) : null;
  const skills = opts.checkSkillDensity ? checkSkillDensity(html, opts.skillMaxWords) : null;
  const contrast = opts.checkContrast ? checkContrast(html) : null;
  const person = opts.checkPersonConsistency ? checkPersonConsistency(html) : null;
  const dated = opts.checkDatedEntries ? checkDatedEntries(html) : null;
  const bullets = opts.checkBulletBounds ? checkBulletBounds(html, opts.bulletMaxWords) : null;

  const ok = readabilityOk
    && (summary?.ok ?? true)
    && (duplicates?.ok ?? true)
    && (skills?.ok ?? true)
    && (contrast?.ok ?? true)
    && (person?.ok ?? true)
    && (dated?.ok ?? true)
    && (bullets?.ok ?? true);

  return { readability, summary, duplicates, skills, contrast, person, dated, bullets, ok };
}
