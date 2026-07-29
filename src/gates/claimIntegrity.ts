import { createHash } from "node:crypto";
import { constants, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { Canon, StructuredMetricV2Schema } from "../canon/schema.js";
import type { z } from "zod";
import type { ClaimEvidence, EvidenceFile } from "../evidence/schema.js";
import { containsWholePhrase, isCandidateClaim } from "../evidence/authority.js";
import { extractSourceClaimMarkers, parseDeclarativeHtml, type SourceClaimMarker } from "../evidence/html.js";
import { verifyArtifactResources } from "../evidence/resources.js";
import { inspectAndPrintDocument, type RenderedClaimMarker, type RenderedDocumentEvidence } from "../render/chrome.js";
import { loadCanon } from "../canon/load.js";
import { loadEvidenceFile } from "../evidence/schema.js";
import { aggregateUpstream, GateInputError, type PackGate } from "./gate.js";
import { extractPdfText } from "./run.js";
import { tokenizeNumericOccurrences } from "./numeric.js";
import { htmlToText, lineAt } from "./text.js";

type StructuredMetric = z.infer<typeof StructuredMetricV2Schema>;

export type ClaimIntegrityIssueKind =
  | "empty-document" | "empty-claim-marker" | "unknown-claim-marker" | "duplicate-claim-marker"
  | "missing-claim-marker" | "stale-claim-text" | "hidden-claim-marker" | "rendered-claim-mismatch"
  | "rendered-evidence-required" | "unannotated-content" | "ambiguous-text-ownership"
  | "rendered-evidence-incomplete" | "generated-content" | "invalid-structural-content"
  | "executable-html" | "print-claim-mismatch" | "print-unannotated-content"
  | "active-html"
  | "claim-contract-mismatch" | "candidate-claim-employer-evidence" | "employer-attribution-required"
  | "unknown-candidate-evidence" | "unknown-employer-evidence" | "candidate-evidence-not-allowed"
  | "unbound-structured-number" | "metric-mismatch" | "incomplete-metric"
  | "artifact-path-mismatch" | "artifact-hash-mismatch" | "claim-text-hash-mismatch" | "claim-binding-hash-mismatch" | "source-hash-mismatch";


export interface ClaimIntegrityIssue { kind: ClaimIntegrityIssueKind; artifact: string; line: number; message: string; claimId?: string; }
export interface ClaimIntegrityResult { ok: boolean; issues: ClaimIntegrityIssue[]; }
export interface ClaimIntegrityInput {
  html: string;
  artifact: string;
  evidence: EvidenceFile;
  canon: Canon;
  renderedDocument?: RenderedDocumentEvidence;
  /** Exact archived bytes keyed by employer source ID. The public verifier fills this from archivePath. */
  archivedSources?: Record<string, string>;
  /** Resolved input path, supplied by the public verifier to enforce artifact.path. */
  artifactPath?: string;
  evidenceDirectory?: string;
}
export interface VerifyClaimIntegrityInput extends Omit<ClaimIntegrityInput, "html" | "renderedDocument" | "archivedSources"> {
  htmlPath: string;
  /** Identity path declared by evidence when htmlPath is an immutable staged copy. */
  declaredArtifactPath?: string;
  evidencePath: string;
  /** Optional destination for the exact PDF inspected by the final verifier. Created only when the verdict passes. */
  outputPdfPath?: string;
}

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const canonicalJson = (value: unknown): string => JSON.stringify(value, (_key, nested) => {
  if (!nested || Array.isArray(nested) || typeof nested !== "object") return nested;
  return Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)));
});
export function computeClaimBindingHash(record: ClaimEvidence, evidence: EvidenceFile, canon: Canon): string {
  const artifact = evidence.artifacts.find(entry => entry.id === record.artifact);
  const facts = new Map(canon.facts.map(fact => [fact.id, fact]));
  const employers = new Map(evidence.employerSources.map(source => [source.id, source]));
  const sources = record.evidenceIds.map(id => record.namespace === "candidate"
    ? { namespace: "candidate", fact: facts.get(id) ?? null }
    : { namespace: "employer", source: employers.get(id) ?? null });
  const { bindingSha256: _bindingSha256, ...claim } = record;
  return sha256(canonicalJson({ artifact, claim, sources }));
}
const normalized = (text: string | undefined): string => (text ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const normalizedPrint = (text: string | undefined): string => normalized(text).replace(/-\s*/g, "");
function metricDifference(claim: StructuredMetric, source: StructuredMetric): string | undefined {
  for (const field of ["value", "subject", "unit", "denominator", "scale", "timeframe"] as const) {
    const left = claim[field], right = source[field];
    if (left === undefined || right === undefined || (field === "value" ? left !== right : normalized(String(left)) !== normalized(String(right)))) return field;
  }
}
function issue(issues: ClaimIntegrityIssue[], input: ClaimIntegrityInput, kind: ClaimIntegrityIssueKind, index: number, message: string, claimId?: string): void {
  issues.push({ kind, artifact: input.artifact, line: lineAt(input.html, Math.max(0, index)), message, ...(claimId ? { claimId } : {}) });
}
function checkReferences(record: ClaimEvidence, marker: SourceClaimMarker, input: ClaimIntegrityInput, issues: ClaimIntegrityIssue[]): StructuredMetric[] {
  const facts = new Map(input.canon.facts.map(fact => [fact.id, fact]));
  const employers = new Map(input.evidence.employerSources.map(source => [source.id, source]));
  const metrics: StructuredMetric[] = [];
  if (record.namespace === "candidate") {
    for (const id of record.evidenceIds) {
      const fact = facts.get(id);
      if (!fact) { issue(issues, input, "unknown-candidate-evidence", marker.start, `unknown candidate fact ${JSON.stringify(id)}`, record.id); continue; }
      if (!fact.allowedUses.includes(input.artifact) || !["verified", "candidate-attested"].includes(fact.status)) issue(issues, input, "candidate-evidence-not-allowed", marker.start, `candidate fact ${JSON.stringify(id)} is not allowed for ${JSON.stringify(input.artifact)}`, record.id);
      metrics.push(...(fact.metrics ?? []));
    }
  } else {
    if (isCandidateClaim(record.text, input.canon.identity.name)) issue(issues, input, "candidate-claim-employer-evidence", marker.start, `candidate claim ${JSON.stringify(record.id)} cannot be licensed by employer evidence`, record.id);
    for (const id of record.evidenceIds) {
      const source = employers.get(id);
      if (!source) { issue(issues, input, "unknown-employer-evidence", marker.start, `unknown employer source ${JSON.stringify(id)}`, record.id); continue; }
      if (!containsWholePhrase(record.text, source.subject)) issue(issues, input, "employer-attribution-required", marker.start, `employer-authority claim ${JSON.stringify(record.id)} must explicitly name ${JSON.stringify(source.subject)}`, record.id);
      const archived = input.archivedSources?.[id];
      if (archived === undefined || sha256(archived) !== source.archiveSha256 || sha256(source.text) !== source.textSha256 || !normalized(archived).includes(normalized(source.text))) issue(issues, input, "source-hash-mismatch", marker.start, `employer source ${JSON.stringify(id)} is missing, replaced, or stale against ${JSON.stringify(source.archivePath)}`, record.id);
      metrics.push(...(source.metrics ?? []));
    }
  }
  return metrics;
}
function checkMetrics(record: ClaimEvidence, sourceMetrics: StructuredMetric[], marker: SourceClaimMarker, input: ClaimIntegrityInput, issues: ClaimIntegrityIssue[]): void {
  const occurrences = tokenizeNumericOccurrences(record.text).filter(entry => entry.kind === "number" && entry.value !== undefined);
  const claimMetrics = record.metrics ?? [];
  for (const metric of [...claimMetrics, ...sourceMetrics]) for (const field of ["subject", "unit", "denominator", "scale", "timeframe"] as const) if (!metric[field]) issue(issues, input, "incomplete-metric", marker.start, `metric ${field} must be explicit or ${JSON.stringify("not-applicable")}`, record.id);
  const values = new Set([...occurrences.map(entry => entry.value!), ...claimMetrics.map(metric => metric.value)]);
  for (const value of values) if (occurrences.filter(entry => entry.value === value).length !== claimMetrics.filter(metric => metric.value === value).length) issue(issues, input, "unbound-structured-number", marker.start, `numeric value ${value} requires exactly one complete metric per rendered occurrence`, record.id);
  for (const metric of claimMetrics) {
    const candidates = sourceMetrics.filter(source => source.value === metric.value);
    const differing = candidates.length ? metricDifference(metric, candidates[0]) : "value";
    if (!candidates.some(source => metricDifference(metric, source) === undefined)) issue(issues, input, "metric-mismatch", marker.start, `metric ${differing} in claim ${JSON.stringify(record.id)} does not match complete source identity`, record.id);
  }
  for (const occurrence of occurrences) {
    const matching = claimMetrics.filter(metric => metric.value === occurrence.value);
    if (matching.length !== 1) continue;
    const raw = occurrence.raw.replace(/\s+/g, "").toLowerCase();
    const unit = normalized(matching[0].unit);
    const surface = raw.startsWith("£") ? "gbp" : raw.startsWith("$") ? "usd" : raw.startsWith("€") ? "eur"
      : raw.endsWith("%") ? "percent" : raw.match(/[a-z]+$/)?.[0] ?? "count";
    const compatible = new Map<string, string[]>([
      ["gbp", ["gbp", "pound", "pounds", "sterling"]], ["usd", ["usd", "dollar", "dollars"]],
      ["eur", ["eur", "euro", "euros"]], ["percent", ["percent", "percentage", "%"]],
      ["ms", ["ms", "millisecond", "milliseconds"]], ["count", ["count", "number", "items", "not-applicable"]],
    ]);
    const following = normalized(record.text.slice(occurrence.index + occurrence.raw.length, occurrence.index + occurrence.raw.length + 64));
    const unitWords = unit.split(/\s+/).map(word => word.replace(/s$/, ""));
    const contextNamesUnit = surface === "count" && (following.includes(unit)
      || unitWords.every(word => new RegExp(`\\b${word}s?\\b`, "i").test(following)));
    if (!(compatible.get(surface) ?? [surface]).includes(unit) && !contextNamesUnit) issue(issues, input, "metric-mismatch", marker.start, `rendered numeric surface ${JSON.stringify(occurrence.raw)} does not match declared unit ${JSON.stringify(matching[0].unit)}`, record.id);
  }
}

/** Fast source-only diagnostics. This is a preflight, never the final integrity verdict. */
export function analyzeClaimIntegrityPreflight(input: ClaimIntegrityInput): ClaimIntegrityResult {
  const issues: ClaimIntegrityIssue[] = [];
  const declarative = parseDeclarativeHtml(input.html);
  if (!declarative.ok) for (const error of declarative.errors) issue(issues, input, "active-html", 0, error);
  if (/<script\b/i.test(input.html)) issue(issues, input, "executable-html", input.html.search(/<script\b/i), "authored CV/cover HTML must be declarative; executable <script> content is rejected before rendering");
  if (!htmlToText(input.html)) issue(issues, input, "empty-document", 0, `artifact ${JSON.stringify(input.artifact)} has no source-visible content`);
  const artifact = input.evidence.artifacts.find(entry => entry.id === input.artifact);
  if (input.artifactPath && artifact && resolve(input.artifactPath) !== resolve(input.evidenceDirectory ?? ".", artifact.path)) issue(issues, input, "artifact-path-mismatch", 0, `artifact ${JSON.stringify(input.artifact)} was verified from a path other than its archived path`);
  if (!artifact || sha256(input.html) !== artifact.sha256) issue(issues, input, "artifact-hash-mismatch", 0, `artifact ${JSON.stringify(input.artifact)} is missing or stale against its archived path/hash`);
  const markers = extractSourceClaimMarkers(input.html);
  const records = new Map(input.evidence.claims.filter(claim => claim.artifact === input.artifact).map(claim => [claim.id, claim]));
  const counts = new Map<string, number>();
  for (const marker of markers) {
    const id = marker.id; counts.set(id, (counts.get(id) ?? 0) + 1);
    const text = marker.text;
    if (!id || !text) { issue(issues, input, "empty-claim-marker", marker.start, "claim marker requires non-empty ID and text", id || undefined); continue; }
    const record = records.get(id);
    if (!record) { issue(issues, input, "unknown-claim-marker", marker.start, `marker ${JSON.stringify(id)} has no evidence record`, id); continue; }
    // Exact claim text is a computed-style fact (block/flex/grid/list-item alter
    // innerText whitespace). The immutable print DOM below is authoritative.
    if (sha256(record.text) !== record.textSha256) issue(issues, input, "claim-text-hash-mismatch", marker.start, `claim ${JSON.stringify(id)} text hash is stale`, id);
    if (computeClaimBindingHash(record, input.evidence, input.canon) !== record.bindingSha256) issue(issues, input, "claim-binding-hash-mismatch", marker.start, `claim ${JSON.stringify(id)} combined artifact/text/source binding is stale`, id);
    if (record.artifactSha256 !== artifact?.sha256) issue(issues, input, "artifact-hash-mismatch", marker.start, `claim ${JSON.stringify(id)} is bound to a different artifact revision`, id);
    if (marker.subject !== record.subject || marker.authority !== record.namespace) issue(issues, input, "claim-contract-mismatch", marker.start, `HTML subject/authority must exactly match evidence for ${JSON.stringify(id)}`, id);
    const sourceMetrics = checkReferences(record, marker, input, issues); checkMetrics(record, sourceMetrics, marker, input, issues);
  }
  for (const [id, count] of counts) if (id && count !== 1) issue(issues, input, "duplicate-claim-marker", markers.find(marker => marker.id === id)?.start ?? 0, `claim marker ${JSON.stringify(id)} appears ${count} times`, id);
  for (const record of records.values()) if (!counts.has(record.id)) issue(issues, input, "missing-claim-marker", 0, `evidence record ${JSON.stringify(record.id)} has no marker`, record.id);
  return { ok: issues.length === 0, issues };
}

/** Final verifier. Unlike the preflight, this cannot pass without browser evidence. */
export function analyzeClaimIntegrity(input: ClaimIntegrityInput): ClaimIntegrityResult {
  const preflight = analyzeClaimIntegrityPreflight(input), issues = [...preflight.issues];
  if (!input.renderedDocument) { issue(issues, input, "rendered-evidence-required", 0, "final claim integrity requires Chrome-rendered evidence"); return { ok: false, issues }; }
  const markers = extractSourceClaimMarkers(input.html);
  const records = new Map(input.evidence.claims.filter(claim => claim.artifact === input.artifact).map(claim => [claim.id, claim]));
  if (!Array.isArray(input.renderedDocument.claims) || !Array.isArray(input.renderedDocument.textUnits) || !Array.isArray(input.renderedDocument.generatedContent) || typeof input.renderedDocument.printText !== "string") {
    issue(issues, input, "rendered-evidence-incomplete", 0, "final Chrome evidence requires claims, textUnits, generatedContent, and actual PDF printText");
    return { ok: false, issues };
  }
  const renderedById = new Map<string, RenderedClaimMarker[]>();
  for (const rendered of input.renderedDocument.claims) renderedById.set(rendered.id, [...(renderedById.get(rendered.id) ?? []), rendered]);
  for (const marker of markers) {
    const id = marker.id, rendered = renderedById.get(id) ?? [], record = records.get(id);
    if (rendered.length !== 1) issue(issues, input, "rendered-claim-mismatch", marker.start, `claim ${JSON.stringify(id)} rendered ${rendered.length} times; expected one`, id || undefined);
    else {
      if (!rendered[0].visible) issue(issues, input, "hidden-claim-marker", marker.start, `claim ${JSON.stringify(id)} is hidden`, id);
      if (record && (rendered[0].text !== record.text || rendered[0].subject !== record.subject || rendered[0].authority !== record.namespace)) issue(issues, input, "rendered-claim-mismatch", marker.start, `browser text/subject/authority differs from evidence for ${JSON.stringify(id)}`, id);
    }
  }
  const sourceIds = new Set(markers.map(marker => marker.id).filter(Boolean));
  const evidenceIds = new Set(records.keys());
  const renderedIds = new Set(input.renderedDocument.claims.map(claim => claim.id));
  const textUnitIds = new Set(input.renderedDocument.textUnits.flatMap(unit => unit.claimIds));
  for (const [label, ids] of [["rendered claims", renderedIds], ["rendered text units", textUnitIds], ["evidence records", evidenceIds]] as const) {
    for (const id of ids) if (!sourceIds.has(id)) issue(issues, input, "rendered-claim-mismatch", 0, `${label} contain unknown claim ID ${JSON.stringify(id)}`, id);
    for (const id of sourceIds) if (!ids.has(id)) issue(issues, input, "rendered-claim-mismatch", 0, `${label} are missing claim ID ${JSON.stringify(id)}`, id);
  }
  const allowedStructuralReasons = new Set(["decorative-separator"]);
  const structuralText = /^(?:[|\u00b7•‧∙⋅●▪◦‐-―:;,/\\]+)$/u;
  for (const unit of input.renderedDocument.textUnits) {
    if (!unit.visible) continue;
    const owners = unit.claimIds.length + unit.structuralReasons.length;
    if (owners === 0) issue(issues, input, "unannotated-content", 0, `visible rendered residue at ${unit.path}: ${JSON.stringify(unit.text)}`);
    if (owners > 1 || unit.claimIds.some(id => !id) || unit.structuralReasons.some(reason => !reason.trim())) issue(issues, input, "ambiguous-text-ownership", 0, `rendered text at ${unit.path} must have exactly one claim or reasoned nonfactual owner`);
    for (const reason of unit.structuralReasons) if (!allowedStructuralReasons.has(reason) || unit.tag !== "span" || !structuralText.test(unit.text.trim()) || tokenizeNumericOccurrences(unit.text).some(entry => entry.kind === "number")) {
      issue(issues, input, "invalid-structural-content", 0, `rendered text at ${unit.path} is not an allowed decorative separator`);
    }
  }
  for (const generated of input.renderedDocument.generatedContent) if (generated.visible && generated.text.trim()) issue(issues, input, "generated-content", 0, `visible CSS-generated content at ${generated.path}${generated.pseudo} must be authored and claim-owned`);
  let unownedPrint = normalizedPrint(input.renderedDocument.printText);
  for (const record of records.values()) {
    const expected = normalizedPrint(record.text);
    const at = unownedPrint.indexOf(expected);
    if (at < 0) issue(issues, input, "print-claim-mismatch", 0, `claim ${JSON.stringify(record.id)} is missing from the actual PDF text layer`, record.id);
    else unownedPrint = `${unownedPrint.slice(0, at)} ${unownedPrint.slice(at + expected.length)}`;
  }
  const printResidue = unownedPrint.replace(/[\s|\u00b7•‧∙⋅●▪◦‐-―:;,/\\()[\]{}]+/gu, "");
  if (printResidue) issue(issues, input, "print-unannotated-content", 0, `actual PDF contains unowned text: ${JSON.stringify(unownedPrint.trim())}`);
  return { ok: issues.length === 0, issues };
}

/** Public high-level entrypoint: archive bytes are re-read and Chrome is always invoked. */
export async function verifyClaimIntegrity(input: VerifyClaimIntegrityInput): Promise<ClaimIntegrityResult> {
  return verifyClaimIntegrityInternal(input, {
    writeSnapshot: (path, value, encoding) => writeFileSync(path, value, encoding),
    inspectAndPrint: inspectAndPrintDocument,
    extractPrintText: extractPdfText,
  });
}

interface VerificationAdapters {
  writeSnapshot(path: string, value: string | Buffer, encoding?: "utf8"): void;
  inspectAndPrint: typeof inspectAndPrintDocument;
  extractPrintText: typeof extractPdfText;
}

/** Internal fault boundary. Adapters are deliberately absent from the public input type. */
async function verifyClaimIntegrityInternal(input: VerifyClaimIntegrityInput, adapters: VerificationAdapters): Promise<ClaimIntegrityResult> {
  const html = readFileSync(input.htmlPath, "utf8"), base = dirname(resolve(input.evidencePath));
  const archivedSources = Object.fromEntries(input.evidence.employerSources.map(source => [source.id, readFileSync(resolve(base, source.archivePath), "utf8")]));
  const identityPath = resolve(input.declaredArtifactPath ?? input.htmlPath);
  const common = { ...input, html, archivedSources, artifactPath: identityPath, evidenceDirectory: base };
  const preflight = analyzeClaimIntegrityPreflight(common);
  if (preflight.issues.some(problem => problem.kind === "active-html" || problem.kind === "executable-html" || problem.kind === "empty-document")) return preflight;
  const declarative = parseDeclarativeHtml(html);
  if (!declarative.ok) return preflight;
  const artifact = input.evidence.artifacts.find(entry => entry.id === input.artifact);
  if (!artifact) return preflight;
  let resources;
  try { resources = verifyArtifactResources(html, identityPath, base, artifact); }
  catch (error) {
    return { ok: false, issues: [...preflight.issues, { kind: "artifact-hash-mismatch", artifact: input.artifact, line: 1, message: `resource integrity failed: ${(error as Error).message}` }] };
  }
  const temporary = mkdtempSync(join(tmpdir(), "tailored-claim-print-"));
  try {
    const snapshotRoot = join(temporary, "snapshot");
    const originalRoot = resolve(base, artifact.resourceRoot);
    const snapshotHtml = join(snapshotRoot, relative(originalRoot, identityPath));
    mkdirSync(dirname(snapshotHtml), { recursive: true });
    for (const resource of resources) {
      const destination = join(snapshotRoot, resource.path);
      mkdirSync(dirname(destination), { recursive: true });
      adapters.writeSnapshot(destination, resource.bytes);
    }
    adapters.writeSnapshot(snapshotHtml, declarative.snapshotHtml, "utf8");
    const pdf = join(temporary, "artifact.pdf");
    const renderedDocument = await adapters.inspectAndPrint(snapshotHtml, pdf);
    const printText = await adapters.extractPrintText(pdf);
    renderedDocument.printText = printText;
    const result = analyzeClaimIntegrity({ ...common, renderedDocument });
    if (result.ok && input.outputPdfPath) copyFileSync(pdf, input.outputPdfPath, constants.COPYFILE_EXCL);
    return result;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export const claimIntegrityGate: PackGate = {
  id: "claim-integrity",
  severity: "blocking",
  // The pack lane verifies claims inside the staging transaction, against the staged PDF that
  // only exists there; this gate folds those per-artifact findings into the receipt's one entry.
  run: async input => aggregateUpstream("claim-integrity", input.upstream),
  command: {
    name: "claim-integrity",
    description: "verify claim-marker coverage, exact evidence bindings, namespace separation, and structured metrics; does not prove arbitrary semantic truth",
    arguments: [{ name: "<html>", description: "path to authored CV or cover HTML" }],
    options: [
      { flags: "--artifact <id>", description: "artifact ID recorded in evidence.yaml, such as cv or cover", required: true },
      { flags: "--canon <canon>", description: "path to strict or migratable canon.yaml", required: true },
      { flags: "--evidence <evidence>", description: "path to strict evidence.yaml", required: true },
    ],
    run: async (args, options) => {
      const html = args[0] as string;
      const artifact = options.artifact as string;
      const canon = loadCanon(options.canon as string);
      if (!canon.ok) throw new GateInputError(`invalid canon\n  ${canon.errors.join("\n  ")}`);
      const evidence = loadEvidenceFile(options.evidence as string);
      if (!evidence.ok) throw new GateInputError(`invalid evidence\n  ${evidence.errors.join("\n  ")}`);
      let result: ClaimIntegrityResult;
      try { result = await verifyClaimIntegrity({ htmlPath: html, evidencePath: options.evidence as string, artifact, evidence: evidence.data, canon: canon.data }); }
      catch (error) { throw new GateInputError(`cannot establish rendered claim integrity for ${html}: ${(error as Error).message}`); }
      return {
        id: "claim-integrity", ok: result.ok,
        messages: result.issues.map(issue => `  ${issue.artifact}:line ${issue.line} [${issue.kind}]${issue.claimId ? ` ${issue.claimId}:` : ""} ${issue.message}`),
        summary: result.ok
          ? `claim structural and evidence integrity passed for ${artifact}; this does not prove arbitrary semantic truth or editorial quality`
          : `claim-integrity: ${result.issues.length} blocking issue(s) in artifact ${JSON.stringify(artifact)}`,
      };
    },
  },
};
