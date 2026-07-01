import { normalizeNumber, htmlToText } from "./text.js";
import type { Canon } from "../canon/schema.js";

export interface NumericClaim { raw: string; index: number; value: number; }

const YEAR_RE = /^(19|20)\d{2}$/;
// Currency (with optional k/m/bn magnitude), percentage, or a count with an optional
// letter suffix glued to the digits (2M, 40k, 1.2bn, 200ms).
const CLAIM_RE = /[£$€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|bn))?\b|\d+(?:\.\d+)?%|\b\d[\d,]*(?:\.\d+)?[a-z]*\b/gi;

/**
 * Every checkable number in `text`: percentages, currency amounts, and counts,
 * including forms with a letter suffix glued to the digits. A known magnitude
 * suffix (k/m/bn) is expanded (2M -> 2000000); any other letter suffix is
 * treated as a unit and the bare number is the value (200ms -> 200), so the
 * claim is still extracted and must trace rather than being silently dropped.
 * Bare years are left to the date-range check.
 */
export function extractNumericClaims(text: string): NumericClaim[] {
  const claims: NumericClaim[] = [];
  for (const m of text.matchAll(CLAIM_RE)) {
    const raw = m[0];
    if (YEAR_RE.test(raw)) continue;
    const value = normalizeNumber(raw) ?? normalizeNumber(raw.replace(/[a-z]+$/i, ""));
    if (value === null) continue;
    claims.push({ raw, index: m.index, value });
  }
  return claims;
}

/** Numeric claims in `claims` whose value does not appear anywhere in the canon or JD corpus. */
export function untracedNumbers(claims: NumericClaim[], canonText: string, jdText: string): NumericClaim[] {
  const known = new Set([...extractNumericClaims(canonText), ...extractNumericClaims(jdText)].map((c) => c.value));
  return claims.filter((c) => !known.has(c.value));
}

export interface TitledEntry { title: string; org: string; meta: string; }

// The house style renders each experience/education entry as a title, a comma-separated
// org/institution on the same line, and a following ".meta" div (see house-style.md).
const TITLED_ENTRY_RE = /<span class="title">([^<]*)<\/span>,\s*([^<]*?)\s*<\/div>\s*<div class="meta">([^<]*)<\/div>/g;

/** Every experience- or education-style (title, org, meta) entry in the house-style HTML. */
export function extractTitledEntries(html: string): TitledEntry[] {
  const entries: TitledEntry[] = [];
  for (const m of html.matchAll(TITLED_ENTRY_RE)) {
    entries.push({ title: m[1].trim(), org: m[2].trim(), meta: m[3].trim() });
  }
  return entries;
}

// The house style separates a project's name from its tagline with a colon (house-style.md).
// A dated project entry wraps its title and year meta in an "eh" header div, so the
// wrapper is optional here; an undated bare title remains valid too.
const PROJECT_ENTRY_RE = /<div class="entry">\s*(?:<div class="eh">\s*)?<div class="title">([^:<]+):/g;

/** Every project name declared in a "Name: tagline" .entry .title (see house-style.md). */
export function extractProjectNames(html: string): string[] {
  return [...html.matchAll(PROJECT_ENTRY_RE)].map((m) => m[1].trim());
}

export interface NameOrDateIssue { kind: "unknown-name" | "bad-date"; detail: string; }

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Checks every experience/education entry's org (and its date range) and every project
 * name against the canon. An org or project not found in the canon is an unknown-name
 * issue; an org that is found but whose rendered date range does not match the canon's
 * start/end for that employer is a bad-date issue.
 */
export function checkNamesAndDates(entries: TitledEntry[], projectNames: string[], canon: Canon): NameOrDateIssue[] {
  const issues: NameOrDateIssue[] = [];
  for (const entry of entries) {
    const job = canon.experience.find((e) => eq(e.org, entry.org));
    if (job) {
      const dateRe = new RegExp(`${escapeRe(job.start)}\\s*[–—-]\\s*${escapeRe(job.end)}`, "i");
      if (!dateRe.test(entry.meta)) issues.push({ kind: "bad-date", detail: `${entry.org}: ${entry.meta.replace(/^[^0-9]*/, "")}` });
      continue;
    }
    const edu = canon.education.find((e) => eq(e.institution, entry.org));
    if (edu) {
      if (!entry.meta.includes(edu.year)) issues.push({ kind: "bad-date", detail: `${entry.org}: ${entry.meta}` });
      continue;
    }
    issues.push({ kind: "unknown-name", detail: entry.org });
  }
  for (const name of projectNames) {
    if (!canon.projects.some((p) => eq(p.name, name))) issues.push({ kind: "unknown-name", detail: name });
  }
  return issues;
}

/** Every fact-bearing text field in the canon, joined into one corpus a claim can trace to. */
export function canonCorpus(canon: Canon): string {
  const parts: string[] = [canon.identity.name, canon.identity.role, canon.summary ?? ""];
  for (const s of canon.skills) parts.push(s.label, s.value);
  for (const p of canon.projects) parts.push(p.name, p.tagline ?? "", ...p.bullets);
  for (const e of canon.experience) parts.push(e.title, e.org, e.start, e.end, ...e.bullets);
  for (const ed of canon.education) parts.push(ed.qualification, ed.institution, ed.year, ed.result ?? "", ed.note ?? "");
  parts.push(...canon.certifications, ...canon.publications);
  return parts.join(" ");
}

export interface TraceResult { ok: boolean; untracedNumbers: NumericClaim[]; nameIssues: NameOrDateIssue[]; structuralIssues: string[]; }

const H2_RE = /<h2[^>]*>([^<]*)<\/h2>/gi;

/**
 * Fail-closed guard against markup drift: if the document declares an
 * experience/education or projects section heading but the house-style
 * extractors parsed nothing from it, the name/date half of the gate would
 * otherwise pass vacuously on []. Report that as a failure instead.
 */
function structuralChecks(html: string, entryCount: number, projectCount: number): string[] {
  const headings = [...html.matchAll(H2_RE)].map((m) => m[1].trim().toLowerCase());
  const issues: string[] = [];
  if (headings.some((h) => /experience|education/.test(h)) && entryCount === 0)
    issues.push("document has an experience/education section but no titled entry could be extracted; markup may have drifted from house-style");
  if (headings.some((h) => /project/.test(h)) && projectCount === 0)
    issues.push("document has a projects section but no project name could be extracted; markup may have drifted from house-style");
  return issues;
}

/** Traces every checkable claim in `html` to the canon (and optionally the archived JD text). */
export function analyzeTrace(html: string, canon: Canon, jdText: string): TraceResult {
  const text = htmlToText(html);
  const docClaims = extractNumericClaims(text);
  const untraced = untracedNumbers(docClaims, canonCorpus(canon), jdText);
  const entries = extractTitledEntries(html);
  const projectNames = extractProjectNames(html);
  const nameIssues = checkNamesAndDates(entries, projectNames, canon);
  const structuralIssues = structuralChecks(html, entries.length, projectNames.length);
  return {
    ok: untraced.length === 0 && nameIssues.length === 0 && structuralIssues.length === 0,
    untracedNumbers: untraced,
    nameIssues,
    structuralIssues,
  };
}
