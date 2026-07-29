import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "dist/cli.js";
const ex = "examples/alex-rivers/cv.html";

// Both streams, on both paths: the detail lines go to stderr even when the command exits 0,
// and a silenced check printing there is exactly what these tests have to see.
function run(args: string[]) {
  const result = spawnSync("node", [cli, ...args], { encoding: "utf8" });
  return { code: result.status ?? 1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
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
      body { font-size: 10pt; line-height: 1.32; }
    </style></head><body>
      <p class="summary">${"word ".repeat(61).trim()}</p>
    </body></html>`);
    const r = run(["impact", bad]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/summary/i);
  });

  it("prints nothing for a silenced check, so the report agrees with the exit code", () => {
    // At the merge base the readability messages were printed unconditionally: a document
    // failing only the font floor printed the violation, said it was clean, and exited 0.
    const tiny = join(tmpdir(), `impact-tiny-font-${process.pid}.html`);
    writeFileSync(tiny, `<!doctype html><html><head><style>
      @page { size: A4; margin: 12mm 14mm; }
      body { font-size: 5pt; line-height: 1.4; }
    </style></head><body><p>Nothing else to see.</p></body></html>`);
    const silenced = run(["impact", tiny, "--skip-min-font"]);
    expect(silenced.code).toBe(0);
    expect(silenced.out).not.toMatch(/font-size/);
    expect(silenced.out).toMatch(/PASS: impact/);
    // The same document without the flag still fails on the same floor.
    const enforced = run(["impact", tiny]);
    expect(enforced.code).toBe(1);
    expect(enforced.out).toMatch(/body font-size 5pt is below the floor of 9pt/);
    expect(enforced.out).toMatch(/impact: 1 violation\(s\)/);
  });

  it("counts only the checks it reports", () => {
    // A silenced check must not inflate the violation count either.
    const bad = join(tmpdir(), `impact-count-${process.pid}.html`);
    writeFileSync(bad, `<!doctype html><html><head><style>
      @page { size: A4; margin: 3mm 3mm; }
      body { font-size: 6pt; line-height: 1.05; }
    </style></head><body><p>Nothing else to see.</p></body></html>`);
    expect(run(["impact", bad]).out).toMatch(/impact: 3 violation\(s\)/);
    expect(run(["impact", bad, "--skip-min-font"]).out).toMatch(/impact: 2 violation\(s\)/);
  });

  it("silences a check via its flag", () => {
    const bad = join(tmpdir(), `impact-silenced-${process.pid}.html`);
    writeFileSync(bad, `<!doctype html><html><head><style>
      @page { size: A4; margin: 10mm 14mm; }
      body { font-size: 10pt; line-height: 1.32; }
    </style></head><body>
      <p class="summary">${"word ".repeat(61).trim()}</p>
    </body></html>`);
    const r = run(["impact", bad, "--skip-summary-ceiling"]);
    expect(r.code).toBe(0);
  });
});
