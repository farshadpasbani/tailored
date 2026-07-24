import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const fixtureDir = mkdtempSync(join(tmpdir(), "tailored-migrate-cli-"));

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("migrate-canon CLI", () => {
  it("accepts legacy input only with an explicit migration warning", () => {
    const source = join(fixtureDir, "legacy-warning.yaml");
    writeFileSync(source, "identity:\n  name: Alex Rivers\n  role: AI Engineer\n");
    const result = spawnSync(process.execPath, ["dist/cli.js", "validate", source], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/warn.*legacy schemaVersion 1.*migrate-canon/i);
  });

  it("writes reloadable v2 YAML and is byte-idempotent", () => {
    const source = join(fixtureDir, "canon-v1.yaml");
    const first = join(fixtureDir, "canon-v2.yaml");
    const second = join(fixtureDir, "canon-v2-again.yaml");
    writeFileSync(source, [
      "identity:",
      "  name: Alex Rivers",
      "  role: AI Engineer",
      "verifiedFacts:",
      "  launch:",
      "    verifiedOn: '2026-07-12'",
      "    points:",
      "      - Completed 58 gate runs.",
      "",
    ].join("\n"));

    const firstRun = spawnSync(process.execPath, ["dist/cli.js", "migrate-canon", source, first], { cwd: root, encoding: "utf8" });
    const secondRun = spawnSync(process.execPath, ["dist/cli.js", "migrate-canon", first, second], { cwd: root, encoding: "utf8" });

    expect(firstRun.status).toBe(0);
    expect(secondRun.status).toBe(0);
    expect(readFileSync(second, "utf8")).toBe(readFileSync(first, "utf8"));
    expect((yaml.load(readFileSync(first, "utf8")) as { schemaVersion: number }).schemaVersion).toBe(2);
  });

  it("refuses an unmapped namespace and leaves no output", () => {
    const source = join(fixtureDir, "unknown.yaml");
    const output = join(fixtureDir, "must-not-exist.yaml");
    writeFileSync(source, "identity:\n  name: Alex Rivers\n  role: AI Engineer\ndraftingGudance:\n  summary: Keep me.\n");

    const result = spawnSync(process.execPath, ["dist/cli.js", "migrate-canon", source, output], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/draftingGudance.*unmapped/i);
    expect(() => readFileSync(output, "utf8")).toThrow();
  });

  it("fails cleanly for a missing input", () => {
    const result = spawnSync(process.execPath, ["dist/cli.js", "migrate-canon", join(fixtureDir, "missing.yaml")], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/could not read\/parse yaml/i);
  });
});
