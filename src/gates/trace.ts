import { readFileSync } from "node:fs";
import { canonCorpus } from "../canon/corpus.js";
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
      && !/^(?:19|20)\d{2}$/.test(occurrence.raw)
      && !isListEnumerator(text, occurrence.raw, occurrence.index, occurrence.end))
    .map((occurrence) => ({ raw: occurrence.raw, index: occurrence.index, value: occurrence.value! }));
}

/**
 * A digit numbering a list item rather than counting anything: one or two digits followed by "."
 * or ")", at a line start or just inside a bracket. Neither a claim nor evidence for one - a
 * canon whose claims prose numbered its forms "1. 2. 3." was grounding any document "3".
 */
function isListEnumerator(text: string, raw: string, index: number, end: number): boolean {
  if (!/^\d{1,2}$/.test(raw)) return false;
  const next = text[end];
  if (next !== "." && next !== ")") return false;
  let before = index - 1;
  while (before >= 0 && (text[before] === " " || text[before] === "\t")) before -= 1;
  return before < 0 || text[before] === "\n" || text[before] === "(" || text[before] === "[";
}

// A number is traced when the corpus states the same value in a COMPARABLE CONTEXT, not when the
// same digits turn up anywhere - bare-value matching let the enumerators above ground any equal
// number, and let "a 24 hour rota" ground "24 hours a week". Comparability takes three graded
// signals: how the number is written, the word beside it, the vocabulary of its clause. Any one
// suffices; value and symbol must always agree.

const FUNCTION_WORDS = new Set(("a an the and or of to in on at for with by from as that this it its is are was were be been being "
  + "has have had i we you they he she my our your their his her them me us but not no so if then than there here which who whom "
  + "whose what when where while also both each every all any some into onto out up down per via across over under within without "
  + "between among after before during since until about around roughly approximately approx circa nearly almost more most least "
  + "less fewer plus odd just only still very own other another same such these those one").split(" "));

/** Lowercased, with a plural or participle ending removed, so "tests" and "test" compare equal. */
function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** A sentence boundary: a newline, or terminal punctuation before whitespace ("Nat." is not one). */
const isSentenceEnd = (text: string, i: number) => text[i] === "\n"
  || ((text[i] === "." || text[i] === "!" || text[i] === "?") && !/\S/.test(text[i + 1] ?? " "));

/**
 * About one sentence of prose. A canon field is one line holding several long sentences, and
 * vocabulary sixty words away is not this number's context: uncapped, "cut design time by 90
 * hours" borrowed "python" and "design" from an unrelated project and passed. The smallest cap
 * at which no supported number in the real corpus is flagged (see implementation-notes.md).
 */
const CLAUSE_CHARS = 100;

/**
 * Significant words of the clause on one side of a number: letter runs within `CLAUSE_CHARS`,
 * stopping at the sentence boundary, function words dropped, stemmed. A run the cap cut in half
 * is not a word. A lowercase-to-uppercase boundary splits, because `htmlToText` glues adjacent
 * blocks ("Evaluation & gatingRecall@5") and the glued pair is two words.
 */
function clauseWords(text: string, from: number, direction: 1 | -1): string[] {
  const words: string[] = [];
  let index = from, run = "", travelled = 0, cutOff = false;
  const flush = () => {
    for (const part of direction < 0 ? run.split(/(?<=[a-z])(?=[A-Z])/).reverse() : run.split(/(?<=[a-z])(?=[A-Z])/)) {
      if (part && !FUNCTION_WORDS.has(part.toLowerCase())) words.push(stem(part));
    }
    run = "";
  };
  while (index >= 0 && index < text.length) {
    if (travelled >= CLAUSE_CHARS) { cutOff = true; break; }
    if (/[A-Za-z]/.test(text[index])) run = direction < 0 ? text[index] + run : run + text[index];
    else { flush(); if (isSentenceEnd(text, index)) break; }
    index += direction;
    travelled += 1;
  }
  if (!cutOff) flush();
  return words;
}

const PERCENT_WORDS = new Set(["percent", "percentage", "pc"]);
const AT_LEAST_AHEAD = /^\s*(?:\+|-?plus\b|-?odd\b)/;
const AT_LEAST_BEHIND = /(?:over|above|more than|beyond|upwards of|at least|north of)\s*$/i;
const RANGE_AHEAD = /^\s*(?:to|through|–|—|-|\/|→|>)\s*(\d[\d,]*)/i;
const RANGE_BEHIND = /(\d[\d,]*)\s*(?:to|through|–|—|-|\/|→|>)\s*$/i;

