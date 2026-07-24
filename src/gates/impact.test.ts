import { describe, it, expect } from "vitest";
import { checkReadability, checkSummaryCeiling, checkDuplicateSentences, checkContrast, checkPersonConsistency, checkDatedEntries, checkBulletBounds, checkSkillDensity, analyzeImpact, defaultImpactOptions } from "./impact.js";

const cvWithFont = (fontPt: number, marginMm: string, lineHeight: string = "1.32") => `<!doctype html><html><head><style>
  @page { size: A4; margin: ${marginMm}; }
  body { font-size: ${fontPt}pt; line-height: ${lineHeight}; }
</style></head><body></body></html>`;

describe("checkReadability", () => {
  it("passes a body font-size, page margin, and line-height at or above the floor", () => {
    const r = checkReadability(cvWithFont(10, "10mm 14mm"), 9, 8, 1.28);
    expect(r.ok).toBe(true);
    expect(r.fontPt).toBe(10);
    expect(r.marginMm).toEqual([10, 14]);
    expect(r.lineHeight).toBe(1.32);
  });

  it("fails a body font-size compressed below the floor", () => {
    const r = checkReadability(cvWithFont(8.5, "10mm 14mm"), 9, 8, 1.28);
    expect(r.ok).toBe(false);
    expect(r.fontOk).toBe(false);
  });

  it("fails a page margin compressed below the floor", () => {
    const r = checkReadability(cvWithFont(10, "5mm 14mm"), 9, 8, 1.28);
    expect(r.ok).toBe(false);
    expect(r.marginOk).toBe(false);
  });

  it("fails a line-height compressed below the floor (the density loophole)", () => {
    const r = checkReadability(cvWithFont(10, "10mm 14mm", "1.06"), 9, 8, 1.28);
    expect(r.ok).toBe(false);
    expect(r.lineHeightOk).toBe(false);
    expect(r.lineHeight).toBe(1.06);
  });

  it("fails when the body declares no line-height at all", () => {
    const html = `<style>
      @page { size: A4; margin: 10mm 14mm; }
      body { font-size: 10pt; }
    </style>`;
    const r = checkReadability(html, 9, 8, 1.28);
    expect(r.ok).toBe(false);
    expect(r.lineHeight).toBeNull();
    expect(r.lineHeightOk).toBe(false);
  });

  it("treats a unit-carrying line-height (14pt) as undeclared rather than misreading it", () => {
    const r = checkReadability(cvWithFont(10, "10mm 14mm", "14pt"), 9, 8, 1.28);
    expect(r.lineHeight).toBeNull();
    expect(r.lineHeightOk).toBe(false);
  });

  it("reads the margin when the final @page declaration omits the optional semicolon", () => {
    const html = `<style>
      @page { size: A4; margin: 10mm 14mm }
      body { font-size: 10pt; line-height: 1.32 }
    </style>`;
    const r = checkReadability(html, 9, 8, 1.28);
    expect(r.marginMm).toEqual([10, 14]);
    expect(r.ok).toBe(true);
  });

  it("finds font-size on the real body rule even when an earlier 'html, body { ... }' reset rule has none", () => {
    const html = `<style>
      @page { size: A4; margin: 10mm 14mm; }
      html, body { margin: 0; padding: 0; }
      body { font-family: sans-serif; font-size: 10pt; line-height: 1.28; }
    </style>`;
    const r = checkReadability(html, 9, 8, 1.28);
    expect(r.fontPt).toBe(10);
    expect(r.ok).toBe(true);
  });
});

describe("checkSkillDensity", () => {
  const skillRow = (v: string) => `<div class="skill"><span class="k">Key</span><span class="v">${v}</span></div>`;

  it("passes a skills row at or under the word cap", () => {
    const r = checkSkillDensity(skillRow("Python, TypeScript, FastAPI, and four grounded retrieval systems"), 18);
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("fails a keyword-dump row over the word cap", () => {
    const r = checkSkillDensity(skillRow("word ".repeat(25).trim()), 18);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].words).toBe(25);
  });

  it("passes a document with no skills rows at all", () => {
    expect(checkSkillDensity("<p>no skills grid here</p>", 18).ok).toBe(true);
  });
});

describe("checkSummaryCeiling", () => {
  it("passes a summary at or under the word ceiling", () => {
    const html = `<p class="summary">${"word ".repeat(10).trim()}</p>`;
    const r = checkSummaryCeiling(html, 60);
    expect(r.ok).toBe(true);
    expect(r.words).toBe(10);
  });

  it("fails a summary over the word ceiling", () => {
    const html = `<p class="summary">${"word ".repeat(61).trim()}</p>`;
    const r = checkSummaryCeiling(html, 60);
    expect(r.ok).toBe(false);
    expect(r.words).toBe(61);
  });

  it("passes (no summary to check) when there is no .summary element", () => {
    const r = checkSummaryCeiling("<p>no summary class here</p>", 60);
    expect(r.ok).toBe(true);
    expect(r.words).toBe(0);
  });
});

