import { describe, it, expect } from "vitest";
import { checkDistinct, distinctExemptionText, distinctnessGate } from "./distinct.js";
import type { Canon } from "../canon/schema.js";
import type { GateInput } from "./gate.js";

const wrap = (body: string) => `<!doctype html><html><head><style>body{}</style></head><body>${body}</body></html>`;

const header = `<header><div class="name">Alex Rivers</div><div class="contact">Bristol, UK | alex.rivers@example.com | example.com portfolio and links row</div></header>`;

describe("checkDistinct", () => {
  it("passes two documents with no shared 8-word run of prose", () => {
    const a = wrap(`<p>The retrieval layer cites a source for every answer it returns to a reader.</p>`);
    const b = wrap(`<p>Governed delivery means the controller loop validates each change before anything merges at all.</p>`);
    const r = checkDistinct(a, [{ name: "prior.html", html: b }], {});
    expect(r.ok).toBe(true);
    expect(r.shared).toHaveLength(0);
  });

  it("fails when the new document reuses an 8+ word run from a prior one", () => {
    const sentence = "a safety device must fail safe not fail smart every single time";
    const a = wrap(`<p>As I always say, ${sentence}.</p>`);
    const b = wrap(`<p>${sentence}, which is why the gate holds no model.</p>`);
    const r = checkDistinct(a, [{ name: "prior.html", html: b }], {});
    expect(r.ok).toBe(false);
    expect(r.shared.length).toBeGreaterThan(0);
    expect(r.shared[0].sources).toContain("prior.html");
    expect(r.shared[0].text).toContain("fail safe not fail smart");
  });

  it("merges overlapping matched windows into one maximal run, not one hit per shingle", () => {
    const long = "one two three four five six seven eight nine ten eleven twelve";
    const r = checkDistinct(wrap(`<p>${long}</p>`), [{ name: "p.html", html: wrap(`<p>${long}</p>`) }], {});
    expect(r.shared).toHaveLength(1);
  });

  it("ignores the letterhead: an identical <header> block is not a template tell", () => {
    const a = wrap(`${header}<p>Prose written freshly for this particular company and role today.</p>`);
    const b = wrap(`${header}<p>Entirely different prose for a different company on another day.</p>`);
    expect(checkDistinct(a, [{ name: "prior.html", html: b }], {}).ok).toBe(true);
  });

  it("normalises case and punctuation before matching", () => {
    const a = wrap(`<p>The plausible wrong number is the one that reads correctly, and only surfaces later.</p>`);
    const b = wrap(`<p>the plausible WRONG number is the one that reads correctly and only surfaces later!</p>`);
    expect(checkDistinct(a, [{ name: "prior.html", html: b }], {}).ok).toBe(false);
  });

  it("skips sections named in ignoreSections (factual boilerplate legitimately repeats)", () => {
    const edu = `<section><h2>Education</h2><p>MSc Energy and Sustainable Development with a dissertation on federated learning for building clusters.</p></section>`;
    const a = wrap(`${edu}<p>Fresh prose for this role.</p>`);
    const b = wrap(`${edu}<p>Different prose for the last role.</p>`);
    expect(checkDistinct(a, [{ name: "prior.html", html: b }], { ignoreSections: ["education"] }).ok).toBe(true);
    expect(checkDistinct(a, [{ name: "prior.html", html: b }], {}).ok).toBe(false);
  });

  it("tolerates up to maxShared runs when set", () => {
    const sentence = "this exact factual line about the flagship project repeats across every application";
    const a = wrap(`<p>${sentence}.</p>`);
    const b = wrap(`<p>${sentence}.</p>`);
    expect(checkDistinct(a, [{ name: "prior.html", html: b }], { maxShared: 1 }).ok).toBe(true);
    expect(checkDistinct(a, [{ name: "prior.html", html: b }], { maxShared: 0 }).ok).toBe(false);
  });

  it("passes trivially with no prior documents", () => {
    expect(checkDistinct(wrap("<p>anything at all goes here</p>"), [], {}).ok).toBe(true);
  });

  it("ignores the <head> block (the <title> is not prose)", () => {
    const titled = (p: string) => `<!doctype html><html><head><title>Alex Rivers Cover Note AI Engineer</title></head><body><p>${p}</p></body></html>`;
    const r = checkDistinct(titled("fresh words for this role"), [
      { name: "a.html", html: titled("other words entirely") },
      { name: "b.html", html: titled("different again here") },
    ], {});
    expect(r.ok).toBe(true);
  });
});

