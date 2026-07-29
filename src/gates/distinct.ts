// The distinct gate: the anti-template check. A cover note read once is voice;
// the same sentences read across two applications are a stamp. Two detectors:
// shared runs of SHINGLE_WORDS+ words against any single prior (verbatim reuse),
// and signature phrases of SIGNATURE_WORDS+ words recurring across two or more
// priors (the pet phrase that fingerprints a batch). The letterhead (<header>)
// and <head> are excluded by design, and factual sections that legitimately
// repeat (education, certifications) can be excluded by name.

import { readFileSync, realpathSync } from "node:fs";
import { loadCanon } from "../canon/load.js";
import { canonToText } from "./fit.js";
import { GateInputError, type Gate, type PackGate } from "./gate.js";
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

/**
 * The exemption corpus is every fact the canon states, including the identity and date
 * fields canonToText (a skills-matching corpus) leaves out.
 */
function canonExemptionText(canonPath: string): string {
  const canon = loadCanon(canonPath);
  if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
  const data = canon.data;
  return [
    canonToText(data),
    data.identity.name, data.identity.role,
    data.identity.location ?? "", data.identity.email ?? "", data.identity.phone ?? "",
    ...(data.identity.links ?? []).map(link => `${link.label} ${link.url}`),
    ...data.experience.flatMap(entry => [`${entry.title} ${entry.org} ${entry.location ?? ""} ${entry.start} ${entry.end}`]),
    ...data.education.map(entry => `${entry.qualification} ${entry.institution} ${entry.year} ${entry.result ?? ""}`),
    ...data.projects.flatMap(project => (project.links ?? []).map(link => `${link.label} ${link.url}`)),
  ].join("\n");
}

export const distinctnessGate: PackGate = {
  id: "distinctness",
  severity: "advisory",
  run: async input => {
    const canonText = canonToText(input.canon);
    const results = input.artifacts.map(artifact => checkDistinct(artifact.html, input.priors, {
      maxShared: input.thresholds.maximumSharedRuns,
      maxSignatures: input.thresholds.maximumSignaturePhrases,
      canonText,
    }));
    return {
      id: "distinctness",
      ok: results.every(result => result.ok),
      messages: results.flatMap((result, index) => [
        ...result.shared.map(run => `artifact ${input.artifacts[index].id}: shared collision with [${run.sources.join(", ")}]; eligible documents ${input.priors.length}; text ${JSON.stringify(run.text)}`),
        ...result.signatures.map(run => `artifact ${input.artifacts[index].id}: signature collision with [${run.sources.join(", ")}]; eligible documents ${input.priors.length}; text ${JSON.stringify(run.text)}`),
      ]),
    };
  },
  command: {
    name: "distinct",
    description: "fail when a document shares an 8+ word run of prose with prior applications (the anti-template gate)",
    arguments: [
      { name: "<html>", description: "path to the new authored HTML" },
      { name: "<priors...>", description: "paths to prior applications' HTML to compare against" },
    ],
    options: [
      { flags: "--max-shared <n>", description: "tolerated number of shared 8+ word runs", default: "0" },
      { flags: "--max-signatures <n>", description: "tolerated number of signature phrases (4+ words recurring in 2+ priors)", default: "0" },
      { flags: "--ignore-section <name>", description: "section heading to exclude (repeatable; factual sections legitimately repeat)", collect: true },
      { flags: "--canon <canon>", description: "canon.yaml; a signature phrase found verbatim in the canon is a fact, not a voice tic, and is exempt" },
    ],
    run: async (args, options) => {
      const html = args[0] as string;
      const priors = args[1] as string[];
      const maxShared = Number(options.maxShared);
      const maxSignatures = Number(options.maxSignatures);
      if (![maxShared, maxSignatures].every(value => Number.isFinite(value) && value >= 0)) throw new GateInputError("--max-shared and --max-signatures must be non-negative numbers");
      const canonText = options.canon ? canonExemptionText(options.canon as string) : undefined;
      let content: string;
      try { content = readFileSync(html, "utf8"); }
      catch (error) { throw new GateInputError(`cannot read ${html}: ${(error as Error).message}`); }
      // A "../*/cover.html"-style glob naturally includes the document under test;
      // comparing a file against itself would fail every fresh draft, so drop it.
      const selfPath = realpathSync(html);
      const priorDocs = priors
        .filter(path => { try { return realpathSync(path) !== selfPath; } catch { return true; } })
        .map(path => {
          try { return { name: path, html: readFileSync(path, "utf8") }; }
          catch (error) { throw new GateInputError(`cannot read ${path}: ${(error as Error).message}`); }
        });
      if (priorDocs.length < priors.length) console.log("  (skipping the document itself from the prior set)");
      const result = checkDistinct(content, priorDocs, { maxShared, maxSignatures, ignoreSections: options.ignoreSection as string[], canonText });
      return {
        id: "distinctness", ok: result.ok,
        messages: [
          ...result.shared.map(run => `  shared with ${run.sources.join(", ")}: "${run.text}"`),
          ...result.signatures.map(run => `  signature phrase (also in ${run.sources.join(", ")}): "${run.text}"`),
        ],
        summary: result.ok
          ? `distinct - ${html} shares ${result.shared.length} run(s), ${result.signatures.length} signature phrase(s) with ${priorDocs.length} prior document(s)`
          : `distinct: ${result.shared.length} shared run(s) and ${result.signatures.length} signature phrase(s) between ${html} and prior applications (max ${maxShared}/${maxSignatures}); rewrite them for this role, do not raise the ceiling`,
      };
    },
  },
};
