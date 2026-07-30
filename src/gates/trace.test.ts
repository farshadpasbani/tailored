import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractNumericClaims, untracedNumbers, extractTitledEntries, extractProjectNames, checkNamesAndDates, analyzeTrace } from "./trace.js";
import { loadCanon } from "../canon/load.js";
import type { Canon } from "../canon/schema.js";

const canon: Canon = {
  identity: { name: "Alex Rivers", role: "AI Engineer" },
  skills: [], certifications: [], publications: [], protectedTopics: [],
  projects: [{ name: "Gatehouse", bullets: ["b"] }],
  experience: [{ title: "Senior AI Engineer", org: "Meridian Labs", start: "2022", end: "Present", bullets: ["b"] }],
  education: [{ qualification: "BSc Computer Science", institution: "University of Manchester", year: "2017" }],
};

describe("extractNumericClaims", () => {
  it("finds a percentage", () => {
    const r = extractNumericClaims("cut review time by 40%");
    expect(r).toEqual([{ raw: "40%", index: 19, value: 40 }]);
  });
  it("finds a currency amount with a magnitude suffix", () => {
    const r = extractNumericClaims("raised £1.2m in funding");
    expect(r).toEqual([{ raw: "£1.2m", index: 7, value: 1_200_000 }]);
  });
  it("does not swallow the trailing space when there is no magnitude suffix", () => {
    const r = extractNumericClaims("raised $1,234.99 instead");
    expect(r).toEqual([{ raw: "$1,234.99", index: 7, value: 1234.99 }]);
  });
  it("finds a plain count", () => {
    const r = extractNumericClaims("mentor 3 engineers");
    expect(r).toEqual([{ raw: "3", index: 7, value: 3 }]);
  });
  it("ignores a bare year, leaving it to the date-range check", () => {
    expect(extractNumericClaims("Started in 2022")).toEqual([]);
  });
  it("finds a bare magnitude-suffixed number glued to the digits (2M users)", () => {
    const r = extractNumericClaims("scaled to 2M users");
    expect(r).toEqual([{ raw: "2M", index: 10, value: 2_000_000 }]);
  });
  it("finds a lowercase k magnitude glued to the digits (40k)", () => {
    const r = extractNumericClaims("cut costs by 40k");
    expect(r).toEqual([{ raw: "40k", index: 13, value: 40_000 }]);
  });
  it("finds a bn magnitude glued to the digits (1.2bn)", () => {
    const r = extractNumericClaims("processed 1.2bn events");
    expect(r).toEqual([{ raw: "1.2bn", index: 10, value: 1_200_000_000 }]);
  });
  it("extracts a unit-suffixed count (200ms) using the bare number as its value", () => {
    // An unknown letter suffix is treated as a unit, not a magnitude: the claim
    // still needs a trace. Extracting-and-requiring beats silently dropping.
    const r = extractNumericClaims("reduced latency 200ms");
    expect(r).toEqual([{ raw: "200ms", index: 16, value: 200 }]);
  });
});

