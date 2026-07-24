import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("private field replay", () => {
  it("fails by default when discovery finds no replayable artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "tailored-replay-"));
    const result = spawnSync(process.execPath, [resolve("scripts/replay-claim-integrity.mjs"), directory], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ attempted: 0, failed: 1 });
  });

  it("fails non-vacuously when no case was attempted or a required group is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "tailored-replay-"));
    const manifest = join(directory, "manifest.yaml"), output = join(directory, "result.json");
    writeFileSync(manifest, "schemaVersion: 1\nrequiredGroups: [required-field-group]\ncases: []\n");
    const result = spawnSync(process.execPath, [resolve("scripts/replay-claim-integrity.mjs"), directory, "--manifest", manifest, "--output", output], { encoding: "utf8" });
    expect(result.status).toBe(1);
    const summary = JSON.parse(readFileSync(output, "utf8"));
    expect(summary).toMatchObject({ requiredGroups: 1, attemptedGroups: 0, attempted: 0 });
    expect(summary.failed).toBeGreaterThan(0);
  });

  it("does not count malformed setup as a successful expected-negative gate case", () => {
    const directory = mkdtempSync(join(tmpdir(), "tailored-replay-"));
    const artifact = join(directory, "cv.html"), canon = join(directory, "canon.yaml"), evidence = join(directory, "evidence.yaml");
    writeFileSync(artifact, "<p>text</p>"); writeFileSync(canon, "not: [valid"); writeFileSync(evidence, "also: [invalid");
    const manifest = join(directory, "manifest.yaml");
    writeFileSync(manifest, `schemaVersion: 1\nrequiredGroups: [required]\ncases:\n  - group: required\n    artifact: ${artifact}\n    canon: ${canon}\n    evidence: ${evidence}\n    artifactId: cv\n    expect: fail\n    expectedIssueKinds: [empty-document]\n`);
    const result = spawnSync(process.execPath, [resolve("scripts/replay-claim-integrity.mjs"), directory, "--manifest", manifest], { encoding: "utf8" });
    expect(result.status).toBe(1);
    const summary = JSON.parse(result.stdout);
    expect(summary).toMatchObject({ attempted: 1, passed: 0 });
    expect(summary.failed).toBeGreaterThan(0);
  });

  it("requires an actual named gate issue for every expected-fail case", () => {
    const directory = mkdtempSync(join(tmpdir(), "tailored-replay-"));
    const artifact = join(directory, "cv.html"), canon = join(directory, "canon.yaml"), evidence = join(directory, "evidence.yaml");
    writeFileSync(artifact, "<p>text</p>"); writeFileSync(canon, "not: [valid"); writeFileSync(evidence, "also: [invalid");
    const manifest = join(directory, "manifest.yaml");
    writeFileSync(manifest, `schemaVersion: 1\nrequiredGroups: [required]\ncases:\n  - group: required\n    artifact: ${artifact}\n    canon: ${canon}\n    evidence: ${evidence}\n    artifactId: cv\n    expect: fail\n`);
    const result = spawnSync(process.execPath, [resolve("scripts/replay-claim-integrity.mjs"), directory, "--manifest", manifest], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ attempted: 1, passed: 0 });
  });
});