describe("checkDuplicateSentences", () => {
  it("passes distinct prose with no repeated long sentence", () => {
    const html = `<p>The team retrieves grounded evidence before answering any query at all.</p>
    <p>A second unrelated sentence describes an entirely different piece of work today.</p>`;
    expect(checkDuplicateSentences(html).ok).toBe(true);
  });

  it("fails when the summary restates a bullet verbatim (8+ word sentence repeated)", () => {
    const html = `<p class="summary">We retrieve, cite, or abstain on every grounded answer we produce.</p>
    <li>We retrieve, cite, or abstain on every grounded answer we produce.</li>`;
    const r = checkDuplicateSentences(html);
    expect(r.ok).toBe(false);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].locations.length).toBe(2);
  });

  it("reports the two locations on distinct lines, not both collapsed to line 1", () => {
    const html = `<p class="summary">We retrieve, cite, or abstain on every grounded answer we produce.</p>
    <p>Filler paragraph one.</p>
    <p>Filler paragraph two.</p>
    <li>We retrieve, cite, or abstain on every grounded answer we produce.</li>`;
    const r = checkDuplicateSentences(html);
    const lines = r.duplicates[0].locations.map((l) => l.line);
    expect(new Set(lines).size).toBe(2);
  });

  it("ignores short repeated fragments under the 8-word threshold", () => {
    const html = `<p>Thanks for reading.</p><li>Thanks for reading.</li>`;
    expect(checkDuplicateSentences(html).ok).toBe(true);
  });
});

describe("checkContrast", () => {
  it("passes prose using the 'X, not Y' contrast once", () => {
    const html = `<p>Treat it as leverage, not ceremony.</p>`;
    const r = checkContrast(html);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
  });

  it("fails when the contrast pattern is used a second time (voice becomes a template)", () => {
    const html = `<p>Read the code, not the docstring. Optimise for the third user, not the demo.</p>`;
    const r = checkContrast(html);
    expect(r.ok).toBe(false);
    expect(r.count).toBe(2);
  });

  it("also counts the '; not' and ', never' contrastive-tail forms", () => {
    const html = `<p>Ship it; not guess it. Verify, never assume.</p>`;
    expect(checkContrast(html).count).toBe(2);
  });
});

describe("checkPersonConsistency", () => {
  it("passes prose written consistently in the first person", () => {
    const html = `<p>I write the agentic system and I own its guardrails.</p>`;
    expect(checkPersonConsistency(html).ok).toBe(true);
  });

  it("passes prose written consistently in the third person", () => {
    const html = `<p>He operates what he ships and mentors the team.</p>`;
    expect(checkPersonConsistency(html).ok).toBe(true);
  });

  it("fails a mid-document person switch (he ships: I write)", () => {
    const html = `<p>He operates what he ships: I write the agentic system.</p>`;
    const r = checkPersonConsistency(html);
    expect(r.ok).toBe(false);
    expect(r.firstPerson).toBe(true);
    expect(r.thirdPerson).toBe(true);
  });
});

describe("checkDatedEntries", () => {
  const dated = `
    <section><h2>Selected Projects</h2>
      <div class="entry"><div class="title">Gatehouse: a gate pipeline (2024)</div><ul><li>Did a thing.</li></ul></div>
    </section>
    <section><h2>Experience</h2>
      <div class="entry"><div class="eh"><div class="title">Senior Engineer</div><div class="meta">2022-Present</div></div><ul><li>Led a team.</li></ul></div>
    </section>`;

  it("passes when every project and experience entry header carries a year", () => {
    expect(checkDatedEntries(dated).ok).toBe(true);
  });

  it("fails an undated project entry (no year in its header line)", () => {
    const html = dated.replace("Gatehouse: a gate pipeline (2024)", "Gatehouse: a gate pipeline");
    const r = checkDatedEntries(html);
    expect(r.ok).toBe(false);
    expect(r.undated).toHaveLength(1);
    expect(r.undated[0].header).toContain("Gatehouse");
  });
});

describe("checkBulletBounds", () => {
  it("passes a concise bullet with no banned lead phrase", () => {
    const html = `<li>Shipped a retrieval service that grounds answers in private documents.</li>`;
    expect(checkBulletBounds(html, 45).ok).toBe(true);
  });

  it("fails a bullet over the word bound", () => {
    const html = `<li>${"word ".repeat(46).trim()}</li>`;
    const r = checkBulletBounds(html, 45);
    expect(r.ok).toBe(false);
    expect(r.violations[0].reason).toBe("over-bound");
  });

  it("fails a bullet opening with a banned weak phrase", () => {
    const html = `<li>Responsible for the migration of the platform.</li>`;
    const r = checkBulletBounds(html, 45);
    expect(r.ok).toBe(false);
    expect(r.violations[0].reason).toBe("weak-phrase");
  });
});

