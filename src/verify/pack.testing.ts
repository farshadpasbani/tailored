import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { PackDescriptorSchema, type PackDescriptor } from "./pack.js";
import { CorpusDescriptorSchema } from "./trust.js";
import { canonicalJson, sha256Bytes, sha256File } from "./hash.js";
import { VerifyReceiptSchema, type PackFinding } from "./receipt.js";

const TestVerifyReceiptSchema = VerifyReceiptSchema.extend({ kind: z.literal("tailored.verify-pack.test"), state: z.literal("test-only") }).strict();
type TestVerifyReceipt = z.infer<typeof TestVerifyReceiptSchema>;

interface CheckContext { artifact: PackDescriptor["artifacts"][number]; descriptor: PackDescriptor; descriptorDirectory: string; stagedHtml: string; stagedPdf: string; pdfText: string; }
interface VerifyRenderContext extends Omit<CheckContext, "pdfText"> { sourceHtml: string; declaredArtifactPath: string; }
export interface TestPackDependencies {
  render: (html: string, pdf: string) => Promise<void>;
  verifyAndRender?: (context: VerifyRenderContext) => Promise<PackFinding[]>;
  extractText: (pdf: string) => Promise<string>;
  pageCount: (pdf: string) => Promise<number>;
  blockingChecks: (context: CheckContext) => Promise<PackFinding[]>;
  advisoryChecks: (context: CheckContext) => Promise<PackFinding[]>;
  writeReceipt?: (path: string, contents: string) => void;
}
export interface TestVerifyOptions { engineVersion: string; engineRevision: string; deps: TestPackDependencies; }

