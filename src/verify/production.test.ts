import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { computeClaimBindingHash } from "../gates/claimIntegrity.js";
import { computeResourceManifestHash } from "../evidence/resources.js";
import type { EvidenceFile } from "../evidence/schema.js";
import { findChrome } from "../render/chrome.js";
import { issueBaselineReceipt, prepareRequirementsBaseline } from "../requirements/schema.js";
import { REQUIRED_ADVISORY_GATES, REQUIRED_BLOCKING_GATES } from "../policy/verify.js";
import { assertVerifierIssuedReceipt, verifyPack, verifyReceiptFreshness } from "./pack.js";
import { canonicalJson, sha256Bytes } from "./hash.js";
import { deriveEngineIdentity } from "./engine.js";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const available = Boolean(findChrome()) && spawnSync("pdftotext", ["-v"]).status === 0;

describe.skipIf(!available)("authoritative production verify-pack", () => {
  it("emits the complete policy registry exactly once without adapter authority", async () => {
    const root = mkdtempSync(join(tmpdir(), "tailored-production-pack-"));
    const fact = { id: "fact-python", statement: "Built Python systems.", kind: "achievement", subject: "Python systems", provenance: { type: "candidate-attested", source: "candidate" }, verifiedOn: "2026-07-13", status: "candidate-attested", confidence: 1, allowedUses: ["fit", "cv", "cover"], sensitivity: "public" };
    const canon: any = { schemaVersion: 2, identity: { name: "Alex Rivers", role: "Engineer" }, skills: [], projects: [{ name: "Project One", tagline: "Python", bullets: ["Built Python systems."] }], experience: [], education: [], certifications: [], publications: [], protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {}, facts: [fact] };
    const style = "<style>@page{margin:10mm}body{font-size:10pt;line-height:1.4;color:#111;background:#fff}</style>";
    const docs = { cv: `${style}<p data-claim-id="cv.python" data-claim-subject="candidate" data-claim-authority="candidate">Built Python systems.</p>`, cover: `${style}<p data-claim-id="cover.python" data-claim-subject="candidate" data-claim-authority="candidate">Built Python systems.</p>` };
    for (const [id, html] of Object.entries(docs)) writeFileSync(join(root, `${id}.html`), html);
    const artifacts = Object.entries(docs).map(([id, html]) => ({ id, path: `${id}.html`, sha256: hash(html), resourceRoot: ".", resources: [], resourceManifestSha256: computeResourceManifestHash([]) }));
    const claims: any[] = Object.keys(docs).map(id => ({ id: `${id}.python`, artifact: id, text: "Built Python systems.", subject: "candidate", namespace: "candidate", evidenceIds: [fact.id], artifactSha256: artifacts.find(value => value.id === id)!.sha256, textSha256: hash("Built Python systems."), bindingSha256: "0".repeat(64) }));
    const evidence = { schemaVersion: 2, artifacts, employerSources: [], claims } as EvidenceFile;
    for (const claim of evidence.claims) claim.bindingSha256 = computeClaimBindingHash(claim, evidence, canon);
    const jd = "Must have Python";
    const requirement: any = { id: "req-python", source: { quote: jd, location: "line 1", span: { start: 0, end: jd.length } }, classification: { frozen: "hard", current: "hard" }, weight: 1, eligibilityImpact: "none", ats: { literals: [{ term: "Python", source: { quote: "Python", location: "line 1", span: { start: 10, end: 16 } } }], aliases: [] }, evidence: { kind: "direct", factIds: [fact.id] } };
    const prepared = prepareRequirementsBaseline([requirement]), frozenAt = "2026-07-13T00:00:00.000Z", jdSha = hash(jd);
    const baseline = issueBaselineReceipt(prepared.sha256, { frozenAt, archivedJdSha256: jdSha, issuer: "fixture-review" });
    const requirements = { schemaVersion: 2, role: "Engineer", archivedJd: { sha256: jdSha }, frozenAt, requirements: [requirement], baseline: { ...prepared, receiptSha256: baseline.sha256 }, changes: [] };
    const policy = { schemaVersion: 1, gates: [...REQUIRED_BLOCKING_GATES.map(id => ({ id, severity: "blocking" })), ...REQUIRED_ADVISORY_GATES.map(id => ({ id, severity: "advisory" }))], thresholds: { atsMinimum: 0.8, fitMinimumConfidence: 0.5, fitMinimumScore: 0.8, minimumFontPt: 9, minimumMarginMm: 8, minimumLineHeight: 1.28, maximumSharedRuns: 0, maximumSignaturePhrases: 0 } };
    const prior = "<p>Earlier unrelated application prose.</p>"; writeFileSync(join(root, "prior.html"), prior);
    const nestedCorpus = yaml.dump({ schemaVersion: 1, members: [{ id: "prior", path: "prior.html", sha256: hash(prior), status: "submitted", kind: "document" }] });
    writeFileSync(join(root, "nested-corpus.yaml"), nestedCorpus);
    const files: Record<string, unknown> = {
      "canon.yaml": canon, "evidence.yaml": evidence, "requirements.yaml": requirements, "baseline-receipt.yaml": baseline,
      "strategy.yaml": { schemaVersion: 1, selectedProjectIds: ["Project One"], rationale: "Direct role evidence" },
      "research.yaml": { schemaVersion: 1, sources: [{ id: "jd", url: "https://example.com/job", sha256: jdSha }] },
      "preferences.yaml": { schemaVersion: 1, locale: "en-GB", tone: "direct" }, "policy.yaml": policy,
      "corpus.yaml": { schemaVersion: 1, members: [{ id: "history", path: "nested-corpus.yaml", sha256: hash(nestedCorpus), status: "submitted", kind: "corpus" }] },
    };
    for (const [name, value] of Object.entries(files)) writeFileSync(join(root, name), yaml.dump(value, { noRefs: true }));
    writeFileSync(join(root, "job-description.md"), jd);
    const descriptor: any = { schemaVersion: 1, inputs: { canon: "canon.yaml", jd: "job-description.md", requirements: "requirements.yaml", baselineReceipt: "baseline-receipt.yaml", evidence: "evidence.yaml", strategy: "strategy.yaml", research: "research.yaml", preferences: "preferences.yaml", policy: "policy.yaml" }, artifacts: [{ id: "cv", html: "cv.html", pdf: "cv.pdf", maxPages: 1 }, { id: "cover", html: "cover.html", pdf: "cover.pdf", maxPages: 1 }], corpus: { descriptor: "corpus.yaml" }, waivers: [], attestations: [] };
    writeFileSync(join(root, "pack.yaml"), yaml.dump(descriptor));
    const output = join(root, "candidate");
    const receipt = await verifyPack(join(root, "pack.yaml"), output);
    expect(receipt).toMatchObject({ kind: "tailored.verify-pack", state: "ready-for-human" });
    expect(() => assertVerifierIssuedReceipt(receipt)).not.toThrow();
    expect(receipt.engine).toEqual(deriveEngineIdentity());
    expect(receipt.findings.map(value => value.id).sort()).toEqual([...REQUIRED_BLOCKING_GATES, ...REQUIRED_ADVISORY_GATES].sort());
    expect(new Set(receipt.findings.map(value => value.id)).size).toBe(receipt.findings.length);
    expect(JSON.parse(readFileSync(join(output, "receipt.json"), "utf8"))).toEqual(receipt);
    const { receiptSha256: _old, ...fakePayload } = { ...receipt, engine: { version: "999.0.0", revision: "build:" + "f".repeat(64), revisionSha256: sha256Bytes("build:" + "f".repeat(64)) } };
    const fake = { ...fakePayload, receiptSha256: sha256Bytes(canonicalJson(fakePayload)) } as typeof receipt;
    expect(verifyReceiptFreshness(fake, join(root, "pack.yaml"), output).stale).toContain("engine:identity");
    expect(() => assertVerifierIssuedReceipt(fake)).toThrow(/integrity, not provenance/);

    const editorial = receipt.findings.find(value => value.id === "editorial")!;
    const findingSha256 = sha256Bytes(canonicalJson({ id: editorial.id, severity: editorial.severity, ok: editorial.ok, messages: editorial.messages }));
    const attestationPayload = { schemaVersion: 1, id: "editorial-review", findingId: "editorial", packSha256: receipt.bindings.packSha256, policySha256: receipt.bindings.inputs.policy.sha256, findingSha256, approvedBy: "Fixture Reviewer", approvedOn: "2026-07-13", statement: "Reviewed exact editorial finding" };
    writeFileSync(join(root, "attestation.yaml"), yaml.dump({ ...attestationPayload, sha256: sha256Bytes(canonicalJson(attestationPayload)) }));
    descriptor.attestations = ["attestation.yaml"];
    writeFileSync(join(root, "pack.yaml"), yaml.dump(descriptor));
    const accepted = await verifyPack(join(root, "pack.yaml"), join(root, "accepted-candidate"));
    expect(accepted.findings.find(value => value.id === "editorial")).toMatchObject({ disposition: "accepted", resolution: { attestationId: "editorial-review" } });

    const waiverPayload = { schemaVersion: 1, id: "editorial-waiver", findingId: "editorial", packSha256: receipt.bindings.packSha256, policySha256: receipt.bindings.inputs.policy.sha256, findingSha256, approvedBy: "Fixture Reviewer", approvedOn: "2026-07-13", reason: "duplicate resolution probe" };
    writeFileSync(join(root, "waiver.yaml"), yaml.dump({ ...waiverPayload, sha256: sha256Bytes(canonicalJson(waiverPayload)) }));
    descriptor.waivers = ["waiver.yaml"];
    writeFileSync(join(root, "pack.yaml"), yaml.dump(descriptor));
    await expect(verifyPack(join(root, "pack.yaml"), join(root, "duplicate-candidate"))).rejects.toThrow(/at most one/);

    descriptor.waivers = [];
    writeFileSync(join(root, "research.yaml"), yaml.dump({ schemaVersion: 1, sources: [{ id: "jd-v2", url: "https://example.com/changed", sha256: jdSha }] }));
    writeFileSync(join(root, "pack.yaml"), yaml.dump(descriptor));
    await expect(verifyPack(join(root, "pack.yaml"), join(root, "cross-pack-candidate"))).rejects.toThrow(/another pack or policy/);
  }, 60_000);
});
