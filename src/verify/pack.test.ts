import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import { verifyPack as verifyAuthoritativePack } from "./pack.js";
import { verifyPackForTest as verifyPack, verifyTestReceiptFreshness as verifyReceiptFreshness, type TestPackDependencies as PackDependencies } from "./pack.testing.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tailored-pack-"));
  const paths: Record<string, string> = {};
  for (const name of ["canon", "jd", "requirements", "baselineReceipt", "evidence", "strategy", "research", "preferences", "policy", "cv", "cover", "corpus", "prior", "waiver", "attestation"]) {
    paths[name] = join(root, `${name}.txt`);
    writeFileSync(paths[name], `${name}-content`);
  }
  writeFileSync(paths.corpus, yaml.dump({ schemaVersion: 1, members: [{ id: "prior", path: paths.prior, sha256: createHash("sha256").update(readFileSync(paths.prior)).digest("hex"), status: "submitted" }] }));
  const descriptor = {
    schemaVersion: 1,
    inputs: Object.fromEntries(["canon", "jd", "requirements", "baselineReceipt", "evidence", "strategy", "research", "preferences", "policy"].map(k => [k, paths[k]])),
    artifacts: [{ id: "cv", html: paths.cv, pdf: "cv.pdf", maxPages: 2 }, { id: "cover", html: paths.cover, pdf: "cover.pdf", maxPages: 1 }],
    corpus: { descriptor: paths.corpus },
    waivers: [paths.waiver], attestations: [paths.attestation],
  };
  const descriptorPath = join(root, "pack.yaml");
  writeFileSync(descriptorPath, yaml.dump(descriptor));
  const output = join(root, "candidate");
  const deps: PackDependencies = {
    render: async (_html, pdf) => writeFileSync(pdf, "%PDF exact"),
    extractText: async () => "EXPERIENCE\nreal text",
    pageCount: async () => 1,
    blockingChecks: async ({ artifact }) => [{ id: `claims:${artifact.id}`, severity: "blocking", ok: true, messages: [] }],
    advisoryChecks: async ({ artifact }) => [{ id: `editorial:${artifact.id}`, severity: "advisory", ok: false, messages: ["review tone"], disposition: "review-required" }],
  };
  return { root, paths, descriptorPath, output, deps };
}

