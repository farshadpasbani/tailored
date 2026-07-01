import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "dist/cli.js";
const ex = "examples/alex-rivers";

function run(args: string[]) {
  try { return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) }; }
  catch (e: any) { return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
}

// Build-dependent integration test: needs the built CLI.
const canRun = existsSync(cli);

describe.skipIf(!canRun)("tailored fit CLI", () => {
  it("verdicts APPLY for the example candidate against the example jd", () => {
    const r = run(["fit", "--jd", `${ex}/jd.yaml`, "--canon", `${ex}/canon.yaml`]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/APPLY/);
  });

  it("verdicts SKIP and exits 1 when must-have coverage is below the floor", () => {
    const bad = join(tmpdir(), `bad-fit-jd-${process.pid}.yaml`);
    writeFileSync(bad, "role: X\nmustHave:\n  - cobol\n  - fortran\n  - assembly\n");
    const r = run(["fit", "--jd", bad, "--canon", `${ex}/canon.yaml`]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/SKIP/);
    expect(r.out).toMatch(/cobol/);
  });

  it("fails fast when --floor exceeds --apply", () => {
    const r = run(["fit", "--jd", `${ex}/jd.yaml`, "--canon", `${ex}/canon.yaml`, "--apply", "0.5", "--floor", "0.9"]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/--floor/);
  });
});
