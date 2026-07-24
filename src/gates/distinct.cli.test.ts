import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "dist/cli.js";

function run(args: string[]) {
  try { return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) }; }
  catch (e: any) { return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
}

const canRun = existsSync(cli);

describe.skipIf(!canRun)("tailored distinct CLI", () => {
  const dir = join(tmpdir(), `distinct-cli-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const doc = (p: string) => `<!doctype html><html><body><p>${p}</p></body></html>`;
  const target = join(dir, "cover.html");
  const priorFresh = join(dir, "prior-fresh.html");
  const priorCopy = join(dir, "prior-copy.html");
  writeFileSync(target, doc("completely fresh prose written for this one role and company today"));
  writeFileSync(priorFresh, doc("entirely different words describing another application from last week instead"));
  writeFileSync(priorCopy, doc("completely fresh prose written for this one role and company today"));

  it("skips a prior that is the target file itself (a ../*/cover.html glob always self-matches)", () => {
    const r = run(["distinct", target, target, priorFresh]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/PASS: distinct/);
    expect(r.out).toMatch(/skipping the document itself/i);
  });

  it("still fails when the target is the only prior after self-exclusion and shares nothing? no - passes with zero remaining priors", () => {
    const r = run(["distinct", target, target]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/0 prior/);
  });

  it("still catches genuine verbatim reuse from a distinct file", () => {
    const r = run(["distinct", target, target, priorCopy]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/FAIL: distinct/);
  });
});