const cleanCv = `<!doctype html><html><head><style>
  @page { size: A4; margin: 10mm 14mm; }
  body { font-size: 10pt; line-height: 1.32; }
</style></head><body>
  <p class="summary">${"word ".repeat(20).trim()}</p>
  <section><h2>Selected Projects</h2>
    <div class="entry"><div class="title">Gatehouse (2024)</div>
      <ul><li>Designed a gate pipeline so model output is checked before it reaches a user.</li></ul>
    </div>
  </section>
  <section><h2>Experience</h2>
    <div class="entry"><div class="eh"><div class="title">Senior Engineer</div><div class="meta">2022-Present</div></div>
      <ul><li>Led the guardrail layer that every customer-facing feature ships behind.</li></ul>
    </div>
  </section>
</body></html>`;

// Violates every check at once: 8.5pt/5mm/1.06 line-height, 61-word summary, a duplicated
// 8+ word sentence, a keyword-dump skills row, two contrasts, mixed person, an undated
// project, and a weak/over-bound bullet.
const badCv = `<!doctype html><html><head><style>
  @page { size: A4; margin: 5mm; }
  body { font-size: 8.5pt; line-height: 1.06; }
</style></head><body>
  <p class="summary">${"word ".repeat(61).trim()}. We retrieve, cite, or abstain on every grounded answer we produce.</p>
  <div class="skill"><span class="k">Everything</span><span class="v">${"keyword ".repeat(30).trim()}</span></div>
  <section><h2>Selected Projects</h2>
    <div class="entry"><div class="title">Gatehouse: a policy layer</div>
      <ul><li>Responsible for ${"a very long bullet indeed with many extra words to push it over the bound set for this document".repeat(1)} and more and more and more and more and more and more.</li></ul>
    </div>
  </section>
  <section><h2>Experience</h2>
    <div class="entry"><div class="eh"><div class="title">Senior Engineer</div><div class="meta">2022-Present</div></div>
      <ul><li>He operates what he ships: I write the agentic system, not a demo; not a toy.</li>
      <li>We retrieve, cite, or abstain on every grounded answer we produce.</li></ul>
    </div>
  </section>
</body></html>`;

describe("analyzeImpact", () => {
  it("passes a clean CV with all checks enabled", () => {
    expect(analyzeImpact(cleanCv, defaultImpactOptions).ok).toBe(true);
  });

  it("fails a CV violating every check at once", () => {
    const r = analyzeImpact(badCv, defaultImpactOptions);
    expect(r.ok).toBe(false);
    expect(r.readability?.ok).toBe(false);
    expect(r.readability?.lineHeightOk).toBe(false);
    expect(r.summary?.ok).toBe(false);
    expect(r.duplicates?.ok).toBe(false);
    expect(r.skills?.ok).toBe(false);
    expect(r.contrast?.ok).toBe(false);
    expect(r.person?.ok).toBe(false);
    expect(r.dated?.ok).toBe(false);
    expect(r.bullets?.ok).toBe(false);
  });

  it("passes the same violating CV when every check is silenced", () => {
    const allOff = {
      ...defaultImpactOptions,
      checkMinFont: false, checkMinMargin: false, checkMinLineHeight: false,
      checkSummaryCeiling: false, checkDuplicateSentence: false, checkSkillDensity: false,
      checkContrast: false, checkPersonConsistency: false,
      checkDatedEntries: false, checkBulletBounds: false,
    };
    const r = analyzeImpact(badCv, allOff);
    expect(r.ok).toBe(true);
    expect(r.readability).toBeNull();
    expect(r.summary).toBeNull();
    expect(r.duplicates).toBeNull();
    expect(r.skills).toBeNull();
    expect(r.contrast).toBeNull();
    expect(r.person).toBeNull();
    expect(r.dated).toBeNull();
    expect(r.bullets).toBeNull();
  });

  it("handles empty HTML without throwing (no font/margin declared fails readability)", () => {
    const r = analyzeImpact("", defaultImpactOptions);
    expect(r.ok).toBe(false);
    expect(r.readability?.ok).toBe(false);
  });

  it("passes empty HTML when readability is the only check and it is silenced", () => {
    const r = analyzeImpact("", { ...defaultImpactOptions, checkMinFont: false, checkMinMargin: false, checkMinLineHeight: false });
    expect(r.ok).toBe(true);
  });
});