describe("checkDistinct signature phrases", () => {
  const doc = (p: string) => `<!doctype html><html><body><p>${p}</p></body></html>`;

  it("flags a 4+ word phrase recurring across two or more priors as a signature", () => {
    const r = checkDistinct(
      doc("I make wrongness cheap to catch in every system I ship."),
      [
        { name: "a.html", html: doc("The gate makes wrongness cheap to catch before anything merges.") },
        { name: "b.html", html: doc("Its whole job is keeping wrongness cheap to catch at runtime.") },
      ],
      {},
    );
    expect(r.ok).toBe(false);
    expect(r.signatures.length).toBeGreaterThan(0);
    expect(r.signatures[0].text).toContain("wrongness cheap to catch");
    expect(r.signatures[0].sources.sort()).toEqual(["a.html", "b.html"]);
  });

  it("does not flag a phrase found in only one prior (that is the 8-word check's job)", () => {
    const r = checkDistinct(
      doc("I make wrongness cheap to catch in every system I ship."),
      [
        { name: "a.html", html: doc("The gate makes wrongness cheap to catch before anything merges.") },
        { name: "b.html", html: doc("Completely unrelated prose lives in this one.") },
      ],
      {},
    );
    expect(r.signatures).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("never triggers with a single prior document", () => {
    const r = checkDistinct(
      doc("I make wrongness cheap to catch always."),
      [{ name: "a.html", html: doc("wrongness cheap to catch is the theme.") }],
      {},
    );
    expect(r.signatures).toHaveLength(0);
  });

  it("exempts a signature run that is verbatim canon text (a fact, not a voice tic)", () => {
    const canonText = "Senior Structural Engineer Acme\ninterlock: deterministic safety gate for AI-agent output";
    const fact = "senior structural engineer acme";
    const r = checkDistinct(
      doc(`Currently ${fact} in Cambridge.`),
      [
        { name: "a.html", html: doc(`Role: ${fact}, since 2022.`) },
        { name: "b.html", html: doc(`Works as ${fact} today.`) },
      ],
      { canonText },
    );
    expect(r.signatures).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("still flags a voice tic absent from the canon even when canonText is supplied", () => {
    const canonText = "Senior Structural Engineer Acme";
    const tic = "wrongness cheap to catch";
    const r = checkDistinct(
      doc(`I make ${tic} in every system.`),
      [
        { name: "a.html", html: doc(`The gate keeps ${tic} at runtime.`) },
        { name: "b.html", html: doc(`Its job is ${tic} forever.`) },
      ],
      { canonText },
    );
    expect(r.signatures.length).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
  });

  it("ignores structural elements: identical headings, title lines, links, and meta are house style, not voice", () => {
    const structural = `
      <section><h2>Selected Projects</h2>
        <div class="entry">
          <div class="eh"><div class="title">interlock: <span class="tag">deterministic safety gate for agent output</span></div><div class="meta">2026</div></div>
          <div class="links">npm: agent-interlock · github.com/example/interlock</div>
        </div>
      </section>`;
    const page = (bullet: string) => `<!doctype html><html><body>${structural}<ul><li>${bullet}</li></ul></body></html>`;
    const a = page("Fresh prose written only for this role.");
    const b = page("Different prose from an earlier application.");
    const c = page("Yet another entirely distinct bullet here.");
    const r = checkDistinct(a, [{ name: "b.html", html: b }, { name: "c.html", html: c }], {});
    expect(r.signatures).toHaveLength(0);
    expect(r.shared).toHaveLength(0);
  });

  it("never merges a run across a paragraph or bullet boundary", () => {
    // Each half is under the 8-word window; only cross-boundary merging could flag them.
    const a = doc(`<p>alpha beta gamma delta epsilon zeta eta</p><p>theta iota kappa lambda mu nu xi</p>`);
    const b = doc(`<p>alpha beta gamma delta epsilon zeta eta</p><p>theta iota kappa lambda mu nu xi</p>`);
    const r = checkDistinct(a, [{ name: "b.html", html: b }], {});
    expect(r.shared).toHaveLength(0);
  });

  it("does not exempt a mixed run that welds canon fact to non-canon voice glue", () => {
    const canonText = "the interlock gate";
    // The recurring phrase spans beyond the canon fragment, so the maximal run
    // is not wholly canon text and stays flagged.
    const phrase = "famously the interlock gate never sleeps";
    const r = checkDistinct(
      doc(`As I say, ${phrase}.`),
      [
        { name: "a.html", html: doc(`Remember: ${phrase}.`) },
        { name: "b.html", html: doc(`And ${phrase}, always.`) },
      ],
      { canonText },
    );
    expect(r.signatures.length).toBeGreaterThan(0);
  });
});

describe("distinctExemptionText", () => {
  const canon: Canon = {
    schemaVersion: 2,
    identity: {
      name: "Alex Rivers", role: "AI Engineer, Agentic Systems",
      links: [{ label: "GitHub", url: "https://github.com/alex" }],
    },
    skills: [], projects: [],
    experience: [{ title: "Engineer", org: "Meridian Labs", location: "Bristol", start: "2022", end: "Present", bullets: ["Shipped a service."] }],
    education: [], certifications: [], publications: [], protectedTopics: [],
    verifiedFacts: {}, talkingPoints: {}, ipBoundaries: {} as never, discretion: {}, draftingGuidance: {}, facts: [],
  } as unknown as Canon;

  const doc = (p: string) => wrap(`<p>${p}</p>`);

  it("adds the link and location strings the trace corpus withholds", () => {
    const text = distinctExemptionText(canon);
    expect(text).toContain("https://github.com/alex");
    expect(text).toContain("Meridian Labs Bristol");
    // and still carries the projection itself
    expect(text).toContain("AI Engineer, Agentic Systems");
  });

  it("exempts a canonical identity phrase in the pack lane, not only at the terminal", async () => {
    // Only the four canon words recur in both priors; the glue around them differs, so the
    // maximal recurring run is exactly the canon's identity.role and nothing more.
    const phrase = "ai engineer agentic systems";
    const finding = await distinctnessGate.run({
      artifacts: [{ id: "cover", html: doc(`Consider me your ${phrase} always.`), pdfText: "" }],
      canon,
      priors: [
        { name: "a.html", html: doc(`Hiring an ${phrase} quickly now.`) },
        { name: "b.html", html: doc(`Become the ${phrase} people trust.`) },
      ],
      thresholds: { maximumSharedRuns: 0, maximumSignaturePhrases: 0 },
    } as unknown as GateInput);
    expect(finding.messages).toEqual([]);
    expect(finding.ok).toBe(true);
  });
});
