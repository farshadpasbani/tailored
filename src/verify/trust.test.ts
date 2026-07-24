import { createHash } from "node:crypto";
import fs, { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_ADVISORY_GATES, REQUIRED_BLOCKING_GATES, VerifyPolicySchema } from "../policy/verify.js";
import { AttestationSchema, CorpusDescriptorSchema, snapshotFinalCorpus, WaiverSchema } from "./trust.js";
import { FindingSchema } from "./receipt.js";
import { canonicalJson, sha256Bytes } from "./hash.js";

const digest = "a".repeat(64);
const policy = () => ({ schemaVersion: 1, gates: [
  ...REQUIRED_BLOCKING_GATES.map(id => ({ id, severity: "blocking" })),
  ...REQUIRED_ADVISORY_GATES.map(id => ({ id, severity: "advisory" })),
], thresholds: { atsMinimum: 0.8, fitMinimumConfidence: 0.5, fitMinimumScore: 0.8, minimumFontPt: 9, minimumMarginMm: 8, minimumLineHeight: 1.28, maximumSharedRuns: 0, maximumSignaturePhrases: 0 } });

describe("verify-pack trust schemas", () => {
  afterEach(() => vi.restoreAllMocks());
  it("requires the complete unique policy-owned gate registry", () => {
    expect(VerifyPolicySchema.safeParse(policy()).success).toBe(true);
    const missing = policy(); missing.gates.pop();
    expect(VerifyPolicySchema.safeParse(missing).success).toBe(false);
    const duplicate = policy(); duplicate.gates.push(duplicate.gates[0]);
    expect(VerifyPolicySchema.safeParse(duplicate).success).toBe(false);
    const wrongSeverity = policy(); wrongSeverity.gates[0].severity = "advisory";
    expect(VerifyPolicySchema.safeParse(wrongSeverity).success).toBe(false);
  });

  it("rejects arbitrary corpus, waiver, and attestation bytes", () => {
    expect(CorpusDescriptorSchema.safeParse({ schemaVersion: 1, members: [{ id: "one", path: "one.html", sha256: digest, status: "approved" }] }).success).toBe(true);
    expect(CorpusDescriptorSchema.safeParse({ schemaVersion: 1, members: [{ id: "one", path: "one.html", sha256: digest, status: "maybe" }] }).success).toBe(false);
    const waiverPayload = { schemaVersion: 1 as const, id: "w1", findingId: "editorial", packSha256: digest, policySha256: digest, findingSha256: digest, approvedBy: "Reviewer", approvedOn: "2026-07-13", reason: "accepted risk" };
    expect(WaiverSchema.safeParse({ ...waiverPayload, sha256: sha256Bytes(canonicalJson(waiverPayload)) }).success).toBe(true);
    expect(WaiverSchema.safeParse({ ...waiverPayload, sha256: digest }).success).toBe(false);
    expect(WaiverSchema.safeParse("waiver").success).toBe(false);
    const attestationPayload = { schemaVersion: 1 as const, id: "a1", findingId: "editorial", packSha256: digest, policySha256: digest, findingSha256: digest, approvedBy: "Reviewer", approvedOn: "2026-07-13", statement: "reviewed" };
    expect(AttestationSchema.safeParse({ ...attestationPayload, sha256: sha256Bytes(canonicalJson(attestationPayload)) }).success).toBe(true);
    expect(AttestationSchema.safeParse({ id: "a1" }).success).toBe(false);
  });

  it("binds accepted and waived dispositions to typed resolutions", () => {
    const base = { id: "editorial", severity: "advisory", ok: false, messages: ["review"] } as const;
    expect(FindingSchema.safeParse({ ...base, disposition: "review-required" }).success).toBe(true);
    expect(FindingSchema.safeParse({ ...base, disposition: "accepted" }).success).toBe(false);
    expect(FindingSchema.safeParse({ ...base, disposition: "accepted", resolution: { attestationId: "a1" } }).success).toBe(true);
    expect(FindingSchema.safeParse({ ...base, disposition: "waived", resolution: { waiverId: "w1" } }).success).toBe(true);
    expect(FindingSchema.safeParse({ ...base, disposition: "anything" }).success).toBe(false);
  });

  it("filters every non-final lifecycle before touching hostile paths", () => {
    const root = corpusRoot();
    writeDescriptor(root.descriptor, ["current", "draft", "skipped", "abandoned", "superseded", "withdrawn"].map((status, index) => ({
      id: `ignored-${index}`, path: index % 2 ? `../../outside/missing-${index}.html` : `missing-${index}.html`, sha256: digest, status,
    })));
    const authorityCalls: string[] = [];
    vi.spyOn(fs, "lstatSync").mockImplementation(((path: fs.PathLike) => { authorityCalls.push(String(path)); return originalFs.lstatSync(path); }) as typeof fs.lstatSync);
    vi.spyOn(fs, "realpathSync").mockImplementation(((path: fs.PathLike) => { authorityCalls.push(String(path)); return originalFs.realpathSync(path); }) as typeof fs.realpathSync);
    vi.spyOn(fs, "openSync").mockImplementation(((path: fs.PathLike, flags: number, mode?: number) => { authorityCalls.push(String(path)); return originalFs.openSync(path, flags, mode); }) as typeof fs.openSync);
    expect(snapshotFinalCorpus(root.pack, root.descriptor, [])).toMatchObject({ members: [] });
    expect(authorityCalls.some(path => path.includes("missing-"))).toBe(false);
  });

  it("excludes only the current physical path and retains a byte-identical final", () => {
    const root = corpusRoot(), current = join(root.pack, "cv.html"), twin = join(root.vault, "Applied", "prior.html");
    mkdirSync(dirname(twin), { recursive: true }); writeFileSync(current, "same prose"); writeFileSync(twin, "same prose");
    writeDescriptor(root.descriptor, [
      { id: "current-copy", path: current, sha256: hash("same prose"), status: "approved" },
      { id: "byte-twin", path: twin, sha256: hash("same prose"), status: "submitted" },
    ]);
    const result = snapshotFinalCorpus(root.pack, root.descriptor, [current]);
    expect(result.members.map(member => member.id)).toEqual(["byte-twin"]);
    expect(result.members[0].bytes.toString()).toBe("same prose");
  });

  it("sorts nested finals and rejects stale, missing, unreadable, escaped, symlinked, cyclic and duplicate authority", () => {
    const make = () => { const root = corpusRoot(), prior = join(root.vault, "prior.html"); writeFileSync(prior, "prior"); return { ...root, prior }; };
    for (const probe of ["stale", "missing", "unreadable", "escape", "symlink"] as const) {
      const root = make(); let path = root.prior, sha256 = hash("prior");
      if (probe === "stale") sha256 = digest;
      if (probe === "missing") path = join(root.vault, "missing.html");
      if (probe === "unreadable") chmodSync(path, 0);
      if (probe === "escape") path = join(dirname(root.vault), "outside.html");
      if (probe === "symlink") { const link = join(root.vault, "link.html"); symlinkSync(path, link); path = link; }
      writeDescriptor(root.descriptor, [{ id: "prior", path, sha256, status: "approved" }]);
      expect(() => snapshotFinalCorpus(root.pack, root.descriptor, []), probe).toThrow(/corpus-eligibility/);
    }

    const root = make(), nested = join(root.vault, "nested.yaml");
    writeDescriptor(nested, [{ id: "back", path: root.descriptor, sha256: digest, status: "submitted", kind: "corpus" }]);
    writeDescriptor(root.descriptor, [{ id: "nested", path: nested, sha256: hash(readFileSync(nested)), status: "approved", kind: "corpus" }]);
    expect(() => snapshotFinalCorpus(root.pack, root.descriptor, [])).toThrow(/cycle/);

    expect(CorpusDescriptorSchema.safeParse({ schemaVersion: 1, members: [
      { id: "Prior", path: "ONE.html", sha256: digest, status: "approved" },
      { id: "prior", path: "one.html", sha256: digest, status: "submitted" },
    ] }).success).toBe(false);
  });

  it("returns the same nested member order for descriptor permutations", () => {
    const run = (reverse: boolean) => {
      const root = corpusRoot(), applied = join(root.vault, "Applied"), nested = join(applied, "nested.yaml"); mkdirSync(applied);
      const docs = ["zeta", "alpha"].map(id => { const path = join(applied, `${id}.html`); writeFileSync(path, id); return { id, path, sha256: hash(id), status: "submitted" }; });
      writeDescriptor(nested, reverse ? [...docs].reverse() : docs);
      writeDescriptor(root.descriptor, [{ id: "history", path: nested, sha256: hash(readFileSync(nested)), status: "approved", kind: "corpus" }]);
      return snapshotFinalCorpus(root.pack, root.descriptor, []).members.map(member => member.id);
    };
    expect(run(false)).toEqual(["history", "history/alpha", "history/zeta"]);
    expect(run(true)).toEqual(run(false));
  });

  it("rejects symlinked bases, descriptors and parents plus malformed nesting and physical duplicates", () => {
    const descriptorLink = corpusRoot(), actualDescriptor = join(descriptorLink.pack, "actual.yaml");
    writeDescriptor(actualDescriptor, []); symlinkSync(actualDescriptor, descriptorLink.descriptor);
    expect(() => snapshotFinalCorpus(descriptorLink.pack, descriptorLink.descriptor, [])).toThrow(/symbolic link/);

    const parentLink = corpusRoot(), realDirectory = join(parentLink.vault, "real"); mkdirSync(realDirectory); writeFileSync(join(realDirectory, "prior.html"), "prior");
    symlinkSync(realDirectory, join(parentLink.vault, "linked"));
    writeDescriptor(parentLink.descriptor, [{ id: "prior", path: join(parentLink.vault, "linked/prior.html"), sha256: hash("prior"), status: "approved" }]);
    expect(() => snapshotFinalCorpus(parentLink.pack, parentLink.descriptor, [])).toThrow(/symbolic link/);

    const baseLink = corpusRoot(), linkedVault = join(tmpdir(), `tailored-linked-vault-${Date.now()}`); symlinkSync(baseLink.vault, linkedVault);
    expect(() => snapshotFinalCorpus(join(linkedVault, "pack"), join(linkedVault, "pack/corpus.yaml"), [])).toThrow(/trust base/);

    const malformed = corpusRoot(), nested = join(malformed.vault, "nested.yaml"); writeFileSync(nested, "members: [");
    writeDescriptor(malformed.descriptor, [{ id: "nested", path: nested, sha256: hash(readFileSync(nested)), status: "approved", kind: "corpus" }]);
    expect(() => snapshotFinalCorpus(malformed.pack, malformed.descriptor, [])).toThrow(/invalid nested corpus/);

    const duplicate = corpusRoot(), prior = join(duplicate.vault, "prior.html"); writeFileSync(prior, "prior");
    writeDescriptor(duplicate.descriptor, [
      { id: "one", path: prior, sha256: hash("prior"), status: "approved" },
      { id: "two", path: `${duplicate.vault}/./prior.html`, sha256: hash("prior"), status: "submitted" },
    ]);
    expect(() => snapshotFinalCorpus(duplicate.pack, duplicate.descriptor, [])).toThrow(/duplicate member path/);
  });

  it("binds root and nested descriptor bytes to the validated regular-file identity", () => {
    const root = corpusRoot(), outside = join(dirname(root.vault), `outside-${Date.now()}.yaml`); writeDescriptor(outside, []);
    const restoreRoot = swapAtOpen(root.descriptor, () => symlinkSync(outside, root.descriptor));
    writeDescriptor(root.descriptor, []);
    expect(() => snapshotFinalCorpus(root.pack, root.descriptor, [])).toThrow(/corpus-eligibility/);
    restoreRoot(); vi.restoreAllMocks();

    const nestedRoot = corpusRoot(), nested = join(nestedRoot.vault, "nested.yaml"), replacement = join(dirname(nestedRoot.vault), `nested-outside-${Date.now()}.yaml`);
    writeDescriptor(nested, []); writeDescriptor(replacement, []);
    writeDescriptor(nestedRoot.descriptor, [{ id: "nested", path: nested, sha256: hash(readFileSync(replacement)), status: "approved", kind: "corpus" }]);
    const restoreNested = swapAtOpen(nested, () => symlinkSync(replacement, nested));
    expect(() => snapshotFinalCorpus(nestedRoot.pack, nestedRoot.descriptor, [])).toThrow(/corpus-eligibility/);
    restoreNested();
  });

  it("rejects symlink and regular-file replacement at the eligible-member open seam and closes descriptors", () => {
    for (const replacement of ["symlink", "regular"] as const) {
      const root = corpusRoot(), member = join(root.vault, "prior.html"), outside = join(dirname(root.vault), `outside-${replacement}-${Date.now()}.html`);
      writeFileSync(member, "before"); writeFileSync(outside, "declared bytes");
      writeDescriptor(root.descriptor, [{ id: "prior", path: member, sha256: hash("declared bytes"), status: "submitted" }]);
      const restore = swapAtOpen(member, () => replacement === "symlink" ? symlinkSync(outside, member) : writeFileSync(member, "declared bytes"));
      const close = vi.spyOn(fs, "closeSync");
      expect(() => snapshotFinalCorpus(root.pack, root.descriptor, [])).toThrow(/corpus-eligibility/);
      expect(close).toHaveBeenCalled(); restore(); vi.restoreAllMocks();
    }
  });

  it("closes every opened descriptor when an authority read fails", () => {
    const root = corpusRoot(), member = join(root.vault, "prior.html"); writeFileSync(member, "prior");
    writeDescriptor(root.descriptor, [{ id: "prior", path: member, sha256: hash("prior"), status: "approved" }]);
    const read = originalFs.readFileSync, close = vi.spyOn(fs, "closeSync"); let fdReads = 0;
    vi.spyOn(fs, "readFileSync").mockImplementation(((path: fs.PathOrFileDescriptor, options?: unknown) => {
      if (typeof path === "number" && ++fdReads === 2) throw new Error("injected read failure");
      return read(path, options as never);
    }) as typeof fs.readFileSync);
    expect(() => snapshotFinalCorpus(root.pack, root.descriptor, [])).toThrow(/descriptor read failed/);
    expect(close).toHaveBeenCalledTimes(2);
  });
});

