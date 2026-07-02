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
  it("flags a fabricated magnitude-suffixed metric (2M users) with no trace", () => {
    const claims = extractNumericClaims("served 2M concurrent users");
    const r = untracedNumbers(claims, "no such scale in the canon", "");
    expect(r.map((c) => c.raw)).toEqual(["2M"]);
  });
  it("flags a fabricated 40k-style metric with no trace", () => {
    const claims = extractNumericClaims("saved 40k annually");
    const r = untracedNumbers(claims, "nothing numeric", "");
    expect(r.map((c) => c.raw)).toEqual(["40k"]);
  });
  it("traces a glued magnitude form to its expanded value in the canon", () => {
    const claims = extractNumericClaims("scaled to 2M users");
    expect(untracedNumbers(claims, "grew the platform to 2,000,000 users", "")).toEqual([]);
  });
  it("traces a glued magnitude form to the same glued form in the canon", () => {
    const claims = extractNumericClaims("cut costs by 40k");
    expect(untracedNumbers(claims, "reduced spend by 40k a year", "")).toEqual([]);
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
  it("passes two degrees at the same institution, matching each entry's year against any degree there", () => {
    const twoDegrees: Canon = {
      ...canon,
      education: [
        { qualification: "MSc Structural Engineering", institution: "Bahonar University, Iran", year: "2019" },
        { qualification: "BSc (Hons) Civil Engineering", institution: "Bahonar University, Iran", year: "2016" },
      ],
    };
    const entries = [
      { title: "MSc Structural Engineering", org: "Bahonar University, Iran", meta: "Distinction · 2019" },
      { title: "BSc (Hons) Civil Engineering", org: "Bahonar University, Iran", meta: "2016" },
    ];
    expect(checkNamesAndDates(entries, [], twoDegrees)).toEqual([]);
  });
  it("still flags a year matching no degree at a multi-degree institution", () => {
    const twoDegrees: Canon = {
      ...canon,
      education: [
        { qualification: "MSc Structural Engineering", institution: "Bahonar University, Iran", year: "2019" },
        { qualification: "BSc (Hons) Civil Engineering", institution: "Bahonar University, Iran", year: "2016" },
      ],
    };
    const entries = [{ title: "BSc (Hons) Civil Engineering", org: "Bahonar University, Iran", meta: "2014" }];
    expect(checkNamesAndDates(entries, [], twoDegrees)).toEqual([{ kind: "bad-date", detail: "Bahonar University, Iran: 2014" }]);
  });
});

describe("canonCorpus", () => {
  it("joins the canon's textual fields, including experience bullets", () => {
    const c: Canon = { ...canon, experience: [{ ...canon.experience[0], bullets: ["Cut review time by 40%."] }] };
    expect(canonCorpus(c)).toContain("40%");
  });
  it("includes identity phone, email, and location so their contents can trace", () => {
    const c: Canon = {
      ...canon,
      identity: { name: "Alex Rivers", role: "AI Engineer", phone: "+44 7700 900123", email: "alex@example.com", location: "Manchester, UK" },
    };
    const corpus = canonCorpus(c);
    expect(corpus).toContain("+44 7700 900123");
    expect(corpus).toContain("alex@example.com");
    expect(corpus).toContain("Manchester, UK");
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
  it("traces a phone number's digit-groups only because identity.phone is in the corpus", () => {
    // A phone number in the CV header has its digit-groups (44, 7700, 900123)
    // extracted as numeric claims. They can only trace once identity.phone is
    // part of the canon corpus; before that fix they surface as untraced.
    const c: Canon = { ...canon, identity: { name: "Alex Rivers", role: "AI Engineer", phone: "+44 7700 900123" } };
    const html = goodHtml + `<div class="contact"><span>+44 7700 900123</span></div>`;
    const r = analyzeTrace(html, c, "");
    expect(r.untracedNumbers).toEqual([]);
    expect(r.ok).toBe(true);
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
