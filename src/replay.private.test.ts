import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";

function vaultFixture() {
  const vault = mkdtempSync(join(tmpdir(), "tailored-replay-vault-"));
  const pack = join(vault, "applications", "example");
  mkdirSync(join(pack, "archive"), { recursive: true });
  writeFileSync(join(vault, "canon.yaml"), "identity:\n  name: Alex Rivers\n  role: Engineer\n");
  writeFileSync(join(pack, "cv.html"), "<p>original</p>");
  writeFileSync(join(pack, "archive", "jd.txt"), "archived");
  writeFileSync(join(pack, "evidence.yaml"), yaml.dump({
    artifacts: [{ id: "cv", path: "cv.html" }],
    employerSources: [{ id: "employer.jd", archivePath: "archive/jd.txt" }],
    claims: [],
  }));
  return { vault, html: join(pack, "cv.html") };
}

function runReplay(vault: string, verifier: string, env: Record<string, string> = {}) {
  try {
    return { code: 0, out: execFileSync(process.execPath, ["scripts/replay-claim-integrity.mjs", vault], { encoding: "utf8", env: { ...process.env, TAILORED_REPLAY_CLI: verifier, ...env } }) };
  } catch (error: any) {
    return { code: error.status ?? 1, out: (error.stdout ?? "") + (error.stderr ?? "") };
  }
}

describe("private replay isolation", () => {
  it("runs against temp copies and detects a mutating verifier without touching originals", () => {
    const fixture = vaultFixture(), verifier = join(fixture.vault, "mutate-temp.mjs");
    writeFileSync(verifier, "import fs from 'node:fs'; const html=process.argv[3]; fs.appendFileSync(html,'mutated'); process.exit(0);");
    const before = readFileSync(fixture.html, "utf8"), result = runReplay(fixture.vault, verifier);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/"inputMutations":1/);
    expect(readFileSync(fixture.html, "utf8")).toBe(before);
  });

  it("re-manifests the actual vault and fails if a child changes a consumed byte", () => {
    const fixture = vaultFixture(), verifier = join(fixture.vault, "mutate-vault.mjs"), before = readFileSync(fixture.html, "utf8");
    writeFileSync(verifier, "import fs from 'node:fs'; fs.appendFileSync(process.env.MUTATE_TARGET,'mutated'); process.exit(0);");
    const result = runReplay(fixture.vault, verifier, { MUTATE_TARGET: fixture.html });
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/"vaultMutations":1/);
    writeFileSync(fixture.html, before);
  });
});
