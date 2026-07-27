import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import yaml from "js-yaml";
import { parseCanon } from "../canon/load.js";
import { parseEvidenceFile, type EvidenceFile } from "../evidence/schema.js";
import { lintAiTells } from "../gates/aiTell.js";
import { analyzeRequirementAts } from "../gates/ats.js";
import { analyzeRequirementFit, canonToText } from "../gates/fit.js";
import { analyzeImpact, defaultImpactOptions } from "../gates/impact.js";
import { checkDistinct } from "../gates/distinct.js";
import { analyzeEditorial } from "../gates/editorial.js";
import { scanProtected } from "../gates/ipGuard.js";
import { analyzeProhibitedClaims } from "../gates/prohibitedClaims.js";
import { extractPdfText } from "../gates/run.js";
import { pageCount } from "../gates/pageFit.js";
import { verifyClaimIntegrity } from "../gates/claimIntegrity.js";
import { BaselineReceiptSchema, parseRequirements, type VerifiedRequirements } from "../requirements/schema.js";
import { canonicalJson, sha256Bytes, sha256File } from "./hash.js";
import { VerifyReceiptSchema, type PackFinding, type VerifyReceipt } from "./receipt.js";
import { AttestationSchema, snapshotFinalCorpus, WaiverSchema, type Attestation, type CorpusDescriptor, type FinalCorpusMember, type Waiver } from "./trust.js";
import { VerifyPolicySchema, type VerifyPolicy } from "../policy/verify.js";
import type { Canon } from "../canon/schema.js";
import { deriveEngineIdentity } from "./engine.js";
import { analyzeStrategy, StrategySchema, type Strategy } from "../strategy/schema.js";

declare const issuedReceiptBrand: unique symbol;
export type IssuedVerifyReceipt = VerifyReceipt & { readonly [issuedReceiptBrand]: true };
const issuedReceipts = new WeakSet<object>();

export function assertVerifierIssuedReceipt(receipt: VerifyReceipt): asserts receipt is IssuedVerifyReceipt {
  if (!issuedReceipts.has(receipt)) throw new Error("receipt bytes are fresh but were not issued by this verifier runtime; digest is integrity, not provenance");
}