describe("untracedNumbers", () => {
  const raws = (text: string, canonText: string, jdText = "") =>
    untracedNumbers(text, canonText, jdText).map((c) => c.raw);

  it("traces a percentage to the same figure the canon spells out as a word", () => {
    expect(raws("cut review time by 40%", "cut review time by 40 percent")).toEqual([]);
  });
  it("flags a claim with no matching value anywhere in the canon or jd text", () => {
    expect(raws("cut latency by 47%", "no numbers here")).toEqual(["47%"]);
  });
  it("also traces against the jd text", () => {
    expect(raws("a team of 12", "", "we are a team of 12 people")).toEqual([]);
  });
  it("flags a fabricated magnitude-suffixed metric (2M users) with no trace", () => {
    expect(raws("served 2M concurrent users", "no such scale in the canon")).toEqual(["2M"]);
  });
  it("flags a fabricated 40k-style metric with no trace", () => {
    expect(raws("saved 40k annually", "nothing numeric")).toEqual(["40k"]);
  });
  it("traces a glued magnitude form to its expanded value in the canon", () => {
    expect(raws("scaled to 2M users", "grew the platform to 2,000,000 users")).toEqual([]);
  });
  it("traces a glued magnitude form to the same glued form in the canon", () => {
    expect(raws("cut costs by 40k", "reduced spend by 40k a year")).toEqual([]);
  });

  // The tightening: an equal value somewhere in the corpus is no longer a trace.
  it("does not ground a number on a list enumerator in the canon's claims prose", () => {
    // The card-3 review's reproduction. The canon numbers three kinds of leadership
    // "1. 2. 3."; nothing in it counts three of anything, so "3 engineers" must not pass.
    const canonText = "Leadership shows up in three ways - 1. team leadership 2. technical leadership 3. community leadership.";
    expect(raws("mentored 3 engineers on the platform team", canonText)).toEqual(["3"]);
  });
  it("treats a list enumerator in the document as markup, not as a claim to justify", () => {
    expect(extractNumericClaims("1. Built the gate.\n2. Shipped it.")).toEqual([]);
  });
  it("flags the same value reused in an unrelated sense despite one shared word", () => {
    // "production" alone bridges two unrelated sentences; one shared word is not context.
    const canonText = "Built to production standard: a 118-test suite, semantic-versioned releases.";
    expect(raws("shipped 118 features to production", canonText)).toEqual(["118"]);
  });
  it("traces a paraphrase that shares the clause vocabulary", () => {
    const canonText = "Coding agents have landed 31 agent-authored patches across the review queue.";
    expect(raws("agents have merged 31 patches into the review queue", canonText)).toEqual([]);
  });
  it("traces a digit to the count the canon spells out as a word", () => {
    expect(raws("landed work across 6 of the services", "patches across six of the services")).toEqual([]);
  });
  it("treats a matching at-least marker as comparable context", () => {
    // The employer's own figure, quoted in the candidate's own words: same value, both
    // open-ended, and no vocabulary in common between the two sentences.
    expect(raws("kept honest across 180-odd depots", "", "we work with 180+ regional yards")).toEqual([]);
  });
  it("treats a matching range pairing as comparable context", () => {
    expect(raws("built 0 to 1 and self-hosted", "", "shipped 0-1 products end to end")).toEqual([]);
  });
  it("treats an identical written form as comparable context", () => {
    expect(raws("4th Intl. Workshop on Retrieval", "4th International Workshop on Retrieval")).toEqual([]);
  });
  it("never grounds a percentage on a bare count of the same value", () => {
    expect(raws("grew revenue 40%", "a team of 40 people grew revenue")).toEqual(["40%"]);
  });
  it("never grounds a currency amount on a bare count of the same value", () => {
    expect(raws("delivered £9,000 of savings", "surveyed a 9,000+ unit estate")).toEqual(["£9,000"]);
  });
  it("flags a count claimed where the canon states a percentage, same words either side", () => {
    expect(raws("automation cut review time by 55 hours", "automation cut review time by roughly 55%")).toEqual(["55"]);
  });

  // Edges: a claim can sit at index 0, at the end of the text, or with no neighbouring
  // words at all, and the context walk must handle each without reaching outside the text.
  it("traces a claim that has no neighbouring words, on its written form alone", () => {
    expect(raws("40%", "40%")).toEqual([]);
  });
  it("flags a claim that has no neighbouring words and no comparable form", () => {
    expect(raws("40", "a team of 40 people")).toEqual(["40"]);
  });
  it("handles a claim at the very start of the text", () => {
    expect(raws("12 engineers joined", "12 engineers joined the team")).toEqual([]);
  });
  it("handles a claim at the very end of the text", () => {
    expect(raws("the review queue held 12", "12 engineers joined the team")).toEqual(["12"]);
  });
  it("returns nothing for empty text or an empty corpus without throwing", () => {
    expect(raws("", "")).toEqual([]);
    expect(raws("shipped 9 releases", "")).toEqual(["9"]);
  });
});