describe("verifyPack transaction and receipt", () => {
  it("cannot promote injected test adapters into an authoritative receipt", async () => {
    const f = fixture();
    await expect(verifyAuthoritativePack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: f.deps } as any)).rejects.toThrow(/canon-schema|policy|requirements-trust/);
    expect(existsSync(f.output)).toBe(false);
  });
  it("stages a complete pack and binds every required input and exact output", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, { engineVersion: "1.2.3", engineRevision: "abc123", deps: f.deps });
    expect(existsSync(join(f.output, "cv.pdf"))).toBe(true);
    expect(existsSync(join(f.output, "cover.pdf"))).toBe(true);
    expect(JSON.parse(readFileSync(join(f.output, "receipt.json"), "utf8"))).toEqual(receipt);
    expect(receipt).toMatchObject({ kind: "tailored.verify-pack.test", state: "test-only" });
    expect(receipt.bindings.inputs).toHaveProperty("canon");
    expect(receipt.bindings.inputs).toHaveProperty("jd");
    expect(receipt.bindings.inputs).toHaveProperty("requirements");
    expect(receipt.bindings.inputs).toHaveProperty("evidence");
    expect(receipt.bindings.inputs).toHaveProperty("strategy");
    expect(receipt.bindings.inputs).toHaveProperty("research");
    expect(receipt.bindings.inputs).toHaveProperty("preferences");
    expect(receipt.bindings.inputs).toHaveProperty("policy");
    expect(receipt.bindings.outputs.map(x => x.sha256)).toHaveLength(4);
    expect(receipt.findings.find(x => x.severity === "advisory")).toMatchObject({ ok: false, disposition: "review-required" });
    expect(verifyReceiptFreshness(receipt, f.descriptorPath, f.output)).toEqual({ fresh: true, stale: [] });
    writeFileSync(join(f.output, "cv.pdf"), "%PDF changed");
    expect(verifyReceiptFreshness(receipt, f.descriptorPath, f.output).stale).toContain("output:cv-pdf");
    const tampered = { ...receipt, state: "ready-for-human" as const, findings: [...receipt.findings, { id: "invented", severity: "blocking" as const, ok: true, messages: [] }] };
    expect(verifyReceiptFreshness(tampered, f.descriptorPath).stale).toContain("receipt:integrity");
  });

  it("uses one verifier-owned render for the exact PDF and records its claim verdict", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, {
      engineVersion: "1",
      engineRevision: "rev",
      deps: {
        ...f.deps,
        render: async () => { throw new Error("independent render must not run"); },
        verifyAndRender: async ({ artifact, stagedPdf }) => {
          writeFileSync(stagedPdf, "%PDF inspected snapshot");
          return [{ id: `claim-integrity:${artifact.id}`, severity: "blocking", ok: true, messages: [] }];
        },
      },
    });
    expect(receipt.findings).toContainEqual(expect.objectContaining({ id: "claim-integrity:cv", ok: true }));
    expect(readFileSync(join(f.output, "cv.pdf"), "utf8")).toBe("%PDF inspected snapshot");
  });

  it("keeps staged HTML/PDF bound when the source mutates and returns before publication", async () => {
    const f = fixture(), original = readFileSync(f.paths.cv, "utf8");
    const receipt = await verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: {
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
    } });
    expect(receipt.state).toBe("test-only");
    expect(readFileSync(join(f.output, "cv.pdf"), "utf8")).toContain(original);
  });

  it("makes the receipt stale when any bound class changes", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: f.deps });
    for (const path of Object.values(f.paths)) {
      const before = readFileSync(path);
      writeFileSync(path, Buffer.concat([before, Buffer.from("!")]));
      expect(verifyReceiptFreshness(receipt, f.descriptorPath).fresh, path).toBe(false);
      writeFileSync(path, before);
    }
    const raw = yaml.load(readFileSync(f.descriptorPath, "utf8")) as any;
    raw.artifacts[0].maxPages = 99;
    writeFileSync(f.descriptorPath, yaml.dump(raw));
    expect(verifyReceiptFreshness(receipt, f.descriptorPath).stale).toContain("descriptor:pack-descriptor");
  });

  it("makes engine changes stale and rejects all output-path collisions", async () => {
    const f = fixture();
    const receipt = await verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: f.deps });
    expect(verifyReceiptFreshness(receipt, f.descriptorPath, f.output, { version: "1", revision: "rev" }).fresh).toBe(true);
    expect(verifyReceiptFreshness(receipt, f.descriptorPath, f.output, { version: "2", revision: "rev2" }).stale).toContain("engine:identity");

    for (const pdf of ["cv.html", "receipt.json", "cover.txt"]) {
      const bad = fixture(), raw = yaml.load(readFileSync(bad.descriptorPath, "utf8")) as any;
      raw.artifacts[1].pdf = pdf;
      writeFileSync(bad.descriptorPath, yaml.dump(raw));
      await expect(verifyPack(bad.descriptorPath, bad.output, { engineVersion: "1", engineRevision: "rev", deps: bad.deps })).rejects.toThrow(/PDF|output paths/);
      expect(existsSync(bad.output)).toBe(false);
    }
    const folded = fixture(), raw = yaml.load(readFileSync(folded.descriptorPath, "utf8")) as any;
    raw.artifacts[0].pdf = "pack.pdf"; raw.artifacts[1].pdf = "PACK.PDF";
    writeFileSync(folded.descriptorPath, yaml.dump(raw));
    await expect(verifyPack(folded.descriptorPath, folded.output, { engineVersion: "1", engineRevision: "rev", deps: folded.deps })).rejects.toThrow(/output paths/);
  });

  it("leaves no candidate on a blocking failure or interrupted render", async () => {
    const blocked = fixture();
    await expect(verifyPack(blocked.descriptorPath, blocked.output, { engineVersion: "1", engineRevision: "rev", deps: { ...blocked.deps, blockingChecks: async () => [{ id: "claims", severity: "blocking", ok: false, messages: ["bad claim"] }] } })).rejects.toThrow(/blocking/);
    expect(existsSync(blocked.output)).toBe(false);
    const interrupted = fixture();
    await expect(verifyPack(interrupted.descriptorPath, interrupted.output, { engineVersion: "1", engineRevision: "rev", deps: { ...interrupted.deps, render: async () => { throw new Error("No Chrome"); } } })).rejects.toThrow(/No Chrome/);
    expect(existsSync(interrupted.output)).toBe(false);
  });

  it("leaves no candidate when Poppler is missing after a render", async () => {
    const f = fixture();
    await expect(verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: { ...f.deps, extractText: async () => { throw new Error("pdftotext not found"); } } })).rejects.toThrow(/pdftotext/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("blocks a PDF outside its declared page policy", async () => {
    const f = fixture();
    await expect(verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: { ...f.deps, pageCount: async () => 3 } })).rejects.toThrow(/declared maximum/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("removes the staged transaction when receipt writing is interrupted", async () => {
    const f = fixture();
    await expect(verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: { ...f.deps, writeReceipt: () => { throw new Error("interrupted write"); } } })).rejects.toThrow(/interrupted write/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("fails closed for missing inputs and concurrent publication", async () => {
    const missing = fixture();
    unlinkSync(missing.paths.policy);
    await expect(verifyPack(missing.descriptorPath, missing.output, { engineVersion: "1", engineRevision: "rev", deps: missing.deps })).rejects.toThrow();
    expect(existsSync(missing.output)).toBe(false);

    const concurrent = fixture();
    const results = await Promise.allSettled([
      verifyPack(concurrent.descriptorPath, concurrent.output, { engineVersion: "1", engineRevision: "rev", deps: concurrent.deps }),
      verifyPack(concurrent.descriptorPath, concurrent.output, { engineVersion: "1", engineRevision: "rev", deps: concurrent.deps }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(existsSync(join(concurrent.output, "receipt.json"))).toBe(true);
  });

  it("fails closed for empty or malformed descriptors and invalid advisory findings", async () => {
    const malformed = fixture();
    writeFileSync(malformed.descriptorPath, "artifacts: [");
    await expect(verifyPack(malformed.descriptorPath, malformed.output, { engineVersion: "1", engineRevision: "rev", deps: malformed.deps })).rejects.toThrow(/descriptor/);
    expect(existsSync(malformed.output)).toBe(false);

    const empty = fixture();
    const descriptor = yaml.load(readFileSync(empty.descriptorPath, "utf8")) as any;
    descriptor.artifacts = [];
    writeFileSync(empty.descriptorPath, yaml.dump(descriptor));
    await expect(verifyPack(empty.descriptorPath, empty.output, { engineVersion: "1", engineRevision: "rev", deps: empty.deps })).rejects.toThrow(/artifacts/);
    expect(existsSync(empty.output)).toBe(false);

    const advisory = fixture();
    await expect(verifyPack(advisory.descriptorPath, advisory.output, {
      engineVersion: "1",
      engineRevision: "rev",
      deps: { ...advisory.deps, advisoryChecks: async () => [{ id: "editorial", severity: "advisory", ok: false, messages: ["review"] }] },
    })).rejects.toThrow(/disposition/);
    expect(existsSync(advisory.output)).toBe(false);
  });

  it("rejects a source mutation during verification instead of binding mixed generations", async () => {
    const f = fixture();
    let mutated = false;
    const render = async (_html: string, pdf: string) => {
      writeFileSync(pdf, "%PDF exact");
      if (!mutated) { writeFileSync(f.paths.preferences, "changed during render"); mutated = true; }
    };
    await expect(verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: { ...f.deps, render } })).rejects.toThrow(/changed during verification/);
    expect(existsSync(f.output)).toBe(false);
  });

  it("rejects a descriptor generation swap after parsing the exact hashed bytes", async () => {
    const f = fixture();
    const original = readFileSync(f.descriptorPath, "utf8");
    let changed = false;
    await expect(verifyPack(f.descriptorPath, f.output, { engineVersion: "1", engineRevision: "rev", deps: {
      ...f.deps,
      render: async (_html, pdf) => { writeFileSync(pdf, "%PDF exact"); if (!changed) { writeFileSync(f.descriptorPath, `${original}\n# swapped generation\n`); changed = true; } },
    } })).rejects.toThrow(/bound inputs changed/);
    expect(existsSync(f.output)).toBe(false);
  });
});
