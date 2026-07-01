import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "dist/cli.js";
const ex = "examples/alex-rivers/cv.html";

function run(args: string[]) {
  try { return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) }; }
  catch (e: any) { return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
}

const canRun = existsSync(cli);

describe.skipIf(!canRun)("tailored impact CLI", () => {
  it("passes the example CV", () => {
    const r = run(["impact", ex]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/PASS: impact/);
  });

  it("fails and reports the offending check for a CV over the summary ceiling", () => {
    const bad = join(tmpdir(), `impact-bad-${process.pid}.html`);
    writeFileSync(bad, `<!doctype html><html><head><style>
      @page { size: A4; margin: 10mm 14mm; }
      body { font-size: 10pt; }
    </style></head><body>
      <p class="summary">${"word ".repeat(61).trim()}</p>
    </body></html>`);
    const r = run(["impact", bad]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/summary/i);
  });

  it("silences a check via its flag", () => {
    const bad = join(tmpdir(), `impact-silenced-${process.pid}.html`);
    writeFileSync(bad, `<!doctype html><html><head><style>
      @page { size: A4; margin: 10mm 14mm; }
      body { font-size: 10pt; }
    </style></head><body>
      <p class="summary">${"word ".repeat(61).trim()}</p>
    </body></html>`);
    const r = run(["impact", bad, "--skip-summary-ceiling"]);
    expect(r.code).toBe(0);
  });
});
