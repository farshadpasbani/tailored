import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import { computeClaimBindingHash } from "../gates/claimIntegrity.js";
import { computeResourceManifestHash } from "../evidence/resources.js";
import type { EvidenceFile } from "../evidence/schema.js";
import { issueBaselineReceipt, prepareRequirementsBaseline } from "../requirements/schema.js";
import { REQUIRED_ADVISORY_GATES, REQUIRED_BLOCKING_GATES } from "../policy/verify.js";
import { verifyPack, verifyReceiptFreshness, type PackDependencies } from "./pack.js";
import { VerifyReceiptSchema, type VerifyReceipt } from "./receipt.js";
import { canonicalJson, sha256Bytes } from "./hash.js";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/**
 * A complete, trustworthy pack on disk. Every input, gate, hash, and staging step is
 * real and mutable; only the three adapters that would otherwise need Chrome and
 * Poppler are faked, which is exactly what `dependencies: "injected"` records.
 */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tailored-pack-"));
  const paths: Record<string, string> = {};
  const write = (name: string, contents: string) => { const path = join(root, name); paths[name.replace(/\.[a-z]+$/, "")] = path; writeFileSync(path, contents); return path; };
  const writeYaml = (name: string, value: unknown) => write(name, yaml.dump(value, { noRefs: true }));

  const fact = { id: "fact-python", statement: "Built Python systems.", kind: "achievement", subject: "Python systems", provenance: { type: "candidate-attested", source: "candidate" }, verifiedOn: "2026-07-13", status: "candidate-attested", confidence: 1, allowedUses: ["fit", "cv", "cover"], sensitivity: "public" };
  const canon: any = { schemaVersion: 2, identity: { name: "Alex Rivers", role: "Engineer" }, skills: [], projects: [{ name: "Project One", tagline: "Python", bullets: ["Built Python systems."] }], experience: [], education: [], certifications: [], publications: [], protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {}, facts: [fact] };
  const style = "<style>@page{margin:10mm}body{font-size:10pt;line-height:1.4;color:#111;background:#fff}</style>";
  const documents = { cv: `${style}<p data-claim-id="cv.python" data-claim-subject="candidate" data-claim-authority="candidate">Built Python systems.</p>`, cover: `${style}<p data-claim-id="cover.python" data-claim-subject="candidate" data-claim-authority="candidate">Built Python systems.</p>` };
  for (const [id, html] of Object.entries(documents)) write(`${id}.html`, html);

  const artifacts = Object.entries(documents).map(([id, html]) => ({ id, path: `${id}.html`, sha256: hash(html), resourceRoot: ".", resources: [], resourceManifestSha256: computeResourceManifestHash([]) }));
  const claims: any[] = Object.keys(documents).map(id => ({ id: `${id}.python`, artifact: id, text: "Built Python systems.", subject: "candidate", namespace: "candidate", evidenceIds: [fact.id], artifactSha256: artifacts.find(value => value.id === id)!.sha256, textSha256: hash("Built Python systems."), bindingSha256: "0".repeat(64) }));
  const evidence = { schemaVersion: 2, artifacts, employerSources: [], claims } as EvidenceFile;
  for (const claim of evidence.claims) claim.bindingSha256 = computeClaimBindingHash(claim, evidence, canon);

  const jd = "Must have Python", jdSha = hash(jd);
  const requirement: any = { id: "req-python", source: { quote: jd, location: "line 1", span: { start: 0, end: jd.length } }, classification: { frozen: "hard", current: "hard" }, weight: 1, eligibilityImpact: "none", ats: { literals: [{ term: "Python", source: { quote: "Python", location: "line 1", span: { start: 10, end: 16 } } }], aliases: [] }, evidence: { kind: "direct", factIds: [fact.id] } };
  const prepared = prepareRequirementsBaseline([requirement]), frozenAt = "2026-07-13T00:00:00.000Z";
  const baseline = issueBaselineReceipt(prepared.sha256, { frozenAt, archivedJdSha256: jdSha, issuer: "fixture-review" });
  const prior = "<p>Earlier unrelated application prose.</p>";
  const nestedCorpus = yaml.dump({ schemaVersion: 1, members: [{ id: "prior", path: "prior.html", sha256: hash(prior), status: "submitted", kind: "document" }] });

  write("job-description.md", jd);
  write("prior.html", prior);
  write("nested-corpus.yaml", nestedCorpus);
  writeYaml("canon.yaml", canon);
  writeYaml("evidence.yaml", evidence);
  writeYaml("requirements.yaml", { schemaVersion: 2, role: "Engineer", archivedJd: { sha256: jdSha }, frozenAt, requirements: [requirement], baseline: { ...prepared, receiptSha256: baseline.sha256 }, changes: [] });
  writeYaml("baseline-receipt.yaml", baseline);
  writeYaml("strategy.yaml", { schemaVersion: 1, selectedProjectIds: ["Project One"], rationale: "Direct role evidence" });
  writeYaml("research.yaml", { schemaVersion: 1, sources: [{ id: "jd", url: "https://example.com/job", sha256: jdSha }] });
  writeYaml("preferences.yaml", { schemaVersion: 1, locale: "en-GB", tone: "direct" });
  writeYaml("policy.yaml", { schemaVersion: 1, gates: [...REQUIRED_BLOCKING_GATES.map(id => ({ id, severity: "blocking" })), ...REQUIRED_ADVISORY_GATES.map(id => ({ id, severity: "advisory" }))], thresholds: { atsMinimum: 0.8, fitMinimumConfidence: 0.5, fitMinimumScore: 0.8, minimumFontPt: 9, minimumMarginMm: 8, minimumLineHeight: 1.28, maximumSharedRuns: 0, maximumSignaturePhrases: 0 } });
  writeYaml("corpus.yaml", { schemaVersion: 1, members: [{ id: "history", path: "nested-corpus.yaml", sha256: hash(nestedCorpus), status: "submitted", kind: "corpus" }] });

  // The descriptor is deliberately outside `paths`: tests that walk every bound input
  // mutate it byte-wise, and its own generation swap is asserted separately.
  const descriptorPath = join(root, "pack.yaml");
  writeFileSync(descriptorPath, yaml.dump({
    schemaVersion: 1,
    inputs: { canon: "canon.yaml", jd: "job-description.md", requirements: "requirements.yaml", baselineReceipt: "baseline-receipt.yaml", evidence: "evidence.yaml", strategy: "strategy.yaml", research: "research.yaml", preferences: "preferences.yaml", policy: "policy.yaml" },
    artifacts: [{ id: "cv", html: "cv.html", pdf: "cv.pdf", maxPages: 2 }, { id: "cover", html: "cover.html", pdf: "cover.pdf", maxPages: 1 }],
    corpus: { descriptor: "corpus.yaml" }, waivers: [], attestations: [],
  }, { noRefs: true }));

  const deps: PackDependencies = {
    verifyAndRender: async ({ artifact, stagedPdf }) => { writeFileSync(stagedPdf, `%PDF ${artifact.id}`); return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }]; },
    extractText: async () => "EXPERIENCE\nBuilt Python systems.",
    pageCount: async () => 1,
  };
  return { root, paths, descriptorPath, output: join(root, "candidate"), deps };
}