const absolute = (base: string, path: string) => isAbsolute(path) ? path : resolve(base, path);
function loadDescriptor(path: string): { data: PackDescriptor; sha256: string } {
  let bytes: Buffer, raw: unknown;
  try { bytes = readFileSync(path); raw = yaml.load(bytes.toString("utf8")); }
  catch (error) { throw new Error(`invalid pack descriptor: ${(error as Error).message}`); }
  const parsed = PackDescriptorSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid pack descriptor: ${parsed.error.message}`);
  const base = dirname(resolve(path));
  return { data: { ...parsed.data, inputs: Object.fromEntries(Object.entries(parsed.data.inputs).map(([key, value]) => [key, absolute(base, value)])) as PackDescriptor["inputs"], artifacts: parsed.data.artifacts.map(value => ({ ...value, html: absolute(base, value.html) })), corpus: { descriptor: absolute(base, parsed.data.corpus.descriptor) }, waivers: parsed.data.waivers.map(value => absolute(base, value)), attestations: parsed.data.attestations.map(value => absolute(base, value)) }, sha256: sha256Bytes(bytes) };
}
function bindings(descriptor: PackDescriptor, descriptorSha256: string) {
  const corpus = CorpusDescriptorSchema.parse(yaml.load(readFileSync(descriptor.corpus.descriptor, "utf8"))), base = dirname(descriptor.corpus.descriptor);
  const bind = (id: string, path: string) => ({ id, sha256: sha256File(path) });
  const result = { descriptor: { id: "pack-descriptor", sha256: descriptorSha256 }, inputs: Object.fromEntries(Object.entries(descriptor.inputs).map(([id, path]) => [id, bind(id, path)])), artifacts: descriptor.artifacts.map(value => bind(value.id, value.html)), corpusDescriptor: bind("corpus-descriptor", descriptor.corpus.descriptor), corpusMembers: corpus.members.map(value => bind(value.id, absolute(base, value.path))), waivers: descriptor.waivers.map((path, index) => bind(`waiver-${index}`, path)), attestations: descriptor.attestations.map((path, index) => bind(`attestation-${index}`, path)) };
  return { ...result, packSha256: sha256Bytes(canonicalJson({ inputs: result.inputs, artifacts: result.artifacts, corpusDescriptor: result.corpusDescriptor, corpusMembers: result.corpusMembers })) };
}

export async function verifyPackForTest(descriptorPath: string, outputDirectory: string, options: TestVerifyOptions): Promise<TestVerifyReceipt> {
  const output = resolve(outputDirectory); if (existsSync(output)) throw new Error(`candidate output already exists: ${outputDirectory}`);
  const loaded = loadDescriptor(descriptorPath), descriptor = loaded.data, initial = bindings(descriptor, loaded.sha256), temporary = mkdtempSync(join(dirname(output), ".tailored-test-verify-"));
  try {
    const findings: PackFinding[] = [], outputs: Array<{ id: string; file: string; sha256: string }> = [];
    for (const artifact of descriptor.artifacts) {
      const htmlFile = `${artifact.id}.html`, stagedHtml = join(temporary, htmlFile), stagedPdf = join(temporary, artifact.pdf);
      const immutableHtml = readFileSync(artifact.html); writeFileSync(stagedHtml, immutableHtml);
      if (options.deps.verifyAndRender) findings.push(...await options.deps.verifyAndRender({ artifact, descriptor, descriptorDirectory: dirname(resolve(descriptorPath)), sourceHtml: stagedHtml, declaredArtifactPath: artifact.html, stagedHtml, stagedPdf }));
      else await options.deps.render(stagedHtml, stagedPdf);
      const pdfText = await options.deps.extractText(stagedPdf), pages = await options.deps.pageCount(stagedPdf);
      findings.push({ id: `pdf-text-layer:${artifact.id}`, severity: "blocking", ok: pdfText.trim().length > 0, messages: pdfText.trim() ? [] : ["PDF has no extractable text layer"] });
      findings.push({ id: `page-integrity:${artifact.id}`, severity: "blocking", ok: pages > 0 && pages <= artifact.maxPages, messages: pages > 0 && pages <= artifact.maxPages ? [] : [`PDF has ${pages} pages; declared maximum is ${artifact.maxPages}`] });
      const context = { artifact, descriptor, descriptorDirectory: dirname(resolve(descriptorPath)), stagedHtml, stagedPdf, pdfText };
      findings.push(...await options.deps.blockingChecks(context), ...await options.deps.advisoryChecks(context));
      outputs.push({ ...{ id: `${artifact.id}-html`, sha256: sha256File(stagedHtml) }, file: htmlFile }, { ...{ id: `${artifact.id}-pdf`, sha256: sha256File(stagedPdf) }, file: artifact.pdf });
    }
    for (const finding of findings) if (!VerifyReceiptSchema.shape.findings.element.safeParse(finding).success) throw new Error("invalid finding: disposition or resolution");
    const blockers = findings.filter(value => value.severity === "blocking" && !value.ok); if (blockers.length) throw new Error(`blocking verification failed: ${blockers.flatMap(value => value.messages).join("; ")}`);
    const currentDescriptor = readFileSync(descriptorPath);
    if (sha256Bytes(currentDescriptor) !== loaded.sha256 || canonicalJson(bindings(descriptor, loaded.sha256)) !== canonicalJson(initial)) throw new Error("bound inputs changed during verification");
    const payload = { schemaVersion: 1 as const, kind: "tailored.verify-pack.test" as const, state: "test-only" as const, engine: { version: options.engineVersion, revision: options.engineRevision, revisionSha256: sha256Bytes(options.engineRevision) }, bindings: { ...initial, outputs }, findings };
    const receipt = TestVerifyReceiptSchema.parse({ ...payload, receiptSha256: sha256Bytes(canonicalJson(payload)) });
    (options.deps.writeReceipt ?? ((path, contents) => writeFileSync(path, contents, { flag: "wx" })))(join(temporary, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    renameSync(temporary, output); return receipt;
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
}

export function verifyTestReceiptFreshness(receipt: TestVerifyReceipt, descriptorPath: string, candidateDirectory?: string, currentEngine?: { version: string; revision: string }): { fresh: boolean; stale: string[] } {
  const loaded = loadDescriptor(descriptorPath); let current: ReturnType<typeof bindings>;
  try { current = bindings(loaded.data, loaded.sha256); } catch { return { fresh: false, stale: ["corpus:descriptor"] }; }
  const stale: string[] = [], { receiptSha256, ...payload } = receipt;
  if (sha256Bytes(canonicalJson(payload)) !== receiptSha256) stale.push("receipt:integrity");
  if (currentEngine && (receipt.engine.version !== currentEngine.version || receipt.engine.revision !== currentEngine.revision)) stale.push("engine:identity");
  if (receipt.bindings.descriptor.sha256 !== current.descriptor.sha256) stale.push("descriptor:pack-descriptor");
  if (receipt.bindings.packSha256 !== current.packSha256) stale.push("pack:generation");
  for (const [key, value] of Object.entries(receipt.bindings.inputs)) if (current.inputs[key]?.sha256 !== value.sha256) stale.push(`input:${key}`);
  const compare = (kind: string, expected: Array<{ id: string; sha256: string }>, actual: Array<{ id: string; sha256: string }>) => { const byId = new Map(actual.map(value => [value.id, value.sha256])); for (const value of expected) if (byId.get(value.id) !== value.sha256) stale.push(`${kind}:${value.id}`); if (expected.length !== actual.length) stale.push(`${kind}:membership`); };
  compare("artifact", receipt.bindings.artifacts, current.artifacts); if (receipt.bindings.corpusDescriptor.sha256 !== current.corpusDescriptor.sha256) stale.push("corpus:descriptor"); compare("corpus", receipt.bindings.corpusMembers, current.corpusMembers); compare("waiver", receipt.bindings.waivers, current.waivers); compare("attestation", receipt.bindings.attestations, current.attestations);
  if (candidateDirectory) for (const output of receipt.bindings.outputs) if (!existsSync(join(candidateDirectory, output.file)) || sha256File(join(candidateDirectory, output.file)) !== output.sha256) stale.push(`output:${output.id}`);
  return { fresh: stale.length === 0, stale };
}
