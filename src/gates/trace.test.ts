import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractNumericClaims, untracedNumbers, extractTitledEntries, extractProjectNames, checkNamesAndDates, canonCorpus, analyzeTrace } from "./trace.js";
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
  it("finds a plain count", () => {
    const r = extractNumericClaims("mentor 3 engineers");
    expect(r).toEqual([{ raw: "3", index: 7, value: 3 }]);
  });
  it("ignores a bare year, leaving it to the date-range check", () => {
    expect(extractNumericClaims("Started in 2022")).toEqual([]);
  });
});

describe("untracedNumbers", () => {
  it("passes a claim whose value appears in the canon corpus", () => {
    const claims = extractNumericClaims("cut review time by 40%");
    expect(untracedNumbers(claims, "reduced load by 40 percent", "")).toEqual([]);
  });
  it("matches equivalent forms: 40% in the doc traces to a bare 40 in the canon", () => {
    const claims = extractNumericClaims("grew revenue 40%");
    expect(untracedNumbers(claims, "a team of 40", "")).toEqual([]);
  });
  it("flags a claim with no matching value anywhere in the canon or jd text", () => {
    const claims = extractNumericClaims("cut latency by 47%");
    const r = untracedNumbers(claims, "no numbers here", "");
    expect(r).toEqual(claims);
  });
  it("also traces against the jd text", () => {
    const claims = extractNumericClaims("a team of 12");
    expect(untracedNumbers(claims, "", "we are a team of 12 people")).toEqual([]);
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
});

describe("checkNamesAndDates", () => {
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

describe("canonCorpus", () => {
  it("joins the canon's textual fields, including experience bullets", () => {
    const c: Canon = { ...canon, experience: [{ ...canon.experience[0], bullets: ["Cut review time by 40%."] }] };
    expect(canonCorpus(c)).toContain("40%");
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
    expect(result).toEqual({ ok: true, untracedNumbers: [], nameIssues: [] });
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