/** Every staleness class except the one an injected receipt always carries. */
const bindingStaleness = (receipt: VerifyReceipt, descriptorPath: string, candidate?: string) =>
  verifyReceiptFreshness(receipt, descriptorPath, candidate).stale.filter(key => key !== "receipt:provenance");

/** Re-seal a payload the way the transaction does, so a tampered receipt stays self-consistent. */
function reseal(payload: Omit<VerifyReceipt, "receiptSha256">): VerifyReceipt {
  return { ...payload, receiptSha256: sha256Bytes(canonicalJson(payload)) };
}

describe("verifyPack transaction and receipt", () => {
  it("marks injected adapters in the receipt and refuses to call that receipt fresh", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, f.deps);
    expect(receipt.dependencies).toBe("injected");
    expect(verifyReceiptFreshness(receipt, f.descriptorPath, f.output)).toEqual({ fresh: false, stale: ["receipt:provenance"] });

    // Provenance is inside the hashed payload, so laundering an injected receipt into a
    // pre-change-looking one breaks integrity instead of buying production standing.
    const { dependencies: _dropped, ...laundered } = receipt;
    const stale = verifyReceiptFreshness(laundered as VerifyReceipt, f.descriptorPath, f.output).stale;
    expect(stale).toContain("receipt:integrity");
    expect(stale).not.toContain("receipt:provenance");
  });

  it("stages a complete pack and binds every required input and exact output", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, f.deps);
    expect(existsSync(join(f.output, "cv.pdf"))).toBe(true);
    expect(existsSync(join(f.output, "cover.pdf"))).toBe(true);
    expect(JSON.parse(readFileSync(join(f.output, "receipt.json"), "utf8"))).toEqual(receipt);
    expect(receipt).toMatchObject({ kind: "tailored.verify-pack", state: "ready-for-human" });
    for (const input of ["canon", "jd", "requirements", "evidence", "strategy", "research", "preferences", "policy"]) expect(receipt.bindings.inputs).toHaveProperty(input);
    expect(receipt.bindings.outputs.map(x => x.sha256)).toHaveLength(4);
    expect(receipt.findings.map(finding => finding.id).sort()).toEqual([...REQUIRED_BLOCKING_GATES, ...REQUIRED_ADVISORY_GATES].sort());
    expect(receipt.findings.find(x => x.severity === "advisory" && !x.ok)).toMatchObject({ ok: false, disposition: "review-required" });
    expect(bindingStaleness(receipt, f.descriptorPath, f.output)).toEqual([]);
    writeFileSync(join(f.output, "cv.pdf"), "%PDF changed");
    expect(bindingStaleness(receipt, f.descriptorPath, f.output)).toContain("output:cv-pdf");
    const tampered = { ...receipt, findings: [...receipt.findings, { id: "invented", severity: "blocking" as const, ok: true, messages: [] }] };
    expect(bindingStaleness(tampered, f.descriptorPath)).toContain("receipt:integrity");
  });

  it("uses one verifier-owned render for the exact PDF and records its claim verdict", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, {
      ...f.deps,
      verifyAndRender: async ({ artifact, stagedPdf }) => {
        writeFileSync(stagedPdf, "%PDF inspected snapshot");
        return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }];
      },
    });
    expect(receipt.findings).toContainEqual(expect.objectContaining({ id: "claim-integrity", ok: true }));
    expect(readFileSync(join(f.output, "cv.pdf"), "utf8")).toBe("%PDF inspected snapshot");
  });

  it("keeps staged HTML/PDF bound when the source mutates and returns before publication", async () => {
    const f = fixture(), original = readFileSync(f.paths.cv, "utf8");
    const receipt = await verifyPack(f.descriptorPath, f.output, {
      ...f.deps,
      verifyAndRender: async ({ artifact, sourceHtml, declaredArtifactPath, stagedPdf }) => {
        if (artifact.id === "cv") {
          expect(readFileSync(sourceHtml, "utf8")).toBe(original);
          expect(declaredArtifactPath).toBe(f.paths.cv);
          writeFileSync(f.paths.cv, "temporary mutation"); writeFileSync(f.paths.cv, original);
        }
        writeFileSync(stagedPdf, `%PDF ${readFileSync(sourceHtml, "utf8")}`);
        return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }];
      },
    });
    expect(receipt.state).toBe("ready-for-human");
    expect(readFileSync(join(f.output, "cv.pdf"), "utf8")).toContain(original);
  });

  it("makes the receipt stale when any bound class changes", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, f.deps);
    for (const path of Object.values(f.paths)) {
      const before = readFileSync(path);
      writeFileSync(path, Buffer.concat([before, Buffer.from("!")]));
      expect(bindingStaleness(receipt, f.descriptorPath), path).not.toEqual([]);
      writeFileSync(path, before);
    }
    const raw = yaml.load(readFileSync(f.descriptorPath, "utf8")) as any;
    raw.artifacts[0].maxPages = 99;
    writeFileSync(f.descriptorPath, yaml.dump(raw));
    expect(bindingStaleness(receipt, f.descriptorPath)).toContain("descriptor:pack-descriptor");
  });

  it("makes engine changes stale and rejects all output-path collisions", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, f.deps);
    expect(bindingStaleness(receipt, f.descriptorPath, f.output)).toEqual([]);
    const { receiptSha256: _old, ...payload } = receipt;
    const swapped = reseal({ ...payload, engine: { version: "999.0.0", revision: `build:${"f".repeat(64)}`, revisionSha256: sha256Bytes(`build:${"f".repeat(64)}`) } });
    expect(bindingStaleness(swapped, f.descriptorPath, f.output)).toEqual(["engine:identity"]);

    for (const pdf of ["cv.html", "receipt.json", "cover.txt"]) {
      const bad = fixture(), raw = yaml.load(readFileSync(bad.descriptorPath, "utf8")) as any;
      raw.artifacts[1].pdf = pdf;
      writeFileSync(bad.descriptorPath, yaml.dump(raw));
      await expect(verifyPack(bad.descriptorPath, bad.output, bad.deps)).rejects.toThrow(/PDF|output paths/);
      expect(existsSync(bad.output)).toBe(false);
    }
    const folded = fixture(), raw = yaml.load(readFileSync(folded.descriptorPath, "utf8")) as any;
    raw.artifacts[0].pdf = "pack.pdf"; raw.artifacts[1].pdf = "PACK.PDF";
    writeFileSync(folded.descriptorPath, yaml.dump(raw));
    await expect(verifyPack(folded.descriptorPath, folded.output, folded.deps)).rejects.toThrow(/output paths/);
  });

  it("leaves no candidate on a blocking failure or interrupted render", async () => {
    const blocked = fixture();
    await expect(verifyPack(blocked.descriptorPath, blocked.output, {
      ...blocked.deps,
      verifyAndRender: async ({ artifact, stagedPdf }) => { writeFileSync(stagedPdf, "%PDF"); return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: false, messages: ["bad claim"] }]; },
    })).rejects.toThrow(/blocking/);
    expect(existsSync(blocked.output)).toBe(false);

    const interrupted = fixture();
    await expect(verifyPack(interrupted.descriptorPath, interrupted.output, { ...interrupted.deps, verifyAndRender: async () => { throw new Error("No Chrome"); } })).rejects.toThrow(/No Chrome/);
    expect(existsSync(interrupted.output)).toBe(false);
  });

  it("leaves no candidate when Poppler is missing after a render", async () => {
    const f = fixture();
    await expect(verifyPack(f.descriptorPath, f.output, { ...f.deps, extractText: async () => { throw new Error("pdftotext not found"); } })).rejects.toThrow(/pdftotext/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("blocks a PDF outside its declared page policy", async () => {
    const f = fixture();
    await expect(verifyPack(f.descriptorPath, f.output, { ...f.deps, pageCount: async () => 3 })).rejects.toThrow(/declared maximum/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("removes the staged transaction when receipt writing is interrupted", async () => {
    const f = fixture();
    // Squat the reserved receipt name inside the staging directory the transaction owns.
    await expect(verifyPack(f.descriptorPath, f.output, {
      ...f.deps,
      verifyAndRender: async ({ artifact, stagedPdf }) => {
        writeFileSync(stagedPdf, `%PDF ${artifact.id}`);
        writeFileSync(join(dirname(stagedPdf), "receipt.json"), "squatter");
        return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }];
      },
    })).rejects.toThrow(/EEXIST/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("fails closed for missing inputs and concurrent publication", async () => {
    const missing = fixture();
    unlinkSync(missing.paths.policy);
    await expect(verifyPack(missing.descriptorPath, missing.output, missing.deps)).rejects.toThrow();
    expect(existsSync(missing.output)).toBe(false);

    const concurrent = fixture();
    const results = await Promise.allSettled([
      verifyPack(concurrent.descriptorPath, concurrent.output, concurrent.deps),
      verifyPack(concurrent.descriptorPath, concurrent.output, concurrent.deps),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(existsSync(join(concurrent.output, "receipt.json"))).toBe(true);
  });

  it("fails closed for empty or malformed descriptors and undisposed advisory findings", async () => {
    const malformed = fixture();
    writeFileSync(malformed.descriptorPath, "artifacts: [");
    await expect(verifyPack(malformed.descriptorPath, malformed.output, malformed.deps)).rejects.toThrow(/descriptor/);
    expect(existsSync(malformed.output)).toBe(false);

    const empty = fixture();
    const descriptor = yaml.load(readFileSync(empty.descriptorPath, "utf8")) as any;
    descriptor.artifacts = [];
    writeFileSync(empty.descriptorPath, yaml.dump(descriptor));
    await expect(verifyPack(empty.descriptorPath, empty.output, empty.deps)).rejects.toThrow(/artifacts/);
    expect(existsSync(empty.output)).toBe(false);

    // Adapters can no longer smuggle a finding into the receipt, so the invariant is
    // asserted on both ends: the schema rejects an undisposed advisory finding, and
    // every failing advisory finding the real registry emits carries a disposition.
    expect(VerifyReceiptSchema.shape.findings.element.safeParse({ id: "editorial", severity: "advisory", ok: false, messages: ["review"] }).success).toBe(false);
    const advisory = fixture();
    const receipt = await verifyPack(advisory.descriptorPath, advisory.output, advisory.deps);
    const failing = receipt.findings.filter(finding => finding.severity === "advisory" && !finding.ok);
    expect(failing.length).toBeGreaterThan(0);
    expect(failing.every(finding => finding.disposition === "review-required")).toBe(true);
  });

  it("rejects a source mutation during verification instead of binding mixed generations", async () => {
    const f = fixture();
    let mutated = false;
    await expect(verifyPack(f.descriptorPath, f.output, {
      ...f.deps,
      verifyAndRender: async ({ artifact, stagedPdf }) => {
        writeFileSync(stagedPdf, "%PDF exact");
        if (!mutated) { writeFileSync(f.paths.preferences, "changed during render"); mutated = true; }
        return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }];
      },
    })).rejects.toThrow(/changed during verification/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("rejects a descriptor generation swap after parsing the exact hashed bytes", async () => {
    const f = fixture();
    const original = readFileSync(f.descriptorPath, "utf8");
    let changed = false;
    await expect(verifyPack(f.descriptorPath, f.output, {
      ...f.deps,
      verifyAndRender: async ({ artifact, stagedPdf }) => {
        writeFileSync(stagedPdf, "%PDF exact");
        if (!changed) { writeFileSync(f.descriptorPath, `${original}\n# swapped generation\n`); changed = true; }
        return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }];
      },
    })).rejects.toThrow(/bound inputs changed/);
    expect(existsSync(f.output)).toBe(false);
  });
});

describe("receipts written before adapter provenance was recorded", () => {
  it("treats a receipt with no dependencies field as production", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, f.deps);
    // Exactly the payload the pre-change transaction wrote: no field, hash over the rest.
    const { dependencies: _absent, receiptSha256: _old, ...payload } = receipt;
    const legacy = VerifyReceiptSchema.parse(reseal(payload as Omit<VerifyReceipt, "receiptSha256">));
    expect(legacy).not.toHaveProperty("dependencies");
    expect(verifyReceiptFreshness(legacy, f.descriptorPath, f.output)).toEqual({ fresh: true, stale: [] });
  });

  it("still parses and verifies a receipt minted by the pre-change verifier", () => {
    const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
    const raw = JSON.parse(readFileSync(join(fixtures, "legacy-receipt.json"), "utf8"));
    expect(raw).not.toHaveProperty("dependencies");
    const receipt = VerifyReceiptSchema.parse(raw);
    // The engine revision moves with every commit, so identity is the only allowed drift:
    // integrity and provenance must both still hold over the original bytes.
    expect(verifyReceiptFreshness(receipt, join(fixtures, "legacy-pack", "pack.yaml")).stale.filter(key => key !== "engine:identity")).toEqual([]);
  });
});
