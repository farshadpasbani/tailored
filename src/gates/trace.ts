import { readFileSync } from "node:fs";
import { loadCanon } from "../canon/load.js";
import { GateInputError, type Gate } from "./gate.js";
import { htmlToText } from "./text.js";
import type { Canon } from "../canon/schema.js";
import { tokenizeNumericOccurrences } from "./numeric.js";

export interface NumericClaim { raw: string; index: number; value: number; }

/**
 * Every checkable number in `text`: percentages, currency amounts, and counts,
 * including forms with a letter suffix glued to the digits. A known magnitude
 * suffix (k/m/bn) is expanded (2M -> 2000000); any other letter suffix is
 * treated as a unit and the bare number is the value (200ms -> 200), so the
 * claim is still extracted and must trace rather than being silently dropped.
 * Bare years are left to the date-range check.
 */
export function extractNumericClaims(text: string): NumericClaim[] {
  return tokenizeNumericOccurrences(text)
    .filter((occurrence) => (occurrence.kind === "number" || occurrence.kind === "phone")
      && occurrence.value !== undefined
      && !/^(?:19|20)\d{2}$/.test(occurrence.raw))
    .map((occurrence) => ({ raw: occurrence.raw, index: occurrence.index, value: occurrence.value! }));
}

/** Numeric claims in `claims` whose value does not appear anywhere in the canon or JD corpus. */
export function untracedNumbers(claims: NumericClaim[], canonText: string, jdText: string): NumericClaim[] {
  const known = new Set([...extractNumericClaims(canonText), ...extractNumericClaims(jdText)].map((c) => c.value));
  return claims.filter((c) => !known.has(c.value));
}

export interface TitledEntry { title: string; org: string; meta: string; }

// The house style renders each experience/education entry as a title, a comma-separated
// org/institution on the same line, and a following ".meta" div (see house-style.md).
const TITLED_ENTRY_RE = /<span class="title"[^>]*>([^<]*)<\/span>,\s*(?:<span class="(?:org|institution)"[^>]*>)?([^<]*?)(?:<\/span>)?\s*<\/div>\s*<div class="meta"[^>]*>([\s\S]*?)<\/div>/g;

/** Every experience- or education-style (title, org, meta) entry in the house-style HTML. */
export function extractTitledEntries(html: string): TitledEntry[] {
  const entries: TitledEntry[] = [];
  for (const m of html.matchAll(TITLED_ENTRY_RE)) {
    // htmlToText decodes entities, so "Smith &amp; Sons" compares equal to the canon's literal "&".
    entries.push({ title: htmlToText(m[1]), org: htmlToText(m[2]), meta: htmlToText(m[3]) });
  }
  return entries;
}

// The house style separates a project's name from its tagline with a colon (house-style.md).
// A dated project entry wraps its title and year meta in an "eh" header div, so the
// wrapper is optional here; an undated bare title remains valid too.
const PROJECT_ENTRY_RE = /<div class="entry"[^>]*>\s*(?:<div class="eh"[^>]*>\s*)?<div class="title"[^>]*>(?:<span class="project-name"[^>]*>)?([^:<]+)(?:<\/span>)?:/g;

/** Every project name declared in a "Name: tagline" .entry .title (see house-style.md). */
export function extractProjectNames(html: string): string[] {
  return [...html.matchAll(PROJECT_ENTRY_RE)].map((m) => htmlToText(m[1]));
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
    const eduAtOrg = canon.education.filter((e) => eq(e.institution, entry.org));
    if (eduAtOrg.length > 0) {
      // Two degrees can share an institution; pair by qualification when the
      // title names one, else accept any same-institution entry's year.
      const byTitle = eduAtOrg.find((e) => eq(e.qualification, entry.title));
      const ok = byTitle
        ? entry.meta.includes(byTitle.year)
        : eduAtOrg.some((e) => entry.meta.includes(e.year));
      if (!ok) issues.push({ kind: "bad-date", detail: `${entry.org}: ${entry.meta}` });
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
  const parts: string[] = [
    canon.identity.name, canon.identity.role, canon.summary ?? "",
    // A header phone's digit groups are numeric claims; omit these and a real
    // phone number reds the gate as untraced.
    canon.identity.phone ?? "", canon.identity.email ?? "", canon.identity.location ?? "",
  ];
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

/**
 * Terminal-only. The pack lane grounds claims through `claim-integrity`, which binds each
 * marker to an evidence record; trace is the older defence-in-depth sweep over documents
 * that carry no evidence file.
 */
export const traceGate: Gate = {
  id: "trace",
  severity: "blocking",
  run: null,
  command: {
    name: "trace",
    description: "legacy defence-in-depth check for disconnected numeric values, names, and dates; does not prove semantic truth",
    arguments: [{ name: "<html>", description: "path to the rendered HTML document (cv.html or cover.html)" }],
    options: [
      { flags: "--canon <canon>", description: "path to canon.yaml", required: true },
      { flags: "--jd-text <path>", description: "path to the archived job description text, for claims that describe the employer" },
    ],
    run: async (args, options) => {
      const html = args[0] as string;
      const canon = loadCanon(options.canon as string);
      if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
      let content: string;
      try { content = readFileSync(html, "utf8"); }
      catch (error) { throw new GateInputError(`cannot read ${html}: ${(error as Error).message}`); }
      const jdTextPath = options.jdText as string | undefined;
      let jdText = "";
      if (jdTextPath) {
        try { jdText = readFileSync(jdTextPath, "utf8"); }
        catch (error) { throw new GateInputError(`cannot read ${jdTextPath}: ${(error as Error).message}`); }
      }
      const result = analyzeTrace(content, canon.data, jdText);
      return {
        id: "trace", ok: result.ok,
        messages: [
          ...result.untracedNumbers.map(claim => `  untraced claim: "${claim.raw}" (no matching value in the canon${jdTextPath ? " or --jd-text" : ""})`),
          ...result.nameIssues.map(issue => issue.kind === "unknown-name" ? `  unknown name: "${issue.detail}" (not in the canon)` : `  date mismatch: ${issue.detail} (does not match the canon)`),
          ...result.structuralIssues.map(issue => `  structural: ${issue}`),
        ],
        summary: result.ok
          ? `trace - disconnected numeric/name/date checks passed for ${html}; this legacy check does not prove semantic truth`
          : `trace: ${result.untracedNumbers.length} untraced claim(s), ${result.nameIssues.length} name/date issue(s), ${result.structuralIssues.length} structural issue(s) in ${html}`,
      };
    },
  },
};