const originalFs = { lstatSync: fs.lstatSync, realpathSync: fs.realpathSync, openSync: fs.openSync, readFileSync: fs.readFileSync };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function corpusRoot() {
  const vault = mkdtempSync(join(tmpdir(), "tailored-vault-")), pack = join(vault, "pack"), descriptor = join(pack, "corpus.yaml");
  mkdirSync(pack); return { vault, pack, descriptor };
}
function writeDescriptor(path: string, members: unknown[]) {
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, yaml.dump({ schemaVersion: 1, members }));
}
function swapAtOpen(target: string, replacement: () => void): () => void {
  const backup = `${target}.before`, open = originalFs.openSync, read = originalFs.readFileSync; let swapped = false;
  const swap = () => { if (!swapped) { renameSync(target, backup); replacement(); swapped = true; } };
  vi.spyOn(fs, "openSync").mockImplementation(((path: fs.PathLike, flags: number, mode?: number) => {
    if (String(path) === target) swap();
    return open(path, flags, mode);
  }) as typeof fs.openSync);
  vi.spyOn(fs, "readFileSync").mockImplementation(((path: fs.PathOrFileDescriptor, options?: unknown) => {
    if (typeof path !== "number" && String(path) === target) swap();
    return read(path, options as never);
  }) as typeof fs.readFileSync);
  return () => { if (swapped) { unlinkSync(target); renameSync(backup, target); } };
}
