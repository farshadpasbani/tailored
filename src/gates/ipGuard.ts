import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { loadCanon } from "../canon/load.js";
import { inspectRenderedDocument, type RenderedDocumentEvidence } from "../render/chrome.js";
import { GateInputError, type Gate, type PackGate } from "./gate.js";
import { analyzeProhibitedClaims, hasVisibleNumericOccurrences, MetricClaimsFileSchema, type MetricClaim, type NumericExemption } from "./prohibitedClaims.js";
import { lineAt } from "./text.js";
export interface IpLeak { term: string; line: number; index: number; }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function scanProtected(text: string, terms: string[]): IpLeak[] {
  const leaks: IpLeak[] = [];
  for (const term of terms) {
    if (!term) continue;
    const re = new RegExp(esc(term), "gi");
    for (let m = re.exec(text); m; m = re.exec(text)) leaks.push({ term, index: m.index, line: lineAt(text, m.index) });
  }
  return leaks.sort((a, b) => a.index - b.index);
}

export const protectedTopicsGate: PackGate = {
  id: "protected-topics",
  severity: "blocking",
  run: async input => {
    const leaks = input.artifacts.flatMap(artifact => scanProtected(artifact.html, input.canon.protectedTopics));
    return { id: "protected-topics", ok: leaks.length === 0, messages: leaks.map(leak => `protected topic ${leak.term}`) };
  },
  command: null,
};

/**
 * Terminal-only composite. One document put to both confidentiality gates at once:
 * `protected-topics` and `prohibited-claims` decide a pack receipt separately, but a person
 * checking one file wants a single verdict over both.
 */
export const ipGuardGate: Gate = {
  id: "ip-guard",
  severity: "blocking",
  run: null,
  command: {
    name: "ip-guard",
    description: "scan a file for a canon's protected topics",
    arguments: [{ name: "<file>", description: "file to scan" }],
    options: [
      { flags: "--canon <canon>", description: "path to canon.yaml supplying protectedTopics", required: true },
      { flags: "--metric-claims <path>", description: "persisted structured metric claims for numeric document claims" },
    ],
    run: async (args, options) => {
      const file = args[0] as string;
      const canon = loadCanon(options.canon as string);
      if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
      let content: string;
      try { content = readFileSync(file, "utf8"); }
      catch (error) { throw new GateInputError(`cannot read ${file}: ${(error as Error).message}`); }
      const metricClaimsPath = options.metricClaims as string | undefined;
      if (hasVisibleNumericOccurrences(content) && !metricClaimsPath) {
        throw new GateInputError("document contains visible numeric occurrence(s); --metric-claims is required");
      }
      let metricClaims: MetricClaim[] | undefined;
      let numericExemptions: NumericExemption[] | undefined;
      if (metricClaimsPath) {
        let raw: unknown;
        try { raw = yaml.load(readFileSync(metricClaimsPath, "utf8")); }
        catch (error) { throw new GateInputError(`could not read/parse metric claims YAML at ${metricClaimsPath}: ${(error as Error).message}`); }
        const parsed = MetricClaimsFileSchema.safeParse(raw);
        if (!parsed.success) {
          throw new GateInputError(`invalid metric claims\n  ${parsed.error.issues.map(issue => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n  ")}`);
        }
        metricClaims = parsed.data.claims;
        numericExemptions = parsed.data.exemptions;
      }
      const leaks = scanProtected(content, canon.data.protectedTopics);
      const messages = leaks.map(leak => `${file}:${leak.line}: leaked protected topic "${leak.term}"`);
      let renderedDocument: RenderedDocumentEvidence | undefined;
      if (numericExemptions?.some(exemption => exemption.sourcePaths !== undefined)) {
        try { renderedDocument = await inspectRenderedDocument(file); }
        catch (error) { throw new GateInputError(`could not verify rendered canon markers: ${(error as Error).message}`, messages); }
      }
      const prohibited = analyzeProhibitedClaims({ text: content, canon: canon.data, metricClaims, numericExemptions, renderedDocument });
      for (const issue of prohibited.issues) {
        messages.push(`${file}: forbidden claim ${issue.concept ?? issue.kind} (${issue.sourcePath ?? issue.path}): ${issue.message}`);
      }
      const ok = leaks.length === 0 && prohibited.ok;
      return {
        id: "ip-guard", ok, messages,
        summary: ok
          ? `${file} leaks none of ${canon.data.protectedTopics.length} protected topic(s) and asserts no forbidden claims`
          : `${leaks.length} protected-topic leak(s) and ${prohibited.issues.length} forbidden claim(s) in ${file}`,
      };
    },
  },
};
