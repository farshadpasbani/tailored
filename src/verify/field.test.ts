import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import { verifyPack, verifyReceiptFreshness } from "./pack.js";

const configured = (process.env.TAILORED_VERIFY_PACK_FIXTURES ?? "").split(",").map(value => value.trim()).filter(Boolean);
const configuredRoot = process.env.TAILORED_VERIFY_PACK_FIXTURE_ROOT?.trim();
const required = ["pack.yaml", "canon.yaml", "job-description.md", "requirements.yaml", "baseline-receipt.yaml", "evidence.yaml", "strategy.yaml", "research.yaml", "preferences.yaml", "policy.yaml", "corpus.yaml"];
const manifest = (directory: string) => {
  const result = new Map<string, string>();
  const walk = (path: string, prefix: string) => { for (const entry of readdirSync(path, { withFileTypes: true })) { const child = join(path, entry.name), name = join(prefix, entry.name); if (entry.isDirectory()) walk(child, name); else if (entry.isFile()) result.set(name, createHash("sha256").update(readFileSync(child)).digest("hex")); } };
  walk(directory, ""); return result;
};
const absolute = (base: string, path: string) => isAbsolute(path) ? path : resolve(base, path);
function boundInputs(descriptorPath: string): string[] {
  const descriptor: any = yaml.load(readFileSync(descriptorPath, "utf8")), base = dirname(descriptorPath), paths = new Set<string>([descriptorPath]);
  Object.values(descriptor.inputs).forEach(value => paths.add(absolute(base, String(value))));
  descriptor.artifacts.forEach((value: any) => paths.add(absolute(base, value.html)));
  (descriptor.waivers ?? []).forEach((value: string) => paths.add(absolute(base, value)));
  (descriptor.attestations ?? []).forEach((value: string) => paths.add(absolute(base, value)));
  const walkCorpus = (path: string) => {
    paths.add(path); const corpus: any = yaml.load(readFileSync(path, "utf8")), corpusBase = dirname(path);
    for (const member of corpus.members) { const memberPath = absolute(corpusBase, member.path); paths.add(memberPath); if ((member.kind ?? "document") === "corpus") walkCorpus(memberPath); }
  };
  walkCorpus(absolute(base, descriptor.corpus.descriptor)); return [...paths];
}

describe.skipIf(configured.length === 0)("private production verify-pack field fixtures", () => {
  for (const [index, directory] of configured.entries()) it(`verifies configured private pack ${index + 1} without source mutation`, async () => {
    const missing = required.filter(name => !existsSync(join(directory, name)));
    expect(missing, `configured fixture ${index + 1} is not a complete production pack`).toEqual([]);
    const before = manifest(directory);
    const temporary = mkdtempSync(join(process.env.TAILORED_VERIFY_PACK_OUTPUT_ROOT ?? tmpdir(), "tailored-private-field-"));
    try {
      const fixtureRelative = configuredRoot ? relative(resolve(configuredRoot), resolve(directory)) : undefined;
      if (fixtureRelative && (fixtureRelative === ".." || fixtureRelative.startsWith("../") || isAbsolute(fixtureRelative))) throw new Error("configured fixture is outside TAILORED_VERIFY_PACK_FIXTURE_ROOT");
      const copy = configuredRoot
        ? join(temporary, "fixture-root", fixtureRelative!)
        : join(temporary, "pack");
      if (configuredRoot) cpSync(resolve(configuredRoot), join(temporary, "fixture-root"), { recursive: true });
      else cpSync(directory, copy, { recursive: true });
      const descriptor = join(copy, "pack.yaml"), output = join(temporary, "candidate");
      const receipt = await verifyPack(descriptor, output);
      expect(receipt).toMatchObject({ kind: "tailored.verify-pack", state: "ready-for-human" });
      expect(verifyReceiptFreshness(receipt, descriptor, output)).toEqual({ fresh: true, stale: [] });
      for (const path of boundInputs(descriptor)) {
        const original = readFileSync(path); writeFileSync(path, Buffer.concat([original, Buffer.from("\n# freshness mutation\n")]));
        expect(verifyReceiptFreshness(receipt, descriptor, output).fresh, path).toBe(false); writeFileSync(path, original);
      }
      for (const binding of receipt.bindings.outputs) {
        const path = join(output, binding.file), original = readFileSync(path); writeFileSync(path, Buffer.concat([original, Buffer.from("mutation")]));
        expect(verifyReceiptFreshness(receipt, descriptor, output).fresh, binding.id).toBe(false); writeFileSync(path, original);
      }
    } finally { rmSync(temporary, { recursive: true, force: true }); }
    expect(manifest(directory)).toEqual(before);
  }, 60_000);
});
