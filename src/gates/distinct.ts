// The distinct gate: the anti-template check. A cover note read once is voice;
// the same sentences read across two applications are a stamp. Two detectors:
// shared runs of SHINGLE_WORDS+ words against any single prior (verbatim reuse),
// and signature phrases of SIGNATURE_WORDS+ words recurring across two or more
// priors (the pet phrase that fingerprints a batch). The letterhead (<header>)
// and <head> are excluded by design, and factual sections that legitimately
// repeat (education, certifications) can be excluded by name.

import { htmlToText } from "./text.js";

const SHINGLE_WORDS = 8;
const SIGNATURE_WORDS = 4;

export interface PriorDoc { name: string; html: string; }
export interface SharedRun { text: string; sources: string[]; }
export interface DistinctResult { shared: SharedRun[]; signatures: SharedRun[]; ok: boolean; }
export interface DistinctOptions {
  maxShared?: number;
  maxSignatures?: number;
  ignoreSections?: string[];
  /**
   * Plain text of the candidate's canon. A signature run found verbatim in it is a
   * canonical fact (a job title, a project name, an approved number) that legitimately
   * recurs in every document built from that canon, not a voice tic; such runs are
   * exempt. Only wholly-canon runs are exempt: a run that welds canon text to
   * non-canon glue stays flagged.
   */
  canonText?: string;
}

function stripHeader(html: string): string {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ");
}

function stripSections(html: string, names: string[]): string {
  if (names.length === 0) return html;
  const wanted = names.map((n) => n.toLowerCase());
  return html.replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi, (block) => {
    const h2 = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const heading = h2 ? htmlToText(h2[1]).toLowerCase() : "";
    return wanted.some((n) => heading.includes(n)) ? " " : block;
  });
}

function normalizeTokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * The document's prose, one token stream per <p>/<li>. Headings, title lines,
 * links, and meta rows are house-style structure, identical across documents by
 * design, so they are not scanned; and a run never merges across an element
 * boundary. A document with no <p>/<li> at all falls back to one whole-body stream.
 */
function proseStreams(html: string, ignoreSections: string[]): string[][] {
  const scoped = stripSections(stripHeader(html), ignoreSections);
  const streams: string[][] = [];
  for (const m of scoped.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tokens = normalizeTokens(htmlToText(m[2]));
    if (tokens.length > 0) streams.push(tokens);
  }
  if (streams.length === 0) {
    const tokens = normalizeTokens(htmlToText(scoped));
    if (tokens.length > 0) streams.push(tokens);
  }
  return streams;
}

function shingleMap(tokens: string[], width: number, name: string, into: Map<string, Set<string>>): void {
  for (let i = 0; i + width <= tokens.length; i++) {
    const key = tokens.slice(i, i + width).join(" ");
    const sources = into.get(key) ?? new Set<string>();
    sources.add(name);
    into.set(key, sources);
  }
}

/** Scan tokens for windows matching a shingle map, merging overlapping windows into maximal runs. */
function matchRuns(tokens: string[], width: number, lookup: (key: string) => Set<string> | undefined): SharedRun[] {
  const runs: SharedRun[] = [];
  let runStart = -1;
  let runEnd = -1; // exclusive token index
  let runSources = new Set<string>();

  const flush = () => {
    if (runStart >= 0) {
      runs.push({ text: tokens.slice(runStart, runEnd).join(" "), sources: [...runSources].sort() });
      runStart = -1;
      runSources = new Set<string>();
    }
  };

  for (let i = 0; i + width <= tokens.length; i++) {
    const sources = lookup(tokens.slice(i, i + width).join(" "));
    if (!sources) continue;
    if (runStart >= 0 && i <= runEnd) {
      // Overlaps or abuts the current run: extend it.
      runEnd = i + width;
    } else {
      flush();
      runStart = i;
      runEnd = i + width;
    }
    for (const s of sources) runSources.add(s);
  }
  flush();
  return runs;
}

/**
 * Compare a new document against prior ones. `shared`: maximal runs of 8+ words found
 * verbatim in any prior. `signatures`: runs of 4+ words recurring in two or more priors,
 * the pet phrases that fingerprint a batch even when no single sentence repeats.
 */
export function checkDistinct(newHtml: string, priors: PriorDoc[], opts: DistinctOptions): DistinctResult {
  const ignore = opts.ignoreSections ?? [];
  const maxShared = opts.maxShared ?? 0;
  const maxSignatures = opts.maxSignatures ?? 0;

  const priorShingles = new Map<string, Set<string>>();
  const priorSignatures = new Map<string, Set<string>>();
  for (const prior of priors) {
    for (const toks of proseStreams(prior.html, ignore)) {
      shingleMap(toks, SHINGLE_WORDS, prior.name, priorShingles);
      shingleMap(toks, SIGNATURE_WORDS, prior.name, priorSignatures);
    }
  }

  // Same normalisation as the documents, so a canon phrase matches its rendered form.
  const canonNorm = opts.canonText ? " " + normalizeTokens(opts.canonText).join(" ") + " " : null;
  const isCanonFact = (run: SharedRun) => canonNorm !== null && canonNorm.includes(` ${run.text} `);

  const shared: SharedRun[] = [];
  const signatures: SharedRun[] = [];
  for (const tokens of proseStreams(newHtml, ignore)) {
    shared.push(...matchRuns(tokens, SHINGLE_WORDS, (key) => priorShingles.get(key)));
    signatures.push(...matchRuns(tokens, SIGNATURE_WORDS, (key) => {
      const sources = priorSignatures.get(key);
      return sources && sources.size >= 2 ? sources : undefined;
    }).filter((run) => !isCanonFact(run)));
  }

  return { shared, signatures, ok: shared.length <= maxShared && signatures.length <= maxSignatures };
}