describe("extractTitledEntries", () => {
  it("extracts an experience-style entry (title, org, meta)", () => {
    const html = `<div class="eh">
      <div><span class="title">Senior AI Engineer</span>, Meridian Labs</div>
      <div class="meta">Manchester, UK · 2022–Present</div>
    </div>`;
    expect(extractTitledEntries(html)).toEqual([
      { title: "Senior AI Engineer", org: "Meridian Labs", meta: "Manchester, UK · 2022–Present" },
    ]);
  });
  it("extracts an education-style entry (title, institution, meta)", () => {
    const html = `<div class="two">
      <div><span class="title">BSc Computer Science</span>, University of Manchester</div>
      <div class="meta">2017</div>
    </div>`;
    expect(extractTitledEntries(html)).toEqual([
      { title: "BSc Computer Science", org: "University of Manchester", meta: "2017" },
    ]);
  });
});

describe("extractProjectNames", () => {
  it("extracts the project name before the colon", () => {
    const html = `<div class="entry">
      <div class="title">Gatehouse: a deterministic policy layer that wraps a model</div>
    </div>`;
    expect(extractProjectNames(html)).toEqual(["Gatehouse"]);
  });
  it("decodes HTML entities so an &amp;-containing name matches the canon's literal ampersand", () => {
    const html = `<div class="entry">
      <div class="title">Gatehouse &amp; Keep: a policy layer</div>
    </div>`;
    expect(extractProjectNames(html)).toEqual(["Gatehouse & Keep"]);
  });
});

describe("extractTitledEntries entity decoding", () => {
  it("decodes entities in title and org", () => {
    const html = `<div class="eh">
      <div><span class="title">Design &amp; Build Lead</span>, Smith &amp; Sons</div>
      <div class="meta">2020</div>
    </div>`;
    expect(extractTitledEntries(html)).toEqual([
      { title: "Design & Build Lead", org: "Smith & Sons", meta: "2020" },
    ]);
  });
});

describe("checkNamesAndDates", () => {
  it("pairs two degrees at the same institution by qualification, not first match", () => {
    const c: Canon = { ...canon, education: [
      { qualification: "BSc Computer Science", institution: "University of Manchester", year: "2017" },
      { qualification: "MSc Machine Learning", institution: "University of Manchester", year: "2020" },
    ]};
    const entries = [
      { title: "BSc Computer Science", org: "University of Manchester", meta: "2017" },
      { title: "MSc Machine Learning", org: "University of Manchester", meta: "Distinction · 2020" },
    ];
    expect(checkNamesAndDates(entries, [], c)).toEqual([]);
  });
  it("still fails a wrong year on a qualification-matched entry", () => {
    const c: Canon = { ...canon, education: [
      { qualification: "BSc Computer Science", institution: "University of Manchester", year: "2017" },
      { qualification: "MSc Machine Learning", institution: "University of Manchester", year: "2020" },
    ]};
    const entries = [{ title: "MSc Machine Learning", org: "University of Manchester", meta: "2017" }];
    const r = checkNamesAndDates(entries, [], c);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe("bad-date");
  });
  it("passes an experience entry whose org and date range match the canon", () => {
    const entries = [{ title: "Senior AI Engineer", org: "Meridian Labs", meta: "Manchester, UK · 2022–Present" }];
    expect(checkNamesAndDates(entries, ["Gatehouse"], canon)).toEqual([]);
  });
  it("flags an org that matches no canon employer or institution", () => {
    const entries = [{ title: "CTO", org: "Kryotech Solutions", meta: "2020–2022" }];
    const r = checkNamesAndDates(entries, [], canon);
    expect(r).toEqual([{ kind: "unknown-name", detail: "Kryotech Solutions" }]);
  });
  it("flags a padded date range for a known employer", () => {
    const entries = [{ title: "Senior AI Engineer", org: "Meridian Labs", meta: "Manchester, UK · 2020–Present" }];
    const r = checkNamesAndDates(entries, [], canon);
    expect(r).toEqual([{ kind: "bad-date", detail: "Meridian Labs: 2020–Present" }]);
  });
  it("flags a project name that is not in the canon", () => {
    const r = checkNamesAndDates([], ["Skyforge"], canon);
    expect(r).toEqual([{ kind: "unknown-name", detail: "Skyforge" }]);
  });
});

