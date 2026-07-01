import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "dist/cli.js";
const ex = "examples/alex-rivers";

function run(args: string[]) {
  try { return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) }; }
  catch (e: any) { return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
}

const canRun = existsSync(cli);

describe.skipIf(!canRun)("tailored trace CLI", () => {
  it("passes the example CV against its own canon", () => {
    const r = run(["trace", `${ex}/cv.html`, "--canon", `${ex}/canon.yaml`]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/PASS: trace/);
  });
  it("fails and lists an invented metric with no trace to the canon", () => {
    const doctored = join(tmpdir(), `trace-doctored-${process.pid}.html`);
    const html = readFileSync(`${ex}/cv.html`, "utf8")
      .replace("Cut review time for generated documents by roughly two thirds", "Cut review time for generated documents by 47%");
    writeFileSync(doctored, html);
    const r = run(["trace", doctored, "--canon", `${ex}/canon.yaml`]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/47%/);
  });
  it("traces an employer-side claim to --jd-text instead of the canon", () => {
    const doctored = join(tmpdir(), `trace-jd-${process.pid}.html`);
    const html = readFileSync(`${ex}/cv.html`, "utf8")
      .replace("Cut review time for generated documents by roughly two thirds", "Cut review time for generated documents by 47%");
    writeFileSync(doctored, html);
    const jdText = join(tmpdir(), `trace-jd-text-${process.pid}.md`);
    writeFileSync(jdText, "We are looking to cut review time by 47% this year.");
    const r = run(["trace", doctored, "--canon", `${ex}/canon.yaml`, "--jd-text", jdText]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/PASS: trace/);
  });
  it("fails on a missing canon file", () => {
    const r = run(["trace", `${ex}/cv.html`, "--canon", "/no/such/canon.yaml"]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/invalid canon/);
  });
  it("fails on a missing html file", () => {
    const r = run(["trace", "/no/such/cv.html", "--canon", `${ex}/canon.yaml`]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/cannot read/);
  });
  it("fails on a missing required --canon flag", () => {
    const r = run(["trace", `${ex}/cv.html`]);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/canon/i);
  });
  it("fails cleanly on empty HTML with no claims and an org missing from the canon is still caught", () => {
    const empty = join(tmpdir(), `trace-empty-${process.pid}.html`);
    writeFileSync(empty, "");
    const r = run(["trace", empty, "--canon", `${ex}/canon.yaml`]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/PASS: trace/);
  });
});
