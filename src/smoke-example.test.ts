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