describe("analyzeTrace", () => {
  const goodHtml = `
    <div class="eh">
      <div><span class="title">Senior AI Engineer</span>, Meridian Labs</div>
      <div class="meta">Manchester, UK · 2022–Present</div>
    </div>
    <div class="entry"><div class="title">Gatehouse: a policy layer</div></div>
  `;
  it("passes a document whose claims all trace to the canon", () => {
    expect(analyzeTrace(goodHtml, canon, "").ok).toBe(true);
  });
  it("fails a document with a fabricated metric not present anywhere in the canon", () => {
    const doctored = goodHtml + "<p>Cut latency by 47%.</p>";
    const r = analyzeTrace(doctored, canon, "");
    expect(r.ok).toBe(false);
    expect(r.untracedNumbers.map((c) => c.raw)).toContain("47%");
  });
  it("fails a document with an employer not in the canon", () => {
    const doctored = goodHtml.replace("Meridian Labs", "Kryotech Solutions");
    const r = analyzeTrace(doctored, canon, "");
    expect(r.ok).toBe(false);
    expect(r.nameIssues).toEqual([{ kind: "unknown-name", detail: "Kryotech Solutions" }]);
  });

  it("passes the bundled alex-rivers example CV against its own canon", () => {
    const r = loadCanon("examples/alex-rivers/canon.yaml");
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const html = readFileSync("examples/alex-rivers/cv.html", "utf8");
    const result = analyzeTrace(html, r.data, "");
    expect(result).toEqual({ ok: true, untracedNumbers: [], nameIssues: [], structuralIssues: [] });
  });

  it("fails closed when an Experience section is present but no entry parses (markup drift)", () => {
    // The org line gained a nested <a> tag, so the house-style extractor yields
    // zero entries. Passing vacuously on [] would let any invented employer
    // through; the gate must fail with a structural issue instead.
    const drifted = `
      <h2>Experience</h2>
      <div class="eh">
        <div><span class="title">Senior AI Engineer</span>, <a href="#">Meridian Labs</a></div>
        <div class="meta">Manchester, UK · 2022–Present</div>
      </div>
    `;
    const r = analyzeTrace(drifted, canon, "");
    expect(r.ok).toBe(false);
    expect(r.structuralIssues.some((s) => /markup may have drifted/.test(s))).toBe(true);
  });

  it("fails closed when a Projects section is present but no project name parses", () => {
    const drifted = `
      <h2>Selected Projects</h2>
      <div class="entry"><div class="title"><b>Gatehouse</b>: a policy layer</div></div>
    `;
    const r = analyzeTrace(drifted, canon, "");
    expect(r.ok).toBe(false);
    expect(r.structuralIssues.some((s) => /markup may have drifted/.test(s))).toBe(true);
  });

  it("does not demand entries from a document with no experience/education/project sections", () => {
    // A cover note has neither section; the numeric half of the gate still applies.
    const cover = "<h1>AI Engineer</h1><p>Dear team, I lead the platform group at Meridian Labs.</p>";
    expect(analyzeTrace(cover, canon, "").ok).toBe(true);
  });

  it("fails a doctored copy of the example CV with one invented metric", () => {
    const r = loadCanon("examples/alex-rivers/canon.yaml");
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const html = readFileSync("examples/alex-rivers/cv.html", "utf8")
      .replace("Cut review time for generated documents by roughly two thirds", "Cut review time for generated documents by 47%");
    const result = analyzeTrace(html, r.data, "");
    expect(result.ok).toBe(false);
    expect(result.untracedNumbers.map((c) => c.raw)).toContain("47%");
  });
});
