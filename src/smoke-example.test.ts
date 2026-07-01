import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCanon } from "./canon/load.js";
import { loadJd } from "./jd/load.js";
import { lintAiTells } from "./gates/aiTell.js";
import { scanProtected } from "./gates/ipGuard.js";
import { analyzeAts } from "./gates/ats.js";
import { canonToText, analyzeFit } from "./gates/fit.js";
import { analyzeTrace, extractTitledEntries, extractProjectNames } from "./gates/trace.js";
import { analyzeImpact, defaultImpactOptions } from "./gates/impact.js";
import { extractPdfText } from "./gates/run.js";
import { renderToPdf, findChrome } from "./render/chrome.js";

describe("alex-rivers example", () => {
  it("has a valid canon", () => { expect(loadCanon("examples/alex-rivers/canon.yaml").ok).toBe(true); });
  it("ships HTML with zero AI tells", () => {
    for (const f of ["cv.html", "cover.html"]) expect(lintAiTells(readFileSync(`examples/alex-rivers/${f}`, "utf8"))).toEqual([]);
  });
  it("leaks none of its own protected topics into the rendered HTML", () => {
    const r = loadCanon("examples/alex-rivers/canon.yaml"); expect(r.ok).toBe(true);
    if (r.ok) for (const f of ["cv.html", "cover.html"]) expect(scanProtected(readFileSync(`examples/alex-rivers/${f}`, "utf8"), r.data.protectedTopics)).toEqual([]);
  });
  it("has a valid jd", () => { expect(loadJd("examples/alex-rivers/jd.yaml").ok).toBe(true); });
  it("verdicts APPLY on the fit gate against its example jd", () => {
    const canon = loadCanon("examples/alex-rivers/canon.yaml");
    const jd = loadJd("examples/alex-rivers/jd.yaml");
    expect(canon.ok).toBe(true);
    expect(jd.ok).toBe(true);
    if (!canon.ok || !jd.ok) return;
    const r = analyzeFit(canonToText(canon.data), jd.data, { apply: 0.8, floor: 0.5 });
    expect(r.verdict).toBe("APPLY");
  });
  it("verdicts SKIP when the jd's must-haves are absent from the example canon", () => {
    const canon = loadCanon("examples/alex-rivers/canon.yaml");
    expect(canon.ok).toBe(true);
    if (!canon.ok) return;
    const jd = { role: "X", mustHave: ["cobol", "fortran", "assembly"], niceToHave: [], synonyms: {} };
    const r = analyzeFit(canonToText(canon.data), jd, { apply: 0.8, floor: 0.5 });
    expect(r.verdict).toBe("SKIP");
  });
  it("passes the trace gate: every claim in cv.html traces to its own canon", () => {
    const r = loadCanon("examples/alex-rivers/canon.yaml"); expect(r.ok).toBe(true);
    if (r.ok) expect(analyzeTrace(readFileSync("examples/alex-rivers/cv.html", "utf8"), r.data, "").ok).toBe(true);
  });
  it("actually extracts entries from the example CV (the trace pass is not vacuous)", () => {
    const html = readFileSync("examples/alex-rivers/cv.html", "utf8");
    expect(extractTitledEntries(html).length).toBeGreaterThanOrEqual(1);
    expect(extractProjectNames(html).length).toBeGreaterThanOrEqual(1);
  });
  it("passes the impact lint gate", () => {
    expect(analyzeImpact(readFileSync("examples/alex-rivers/cv.html", "utf8"), defaultImpactOptions).ok).toBe(true);
  });
  it("every project year shown in the CV traces to the canon (nothing invented)", () => {
    const r = loadCanon("examples/alex-rivers/canon.yaml"); expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cv = readFileSync("examples/alex-rivers/cv.html", "utf8");
    for (const p of r.data.projects) {
      const entry = cv.match(new RegExp(`<div class="title">${p.name}:[\\s\\S]*?<div class="meta">([^<]*)</div>`));
      if (!entry) continue; // a canon project the CV chose not to show
      expect(p.year, `project ${p.name} shows a year in the CV`).toBeDefined();
      expect(entry[1].trim(), `project ${p.name} year matches the canon`).toBe(p.year);
    }
  });
});

// Build-dependent integration: needs a Chrome to render and poppler to extract.
const hasPoppler = (() => { try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();
const canRender = Boolean(findChrome()) && hasPoppler;

describe.skipIf(!canRender)("alex-rivers ats gate (rendered)", () => {
  it("passes the ats gate against its example jd", async () => {
    const jd = loadJd("examples/alex-rivers/jd.yaml");
    expect(jd.ok).toBe(true);
    if (!jd.ok) return;
    const pdf = join(tmpdir(), `tailored-smoke-ats-${process.pid}.pdf`);
    await renderToPdf("examples/alex-rivers/cv.html", pdf);
    expect(existsSync(pdf)).toBe(true);
    const ats = analyzeAts(await extractPdfText(pdf), jd.data, 0.8);
    expect(ats.ok).toBe(true);
    expect(ats.must.missing).toEqual([]);
  });
});