/** `symbol` is "%", a currency sign, or "" for a plain count; `marks` are the written form, an
 *  "at least" marker, a range pairing; `adjacent` is the first word each side. */
interface NumericContext { value: number; symbol: string; marks: Set<string>; adjacent: Set<string>; words: Set<string> }

function contextOf(text: string, raw: string, index: number, value: number): NumericContext {
  const token = raw.trim();
  const end = index + raw.length;
  const ahead = text.slice(end, end + 16), behind = text.slice(Math.max(0, index - 16), index);
  const following = ahead.match(/^[\s-]*([A-Za-z]+)/);
  const symbol = token.match(/^[£$€]/)?.[0]
    ?? (token.endsWith("%") || (following && PERCENT_WORDS.has(following[1].toLowerCase())) ? "%" : "");
  const marks = new Set<string>();
  // "100k" written the same way in both texts is the same figure; bare digits carry no such signal.
  if (!/^[\d,]+$/.test(token)) marks.add(`form:${token.toLowerCase().replace(/[\s,]/g, "")}`);
  if (AT_LEAST_AHEAD.test(ahead) || AT_LEAST_BEHIND.test(behind)) marks.add("atleast");
  const rangeAhead = ahead.match(RANGE_AHEAD);
  if (rangeAhead) marks.add(`range:${value}-${rangeAhead[1].replace(/,/g, "")}`);
  const rangeBehind = behind.match(RANGE_BEHIND);
  if (rangeBehind) marks.add(`range:${rangeBehind[1].replace(/,/g, "")}-${value}`);
  const after = clauseWords(text, end, 1), before = clauseWords(text, index - 1, -1);
  const adjacent = new Set([after[0], before[0]].filter((w): w is string => w !== undefined));
  return { value, symbol, marks, adjacent, words: new Set([...after, ...before]) };
}

// The canon writes small counts in words where a document writes the digit ("across five of
// the services" grounding "across 6 of the services"). Evidence side only: a spelled cardinal
// is a fact the corpus states, never a claim a document has to justify.
const SPELLED_CARDINALS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SPELLED_CARDINAL_RE = new RegExp(`\\b(${Object.keys(SPELLED_CARDINALS).join("|")})\\b`, "gi");

/** Every numeric context the corpus offers as evidence for a claim. */
function corpusContexts(text: string): NumericContext[] {
  const contexts = extractNumericClaims(text).map((c) => contextOf(text, c.raw, c.index, c.value));
  for (const m of text.matchAll(SPELLED_CARDINAL_RE)) {
    const context = contextOf(text, m[0], m.index, SPELLED_CARDINALS[m[0].toLowerCase()]);
    context.marks.delete(`form:${m[0].toLowerCase()}`); // "five" is not a written numeric form
    contexts.push(context);
  }
  return contexts;
}

function comparable(claim: NumericContext, evidence: NumericContext): boolean {
  if (claim.value !== evidence.value || claim.symbol !== evidence.symbol) return false;
  for (const mark of claim.marks) if (evidence.marks.has(mark)) return true;
  for (const word of claim.adjacent) if (evidence.adjacent.has(word)) return true;
  // Two shared clause words, not one: one common word ("production") bridges unrelated
  // sentences that happen to share a value, while a paraphrase of the same fact shares
  // several. This is what stops "shipped 118 features to production" borrowing a canon's
  // "118-test suite, built to production standard".
  let shared = 0;
  for (const word of claim.words) if (evidence.words.has(word) && ++shared === 2) return true;
  return false;
}

/**
 * Numeric claims in `text` that the canon or JD corpus does not support in a comparable
 * context. Equal digits somewhere in the corpus are not enough: see `comparable`.
 */
export function untracedNumbers(text: string, canonText: string, jdText: string): NumericClaim[] {
  const evidence = [...corpusContexts(canonText), ...corpusContexts(jdText)];
  return extractNumericClaims(text).filter((claim) => {
    const context = contextOf(text, claim.raw, claim.index, claim.value);
    return !evidence.some((candidate) => comparable(context, candidate));
  });
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
  const untraced = untracedNumbers(text, canonCorpus(canon), jdText);
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
