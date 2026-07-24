import { describe, expect, it } from "vitest";
import { analyzeEditorial } from "./editorial.js";

describe("editorial advisories", () => {
  it("always reserves natural-language judgement for a human", () => {
    expect(analyzeEditorial("<p>Direct evidence.</p>")).toEqual({ ok: false, messages: ["natural-language: human editorial review required"] });
  });

  it("reports density, weak phrasing, skills, dates, repetition, contrast and person without readability", () => {
    const repeated = "This deliberately repeated sentence contains enough words to trigger deterministic review.";
    const html = `<style>body{font-size:1pt;line-height:.2}@page{margin:1mm}</style>
      <p class="summary">${"word ".repeat(61)}</p>
      <span class="v">${"skill ".repeat(19)}</span>
      <h2>Projects</h2><div class="entry"><strong>Undated project</strong><ul>
      <li>Responsible for ${"delivery ".repeat(46)}</li></ul></div>
      <p>${repeated}</p><p>${repeated}</p>
      <p>I delivered this, not that, not another thing. She reviewed it.</p>`;
    expect(analyzeEditorial(html).messages).toEqual([
      "density: 1 bullet exceeds 45 words", "density: summary has 61 words (maximum 60)",
      "natural-language: 1 bullet opens with a weak phrase", "natural-language: 1 sentence is repeated",
      "natural-language: 2 rhetorical contrasts exceed 1", "natural-language: human editorial review required",
      "self-reference: first- and third-person candidate voice are mixed",
      "skills/project selection: 1 project/experience entry lacks a year", "skills/project selection: 1 skill row exceeds 18 words",
    ]);
  });
});
