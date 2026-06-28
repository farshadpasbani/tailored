import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome } from "../render/chrome.js";

const cli = "dist/cli.js";
const ex = "examples/alex-rivers";
const pdf = join(tmpdir(), `ats-cli-${process.pid}.pdf`);

function run(args: string[]) {
  try { return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) }; }
  catch (e: any) { return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
}

// Build-dependent integration test: needs the built CLI, a Chrome to render, and poppler to extract.
const hasPoppler = (() => { try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();
const canRun = existsSync(cli) && Boolean(findChrome()) && hasPoppler;

describe.skipIf(!canRun)("tailored ats CLI", () => {
  it("passes the example CV against the example jd", () => {
    run(["render", `${ex}/cv.html`, pdf]);
    const r = run(["ats", pdf, "--jd", `${ex}/jd.yaml`]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/PASS: ats/);
  });
  it("fails and lists the missing must-have", () => {
    run(["render", `${ex}/cv.html`, pdf]);
    const bad = join(tmpdir(), `bad-jd-${process.pid}.yaml`);
    writeFileSync(bad, "role: X\nmustHave:\n  - cobol\n");
    const r = run(["ats", pdf, "--jd", bad]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/cobol/);
  });
});