const Path = z.string().min(1);
export const PackDescriptorSchema = z.object({
  schemaVersion: z.literal(1),
  inputs: z.object({ canon: Path, jd: Path, requirements: Path, baselineReceipt: Path, evidence: Path, strategy: Path, research: Path, preferences: Path, policy: Path }).strict(),
  artifacts: z.array(z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/), html: Path, pdf: z.string().regex(/^[^/\\]+\.pdf$/i, "PDF must be a distinct .pdf filename"), maxPages: z.number().int().positive() }).strict()).min(2),
  corpus: z.object({ descriptor: Path }).strict(),
  waivers: z.array(Path).default([]), attestations: z.array(Path).default([]),
}).strict().superRefine((value, context) => {
  const ids = value.artifacts.map(artifact => artifact.id);
  for (const required of ["cv", "cover"]) if (!ids.includes(required)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts"], message: `Complete packs require artifact ${JSON.stringify(required)}` });
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts"], message: "Artifact IDs must be unique" });
  const pdfs = value.artifacts.map(artifact => artifact.pdf);
  if (new Set(pdfs).size !== pdfs.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts"], message: "PDF filenames must be unique" });
  const outputNames = ["receipt.json", ...value.artifacts.flatMap(artifact => [`${artifact.id}.html`, artifact.pdf])];
  const portableNames = outputNames.map(name => name.normalize("NFC").toLocaleLowerCase("en-US"));
  if (new Set(portableNames).size !== portableNames.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts"], message: "Derived HTML, PDF, and reserved receipt output paths must be globally unique" });
});
export type PackDescriptor = z.infer<typeof PackDescriptorSchema>;

export interface CheckContext { artifact: PackDescriptor["artifacts"][number]; descriptor: PackDescriptor; descriptorDirectory: string; stagedHtml: string; stagedPdf: string; pdfText: string; }
export interface VerifyRenderContext extends Omit<CheckContext, "pdfText"> { sourceHtml: string; declaredArtifactPath: string; }
/**
 * The only replaceable surface of the transaction: render/inspect, PDF text, and page
 * count. Filesystem, hashing, snapshot capture, the gate registry, and the staging
 * transaction always run for real, so a receipt from an override still proves everything
 * except the three adapters, and says so through `dependencies: "injected"`.
 */
export interface PackDependencies {
  verifyAndRender: (context: VerifyRenderContext) => Promise<PackFinding[]>;
  extractText: (pdf: string) => Promise<string>;
  pageCount: (pdf: string) => Promise<number>;
}

function readDescriptor(path: string): { descriptor: PackDescriptor; sha256: string } {
  let bytes: Buffer;
  let raw: unknown;
  try { bytes = readFileSync(path); raw = yaml.load(bytes.toString("utf8")); } catch (error) { throw new Error(`could not read pack descriptor: ${(error as Error).message}`); }
  const parsed = PackDescriptorSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid pack descriptor: ${parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return { descriptor: parsed.data, sha256: sha256Bytes(bytes) };
}
function absolute(base: string, path: string): string { return isAbsolute(path) ? path : resolve(base, path); }
function bind(id: string, path: string) { return { id, sha256: sha256File(path) }; }
function resolved(descriptor: PackDescriptor, base: string): PackDescriptor {
  return {
    ...descriptor,
    inputs: Object.fromEntries(Object.entries(descriptor.inputs).map(([key, path]) => [key, absolute(base, path)])) as PackDescriptor["inputs"],
    artifacts: descriptor.artifacts.map(artifact => ({ ...artifact, html: absolute(base, artifact.html) })),
    corpus: { descriptor: absolute(base, descriptor.corpus.descriptor) },
    waivers: descriptor.waivers.map(path => absolute(base, path)), attestations: descriptor.attestations.map(path => absolute(base, path)),
  };
}

const ResearchSchema = z.object({ schemaVersion: z.literal(1), sources: z.array(z.object({ id: z.string().min(1), url: z.string().url(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1) }).strict();
const PreferencesSchema = z.object({ schemaVersion: z.literal(1), locale: z.string().min(1), tone: z.string().min(1) }).strict();

interface ProductionTrust {
  canon: Canon;
  evidence: EvidenceFile;
  requirements: VerifiedRequirements;
  policy: VerifyPolicy;
  corpus: CorpusDescriptor;
  corpusDocs: Array<{ name: string; html: string }>;
  waivers: Waiver[];
  attestations: Attestation[];
  strategy: Strategy;
  packSha256: string;
  policySha256: string;
}

interface SourceSnapshot { bindings: ReturnType<typeof sourceBindingsFromBytes>; bytes: Map<string, Buffer>; corpus: CorpusDescriptor; corpusMembers: FinalCorpusMember[]; }
function sourceBindingsFromBytes(descriptor: PackDescriptor, descriptorSha256: string, bytes: Map<string, Buffer>, corpusMembers: FinalCorpusMember[]) {
  const digest = (id: string, path: string) => ({ id, sha256: sha256Bytes(bytes.get(path) ?? (() => { throw new Error(`missing source snapshot ${path}`); })()) });
  const base = {
    descriptor: { id: "pack-descriptor", sha256: descriptorSha256 },
    inputs: Object.fromEntries(Object.entries(descriptor.inputs).map(([id, path]) => [id, digest(id, path)])),
    artifacts: descriptor.artifacts.map(artifact => digest(artifact.id, artifact.html)),
    corpusDescriptor: digest("corpus-descriptor", descriptor.corpus.descriptor),
    corpusMembers: corpusMembers.map(member => digest(member.id, member.path)),
    waivers: descriptor.waivers.map((path, index) => digest(`waiver-${index}`, path)),
    attestations: descriptor.attestations.map((path, index) => digest(`attestation-${index}`, path)),
  };
  const packSha256 = sha256Bytes(canonicalJson({ inputs: base.inputs, artifacts: base.artifacts, corpusDescriptor: base.corpusDescriptor, corpusMembers: base.corpusMembers }));
  return { ...base, packSha256 };
}
function captureSourceSnapshot(descriptor: PackDescriptor, descriptorSha256: string, descriptorDirectory: string): SourceSnapshot {
  const bytes = new Map<string, Buffer>();
  const capture = (path: string) => { if (!bytes.has(path)) bytes.set(path, readFileSync(path)); };
  Object.values(descriptor.inputs).forEach(capture);
  descriptor.artifacts.forEach(artifact => capture(artifact.html));
  descriptor.waivers.forEach(capture); descriptor.attestations.forEach(capture);
  const captured = snapshotFinalCorpus(descriptorDirectory, descriptor.corpus.descriptor, descriptor.artifacts.map(artifact => artifact.html));
  bytes.set(descriptor.corpus.descriptor, captured.descriptorBytes);
  for (const member of captured.members) bytes.set(member.path, member.bytes);
  const { descriptor: corpus, members: corpusMembers } = captured;
  return { bindings: sourceBindingsFromBytes(descriptor, descriptorSha256, bytes, corpusMembers), bytes, corpus, corpusMembers };
}
function parseSnapshotYaml(snapshot: SourceSnapshot, path: string): unknown { return yaml.load(snapshot.bytes.get(path)?.toString("utf8") ?? ""); }
function selfDigestValid(value: { sha256: string } & Record<string, unknown>): boolean {
  const { sha256, ...payload } = value;
  return sha256 === sha256Bytes(canonicalJson(payload));
}
function prepareProductionTrust(descriptor: PackDescriptor, snapshot: SourceSnapshot): ProductionTrust {
  const canon = parseCanon(parseSnapshotYaml(snapshot, descriptor.inputs.canon));
  if (!canon.ok) throw new Error(`canon-schema: ${canon.errors.join("; ")}`);
  const evidence = parseEvidenceFile(parseSnapshotYaml(snapshot, descriptor.inputs.evidence));
  if (!evidence.ok) throw new Error(`evidence-schema: ${evidence.errors.join("; ")}`);
  const baseline = BaselineReceiptSchema.safeParse(parseSnapshotYaml(snapshot, descriptor.inputs.baselineReceipt));
  if (!baseline.success) throw new Error(`requirements-trust: ${baseline.error.message}`);
  const requirements = parseRequirements(parseSnapshotYaml(snapshot, descriptor.inputs.requirements), {
    archivedJdText: snapshot.bytes.get(descriptor.inputs.jd)!.toString("utf8"), canon: canon.data,
    baselineReceiptResolver: hash => hash === baseline.data.sha256 ? baseline.data : undefined,
  });
  if (!requirements.ok) throw new Error(`requirements-trust: ${requirements.errors.join("; ")}`);
  const policy = VerifyPolicySchema.safeParse(parseSnapshotYaml(snapshot, descriptor.inputs.policy));
  if (!policy.success) throw new Error(`policy: ${policy.error.message}`);
  const waivers = descriptor.waivers.map(path => WaiverSchema.parse(parseSnapshotYaml(snapshot, path)));
  const attestations = descriptor.attestations.map(path => AttestationSchema.parse(parseSnapshotYaml(snapshot, path)));
  if (waivers.some(value => !selfDigestValid(value)) || attestations.some(value => !selfDigestValid(value))) throw new Error("waiver/attestation self-hash mismatch");
  const resolutionIds = [...waivers, ...attestations].map(value => value.id);
  if (new Set(resolutionIds).size !== resolutionIds.length) throw new Error("waiver/attestation IDs must be globally unique");
  const resolutionFindings = [...waivers, ...attestations].map(value => value.findingId);
  if (new Set(resolutionFindings).size !== resolutionFindings.length) throw new Error("each finding permits at most one waiver or attestation resolution");
  const advisoryIds = new Set(policy.data.gates.filter(gate => gate.severity === "advisory").map(gate => gate.id));
  for (const resolution of [...waivers, ...attestations]) if (!advisoryIds.has(resolution.findingId as any)) throw new Error(`resolution ${resolution.id} does not scope one exact advisory finding`);
  const strategy = StrategySchema.parse(parseSnapshotYaml(snapshot, descriptor.inputs.strategy));
  ResearchSchema.parse(parseSnapshotYaml(snapshot, descriptor.inputs.research));
  PreferencesSchema.parse(parseSnapshotYaml(snapshot, descriptor.inputs.preferences));
  const corpusDocs = snapshot.corpusMembers.filter(member => member.kind === "document").map(member => ({ name: member.id, html: snapshot.bytes.get(member.path)!.toString("utf8") }));
  for (const resolution of [...waivers, ...attestations]) if (resolution.packSha256 !== snapshot.bindings.packSha256 || resolution.policySha256 !== snapshot.bindings.inputs.policy.sha256) throw new Error(`resolution ${resolution.id} belongs to another pack or policy generation`);
  return { canon: canon.data, evidence: evidence.data, requirements: requirements.data, policy: policy.data, corpus: snapshot.corpus, corpusDocs, waivers, attestations, strategy, packSha256: snapshot.bindings.packSha256, policySha256: snapshot.bindings.inputs.policy.sha256 };
}

function createProductionDependencies(trust: ProductionTrust): PackDependencies {
  return {
    verifyAndRender: async context => {
      const claims = await verifyClaimIntegrity({ htmlPath: context.sourceHtml, declaredArtifactPath: context.declaredArtifactPath, artifact: context.artifact.id, evidence: trust.evidence, canon: trust.canon, evidencePath: context.descriptor.inputs.evidence, outputPdfPath: context.stagedPdf });
      return [{ id: `claim-integrity:${context.artifact.id}`, severity: "blocking", ok: claims.ok, messages: claims.issues.map(issue => issue.message) }];
    },
    extractText: extractPdfText,
    pageCount,
  };
}

function sourceBindings(descriptor: PackDescriptor, descriptorSha256: string, descriptorDirectory: string) {
  return captureSourceSnapshot(descriptor, descriptorSha256, descriptorDirectory).bindings;
}

function authoritativeFindings(contexts: CheckContext[], raw: PackFinding[], descriptor: PackDescriptor, trust: ProductionTrust): PackFinding[] {
  const severity = new Map<string, "blocking" | "advisory">(trust.policy.gates.map(gate => [gate.id, gate.severity]));
  const priors = trust.corpusDocs;
  const htmls = contexts.map(context => readFileSync(context.stagedHtml, "utf8"));
  const grouped = (prefix: string) => raw.filter(finding => finding.id === prefix || finding.id.startsWith(`${prefix}:`));
  const usedResolutions = new Set<string>();
  const resolved = (id: string, ok: boolean, messages: string[]): PackFinding => {
    const gateSeverity = severity.get(id);
    if (!gateSeverity) throw new Error(`policy has no gate ${id}`);
    const stableMessages = [...messages].sort();
    if (ok || gateSeverity === "blocking") return { id, severity: gateSeverity, ok, messages: stableMessages };
    const candidates = [...trust.waivers, ...trust.attestations].filter(value => value.findingId === id);
    if (candidates.length > 1) throw new Error(`finding ${id} requires at most one exact resolution; found ${candidates.length}`);
    const findingSha256 = sha256Bytes(canonicalJson({ id, severity: gateSeverity, ok, messages: stableMessages }));
    const resolution = candidates[0];
    if (resolution && (resolution.packSha256 !== trust.packSha256 || resolution.policySha256 !== trust.policySha256 || resolution.findingSha256 !== findingSha256)) throw new Error(`resolution ${resolution.id} is stale or belongs to another pack, policy, or finding generation`);
    if (resolution) usedResolutions.add(resolution.id);
    const waiver = resolution && "reason" in resolution ? resolution : undefined;
    const attestation = resolution && "statement" in resolution ? resolution : undefined;
    if (waiver) return { id, severity: gateSeverity, ok, messages: stableMessages, disposition: "waived", resolution: { waiverId: waiver.id } };
    if (attestation) return { id, severity: gateSeverity, ok, messages: stableMessages, disposition: "accepted", resolution: { attestationId: attestation.id } };
    return { id, severity: gateSeverity, ok, messages: stableMessages, disposition: "review-required" };
  };
  const aggregateRaw = (id: string) => {
    const values = grouped(id);
    return resolved(id, values.length > 0 && values.every(value => value.ok), values.flatMap(value => value.messages));
  };
  const fit = analyzeRequirementFit(trust.requirements, trust.canon, { allowCandidateAttested: true, minConfidence: trust.policy.thresholds.fitMinimumConfidence, allowedUses: ["fit"], allowedSensitivities: ["public", "private"], allowedProvenanceTypes: ["candidate-attested", "artifact", "external"] });
  const leaks = htmls.flatMap(html => scanProtected(html, trust.canon.protectedTopics));
  const prohibited = htmls.flatMap(text => analyzeProhibitedClaims({ text, canon: trust.canon }).issues);
  const ats = contexts.map(context => analyzeRequirementAts(context.pdfText, trust.requirements, trust.policy.thresholds.atsMinimum));
  const tells = htmls.flatMap(html => lintAiTells(html));
  const impacts = htmls.map(html => analyzeImpact(html, { ...defaultImpactOptions, minFontPt: trust.policy.thresholds.minimumFontPt, minMarginMm: trust.policy.thresholds.minimumMarginMm, minLineHeight: trust.policy.thresholds.minimumLineHeight }));
  const distinct = htmls.map(html => checkDistinct(html, priors, { maxShared: trust.policy.thresholds.maximumSharedRuns, maxSignatures: trust.policy.thresholds.maximumSignaturePhrases, canonText: canonToText(trust.canon) }));
  const strategy = analyzeStrategy(trust.strategy, { projectIds: trust.canon.projects.map(project => project.name), facts: trust.canon.facts, minConfidence: trust.policy.thresholds.fitMinimumConfidence });
  const editorial = htmls.map(analyzeEditorial);
  const evidenceMessages = [...strategy.evidence, ...descriptor.artifacts.filter(artifact => !trust.evidence.claims.some(claim => claim.artifact === artifact.id)).map(artifact => `artifact ${artifact.id} has no claim evidence`)];
  const findings = [
    resolved("canon-schema", true, []), resolved("evidence-schema", true, []), resolved("requirements-trust", true, []),
    resolved("fit-blockers", fit.hardBlockers.length === 0 && fit.score >= trust.policy.thresholds.fitMinimumScore, [...fit.hardBlockers.map(value => `hard blocker: ${value.id}`), ...(fit.score < trust.policy.thresholds.fitMinimumScore ? [`verified fit ${fit.score} is below policy floor ${trust.policy.thresholds.fitMinimumScore}`] : [])]),
    resolved("protected-topics", leaks.length === 0, leaks.map(value => `protected topic ${value.term}`)),
    resolved("prohibited-claims", prohibited.length === 0, prohibited.map(value => value.message)),
    aggregateRaw("claim-integrity"), aggregateRaw("pdf-text-layer"), aggregateRaw("page-integrity"),
    resolved("corpus-eligibility", true, []),
    resolved("ats", ats.every(value => value.ok), ats.flatMap(value => value.missing.map(term => `missing literal: ${term}`))),
    resolved("ai-tell", tells.length === 0, tells.map(value => `${value.rule} at line ${value.line}`)),
    resolved("impact", impacts.every(value => value.ok), impacts.flatMap((value, index) => value.ok ? [] : [`artifact ${descriptor.artifacts[index].id} failed impact/readability checks`])),
    resolved("distinctness", distinct.every(value => value.ok), distinct.flatMap((value, index) => [
      ...value.shared.map(run => `artifact ${descriptor.artifacts[index].id}: shared collision with [${run.sources.join(", ")}]; eligible documents ${priors.length}; text ${JSON.stringify(run.text)}`),
      ...value.signatures.map(run => `artifact ${descriptor.artifacts[index].id}: signature collision with [${run.sources.join(", ")}]; eligible documents ${priors.length}; text ${JSON.stringify(run.text)}`),
    ])),
    resolved("strategy-selection", strategy.selection.length === 0, strategy.selection),
    resolved("evidence-altitude", false, evidenceMessages),
    resolved("editorial", false, editorial.flatMap((value, index) => value.messages.map(message => `artifact ${descriptor.artifacts[index].id}: ${message}`))),
    resolved("accessibility", impacts.every(value => value.readability?.ok ?? false), impacts.filter(value => !(value.readability?.ok ?? false)).map(() => "font, margin, or line-height floor failed")),
  ];
  if (new Set(findings.map(finding => finding.id)).size !== findings.length) throw new Error("gate registry emitted duplicate finding IDs");
  if (findings.length !== trust.policy.gates.length) throw new Error("gate registry did not emit the complete policy set");
  if (usedResolutions.size !== trust.waivers.length + trust.attestations.length) throw new Error("every waiver/attestation must resolve exactly one current finding");
  return findings;
}

export async function verifyPack(descriptorPath: string, outputDirectory: string, dependencies?: Partial<PackDependencies>): Promise<IssuedVerifyReceipt> {
  const output = resolve(outputDirectory);
  if (existsSync(output)) throw new Error(`candidate output already exists: ${outputDirectory}`);
  const base = dirname(resolve(descriptorPath));
  const loadedDescriptor = readDescriptor(descriptorPath);
  const descriptor = resolved(loadedDescriptor.descriptor, base);
  const initialSnapshot = captureSourceSnapshot(descriptor, loadedDescriptor.sha256, base);
  const trust = prepareProductionTrust(descriptor, initialSnapshot);
  const deps = { ...createProductionDependencies(trust), ...dependencies };
  const provenance = dependencies === undefined ? "production" as const : "injected" as const;
  const engine = deriveEngineIdentity();
  const parent = dirname(output);
  const temporary = mkdtempSync(join(parent, ".tailored-verify-"));
  try {
    const initialBindings = initialSnapshot.bindings;
    const findings: PackFinding[] = [], outputs: Array<{ id: string; file: string; sha256: string }> = [], contexts: CheckContext[] = [];
    for (const artifact of descriptor.artifacts) {
      const htmlFile = `${artifact.id}.html`, stagedHtml = join(temporary, htmlFile), stagedPdf = join(temporary, artifact.pdf);
      writeFileSync(stagedHtml, initialSnapshot.bytes.get(artifact.html)!);
      const declaredHtml = initialBindings.artifacts.find(binding => binding.id === artifact.id);
      if (!declaredHtml || sha256File(stagedHtml) !== declaredHtml.sha256) throw new Error(`bound HTML changed while staging ${artifact.id}`);
      const renderFindings = await deps.verifyAndRender({ artifact, descriptor, descriptorDirectory: base, sourceHtml: stagedHtml, declaredArtifactPath: artifact.html, stagedHtml, stagedPdf });
      findings.push(...renderFindings);
      const renderBlockers = renderFindings.filter(finding => finding.severity === "blocking" && !finding.ok);
      if (renderBlockers.length) throw new Error(`blocking verification failed: ${renderBlockers.flatMap(finding => finding.messages).join("; ")}`);
      const pdfText = await deps.extractText(stagedPdf);
      const pages = await deps.pageCount(stagedPdf);
      findings.push({ id: `pdf-text-layer:${artifact.id}`, severity: "blocking", ok: pdfText.trim().length > 0, messages: pdfText.trim() ? [] : ["PDF has no extractable text layer"] });
      findings.push({ id: `page-integrity:${artifact.id}`, severity: "blocking", ok: pages > 0 && pages <= artifact.maxPages, messages: pages > 0 && pages <= artifact.maxPages ? [] : [`PDF has ${pages} pages; declared maximum is ${artifact.maxPages}`] });
      const context = { artifact, descriptor, descriptorDirectory: base, stagedHtml, stagedPdf, pdfText };
      contexts.push(context);
      outputs.push({ ...bind(`${artifact.id}-html`, stagedHtml), file: htmlFile }, { ...bind(`${artifact.id}-pdf`, stagedPdf), file: artifact.pdf });
    }
    findings.splice(0, findings.length, ...authoritativeFindings(contexts, findings, descriptor, trust));
    const invalidFinding = findings.map(finding => VerifyReceiptSchema.shape.findings.element.safeParse(finding)).find(result => !result.success);
    if (invalidFinding && !invalidFinding.success) throw new Error(`invalid finding: ${invalidFinding.error.message}`);
    const blocking = findings.filter(finding => finding.severity === "blocking" && !finding.ok);
    if (blocking.length) throw new Error(`blocking verification failed: ${blocking.flatMap(finding => finding.messages).join("; ")}`);
    if (sha256Bytes(readFileSync(descriptorPath)) !== loadedDescriptor.sha256 || canonicalJson(sourceBindings(descriptor, loadedDescriptor.sha256, base)) !== canonicalJson(initialBindings)) throw new Error("bound inputs changed during verification");
    const bindings = { ...initialBindings, outputs };
    const payload = {
      schemaVersion: 1 as const,
      kind: "tailored.verify-pack" as const, state: "ready-for-human" as const,
      dependencies: provenance,
      engine, bindings, findings,
    };
    const receipt = VerifyReceiptSchema.parse({ ...payload, receiptSha256: sha256Bytes(canonicalJson(payload)) });
    writeFileSync(join(temporary, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    for (const binding of outputs) if (sha256File(join(temporary, binding.file)) !== binding.sha256) throw new Error(`staged output changed before publication: ${binding.id}`);
    renameSync(temporary, output);
    issuedReceipts.add(receipt);
    return receipt as IssuedVerifyReceipt;
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

export function verifyReceiptFreshness(receipt: VerifyReceipt, descriptorPath: string, candidateDirectory?: string): { fresh: boolean; stale: string[] } {
  const loadedDescriptor = readDescriptor(descriptorPath);
  const base = dirname(resolve(descriptorPath));
  const descriptor = resolved(loadedDescriptor.descriptor, base);
  let current: ReturnType<typeof sourceBindings>;
  try { current = sourceBindings(descriptor, loadedDescriptor.sha256, base); }
  catch { return { fresh: false, stale: ["corpus:descriptor"] }; }
  const stale: string[] = [];
  const { receiptSha256, ...payload } = receipt;
  if (sha256Bytes(canonicalJson(payload)) !== receiptSha256) stale.push("receipt:integrity");
  // Receipts written before provenance was recorded carry no field and are production.
  if ((receipt.dependencies ?? "production") !== "production") stale.push("receipt:provenance");
  if (receipt.engine.revisionSha256 !== sha256Bytes(receipt.engine.revision)) stale.push("engine:integrity");
  const currentEngine = deriveEngineIdentity();
  if (receipt.engine.version !== currentEngine.version || receipt.engine.revision !== currentEngine.revision || receipt.engine.revisionSha256 !== currentEngine.revisionSha256) stale.push("engine:identity");
  if (receipt.bindings.descriptor.sha256 !== current.descriptor.sha256) stale.push("descriptor:pack-descriptor");
  if (receipt.bindings.packSha256 !== current.packSha256) stale.push("pack:generation");
  for (const [key, binding] of Object.entries(receipt.bindings.inputs)) if (current.inputs[key]?.sha256 !== binding.sha256) stale.push(`input:${key}`);
  const compare = (kind: string, expected: Array<{ id: string; sha256: string }>, actual: Array<{ id: string; sha256: string }>) => {
    const byId = new Map(actual.map(value => [value.id, value.sha256]));
    for (const binding of expected) if (byId.get(binding.id) !== binding.sha256) stale.push(`${kind}:${binding.id}`);
    if (expected.length !== actual.length) stale.push(`${kind}:membership`);
  };
  compare("artifact", receipt.bindings.artifacts, current.artifacts);
  if (receipt.bindings.corpusDescriptor.sha256 !== current.corpusDescriptor.sha256) stale.push("corpus:descriptor");
  compare("corpus", receipt.bindings.corpusMembers, current.corpusMembers);
  compare("waiver", receipt.bindings.waivers, current.waivers);
  compare("attestation", receipt.bindings.attestations, current.attestations);
  if (candidateDirectory) for (const output of receipt.bindings.outputs) {
    const path = join(candidateDirectory, output.file);
    if (!existsSync(path) || sha256File(path) !== output.sha256) stale.push(`output:${output.id}`);
  }
  return { fresh: stale.length === 0, stale };
}
