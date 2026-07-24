import { describe, expect, it } from "vitest";

describe("analyzeProhibitedClaims", () => {
  it("enforces classification-aware source-path cardinality", async () => {
    const { MetricClaimsFileSchema } = await import("./prohibitedClaims.js");
    const invalid = [
      { id: "identity", text: "+1 202 555 0142", classification: "identity", sourcePaths: ["identity.phone"] },
      { id: "reference", text: "issue #37", classification: "reference", sourcePaths: ["projects[0].year"] },
      { id: "bare", text: "Gatehouse 2024", classification: "date" },
      { id: "range", text: "2022–Present", classification: "date", sourcePaths: ["experience[0].start"] },
      { id: "standalone", text: "10 July 2026", classification: "date", sourcePaths: ["projects[0].year"] },
    ];
    for (const exemption of invalid) {
      const result = MetricClaimsFileSchema.safeParse({ schemaVersion: 1, claims: [], exemptions: [exemption] });
      expect(result.success, exemption.id).toBe(false);
      if (!result.success) expect(result.error.issues[0].path).toEqual(["exemptions", 0, "sourcePaths"]);
    }
  });

  it("ignores CSS .sign while checking visible engineering prose", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "<style>.sign { color: red; }</style><p>Structural engineering delivery.</p>",
      canon: {
        facts: [],
        claims: { cannot: [{ id: "no-signoff", statement: "No sign-off authority.", concepts: ["engineering-sign-off"] }] },
      },
    });
    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("blocks arbitrary numeric AI tenure without borrowing civil tenure from another clause", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const canon = { facts: [], claims: { cannot: [{ id: "no-ai-tenure", statement: "Do not quantify AI tenure.", concepts: ["ai-tenure" as const] }] } };
    for (const text of [
      "AI engineer with nine years of experience.",
      "Eight years in machine learning engineering.",
      "ML engineer for 12 years.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).issues).toEqual([
      expect.objectContaining({ concept: "ai-tenure" }),
    ]);
    expect(analyzeProhibitedClaims({
      text: "Nine years in civil engineering. I now build AI tools.", canon,
    }).ok).toBe(true);
  });

  it("blocks proprietary employer-tool ownership without flagging generic internal work", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const canon = { facts: [], claims: { cannot: [{ id: "no-employer-ip", statement: "No employer IP claims.", concepts: ["internal-ip" as const] }] } };
    for (const text of [
      "Built a proprietary internal Acme Engineering tool.",
      "Owned the internal employer tool implementation.",
      "I designed the confidential implementation details.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).issues).toEqual([
      expect.objectContaining({ concept: "internal-ip" }),
    ]);
    expect(analyzeProhibitedClaims({ text: "Worked with internal stakeholders on public tooling.", canon }).ok).toBe(true);
    for (const text of [
      "The vacancy seeks engineers to build internal tools.",
      "The role description lists proprietary tools.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).ok).toBe(true);
  });

  it("treats the configured employer name as an internal-IP mention on its own", async () => {
    const { analyzeProhibitedClaims, DEFAULT_EMPLOYER_ALIASES } = await import("./prohibitedClaims.js");
    const canon = { facts: [], claims: { cannot: [{ id: "no-employer-ip", statement: "No employer IP claims.", concepts: ["internal-ip" as const] }] } };
    // The employer name alone carries no generic alias ("internal", "proprietary", ...),
    // so only the configured alias list can make these fail.
    expect(DEFAULT_EMPLOYER_ALIASES).toEqual(["Acme Engineering"]);
    expect(analyzeProhibitedClaims({ text: "Owned the Acme Engineering tooling.", canon }).issues).toEqual([
      expect.objectContaining({ concept: "internal-ip" }),
    ]);
    expect(analyzeProhibitedClaims({ text: "Owned the Northwind Systems tooling.", canon }).ok).toBe(true);
    expect(analyzeProhibitedClaims({ text: "Owned the Northwind Systems tooling.", canon, employerAliases: ["Northwind Systems"] }).issues).toEqual([
      expect.objectContaining({ concept: "internal-ip" }),
    ]);
    expect(analyzeProhibitedClaims({ text: "Owned the Acme Engineering tooling.", canon, employerAliases: ["Northwind Systems"] }).ok).toBe(true);
  });

  it("does not turn vacancy or field-history prose into candidate AI tenure", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const canon = { facts: [], claims: { cannot: [{ id: "no-ai-tenure", statement: "Do not quantify AI tenure.", concepts: ["ai-tenure" as const] }] } };
    for (const text of [
      "The vacancy requires nine years of AI engineering.",
      "AI engineering evolved over five years.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).ok).toBe(true);
  });

  it("applies assertion context across every prohibited concept", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const canon = { identity: { name: "Alex Rivers" }, facts: [], claims: { cannot: [
      { id: "no-aws", statement: "No AWS delivery.", concepts: ["aws-production" as const] },
      { id: "no-ansys", statement: "No ANSYS delivery.", concepts: ["ansys-hands-on" as const] },
      { id: "no-db", statement: "No production database delivery.", concepts: ["database-production" as const] },
      { id: "no-tenure", statement: "No AI tenure.", concepts: ["ai-tenure" as const] },
      { id: "no-ip", statement: "No employer IP.", concepts: ["internal-ip" as const] },
    ] } };
    for (const text of [
      "The vacancy requires AWS deployment experience.",
      "The position requirements require nine years of AI engineering.",
      "The specification asks for eight years of ML engineering.",
      "The public vacancy states that Acme Engineering built a proprietary internal tool.",
      "AI engineering evolved over five years.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).ok, text).toBe(true);
    for (const text of [
      "Led development of a production AWS platform.",
      "Maintained internal client source code.",
      "Architected employer tooling.",
      "Responsible for confidential implementation details.",
      "Internal Acme Engineering tool used FastAPI.",
      "Deployed production workloads on AWS.",
      "Delivered structural simulations in ANSYS.",
      "Operated PostgreSQL schemas in production.",
      "At Acme Engineering, I built a proprietary internal tool.",
      "Alex Rivers built production workloads on AWS.",
      "Acme Engineering built a proprietary internal tool.",
      "Acme uses confidential client source code.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).ok, text).toBe(false);
  });

  it("recognizes natural requirement frames without weakening first-person precedence", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const canon = { identity: { name: "Alex Rivers" }, facts: [], claims: { cannot: [
      { id: "no-aws", statement: "No AWS delivery.", concepts: ["aws-production" as const] },
      { id: "no-tenure", statement: "No tenure.", concepts: ["ai-tenure" as const] },
    ] } };
    for (const text of [
      "Requirements include production AWS deployment.",
      "Requirements: production AWS deployment.",
      "The position calls for production AWS deployment.",
      "The candidate must have nine years of AI engineering.",
      "Candidates should have eight years of ML engineering.",
      "Seeking engineers with production AWS deployment experience.",
      "The specification asks for production AWS deployment experience.",
    ]) expect(analyzeProhibitedClaims({ text, canon }).ok, text).toBe(true);
    expect(analyzeProhibitedClaims({ text: "I meet the requirements: I deployed production AWS workloads.", canon }).ok).toBe(false);
  });

  it("blocks a paraphrased internal-IP claim even without a protected-topic name", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "Improved a confidential client metric by 18 percent.",
      canon: {
        facts: [],
        claims: { cannot: [{ id: "no-ip", statement: "Do not share internal metrics or unpublished client figures.", concepts: ["internal-ip"] }] },
      },
    });
    expect(result.issues).toEqual([
      expect.objectContaining({ kind: "forbidden-claim", concept: "internal-ip" }),
    ]);
  });

  it("distinguishes representative forbidden capability claims from non-claim mentions", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const cases = [
      {
        concept: "aws-production",
        cannot: "Do not claim hands-on production experience with AWS.",
        blocked: "Deployed production workloads across Amazon Web Services using Lambda.",
        allowed: "The vacancy lists AWS as desirable.",
      },
      {
        concept: "ansys-hands-on",
        cannot: "Do not claim hands-on ANSYS analysis experience.",
        blocked: "Delivered structural simulations in ANSYS Mechanical.",
        allowed: "The role description lists ANSYS Mechanical.",
      },
      {
        concept: "database-production",
        cannot: "Do not claim production database experience.",
        blocked: "Designed and operated PostgreSQL schemas in production.",
        allowed: "The vacancy mentions PostgreSQL.",
      },
      {
        concept: "langchain-delivery",
        cannot: "Do not claim hands-on LangChain delivery.",
        blocked: "Built a customer workflow using LangChain agents.",
        allowed: "The job advert mentions LangChain.",
      },
      {
        concept: "audio-video-experience",
        cannot: "Do not claim audio or video model experience.",
        blocked: "Built speech-to-text and video inference pipelines.",
        allowed: "Interested in audio and video products.",
      },
      {
        concept: "ai-tenure",
        cannot: "Do not imply seven years of AI engineering tenure.",
        blocked: "AI engineer with seven years in the field.",
        allowed: "Seven years in civil engineering, now building AI tools.",
      },
    ];

    const actual = cases.map((testCase) => {
      const canon = { facts: [], claims: { cannot: [{ id: testCase.concept, statement: testCase.cannot, concepts: [testCase.concept] }] } };
      const blocked = analyzeProhibitedClaims({ text: testCase.blocked, canon });
      const allowed = analyzeProhibitedClaims({ text: testCase.allowed, canon });
      return {
        concept: testCase.concept,
        blocked: !blocked.ok,
        reportedConcept: blocked.issues[0]?.concept,
        allowed: allowed.ok,
      };
    });

    expect(actual).toEqual(cases.map((testCase) => ({
      concept: testCase.concept,
      blocked: true,
      reportedConcept: testCase.concept,
      allowed: true,
    })));
  });

  it("blocks a sign-off authority paraphrase prohibited by claims.cannot", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "Held delegated authority to approve and sign engineering designs.",
      canon: {
        facts: [],
        claims: {
          cannot: [{ id: "no-signoff", statement: "Do not imply chartership or engineering sign-off authority.", concepts: ["engineering-sign-off"] }],
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "forbidden-claim",
        sourcePath: "claims.cannot[0]",
        concept: "engineering-sign-off",
      }),
    ]);
  });

  it("blocks a direct chartership claim when chartered status is prohibited", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "I am a Chartered Engineer leading multidisciplinary delivery.",
      canon: { facts: [], claims: { cannot: [{ id: "no-chartership", statement: "Do not claim chartership or CEng status.", concepts: ["chartership"] }] } },
    });
    expect(result.issues).toEqual([
      expect.objectContaining({ kind: "forbidden-claim", concept: "chartership" }),
    ]);
  });

  it("blocks a known OpenAI API paraphrase prohibited by claims.cannot", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "Built live customer systems around GPT model endpoints.",
      canon: {
        facts: [],
        claims: {
          cannot: [{ id: "no-openai", statement: "Do not claim hands-on production experience with the OpenAI API.", concepts: ["openai-api"] }],
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "forbidden-claim",
        path: "text",
        sourcePath: "claims.cannot[0]",
      }),
    ]);
  });

  it("allows GPT tool fluency when only OpenAI API integration is prohibited", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "Use Cursor daily for coding with GPT-backed assistance.",
      canon: {
        facts: [],
        claims: {
          cannot: [{ id: "no-openai", statement: "Do not claim hands-on production experience with the OpenAI API.", concepts: ["openai-api"] }],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects an unknown fact ID at its exact path", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "The Launch interlock completed 58 gate runs during the audit period.",
      canon: { facts: [] },
      metricClaims: [{
        id: "claim-launch-runs",
        text: "The Launch interlock completed 58 gate runs during the audit period.",
        factIds: ["fact-launch-interlok"],
        value: 58,
        unit: "gate runs",
        subject: "Launch interlock",
        timeframe: "audit period",
      }],
    });

    expect(result.issues).toEqual([
      expect.objectContaining({ kind: "unknown-fact-reference", path: "metricClaims[0].factIds[0]" }),
    ]);
  });

  it("rejects a structured metric with no referenced fact IDs", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "The Launch interlock completed 58 gate runs during the audit period.",
      canon: {
        facts: [{
          id: "fact-launch-interlock",
          metrics: [{ value: 58, unit: "gate runs", subject: "Launch interlock", timeframe: "audit period" }],
        }],
      },
      metricClaims: [{
        id: "claim-launch-runs",
        text: "The Launch interlock completed 58 gate runs during the audit period.",
        factIds: [],
        value: 58,
        unit: "gate runs",
        subject: "Launch interlock",
        timeframe: "audit period",
      }],
    });

    expect(result.issues).toEqual([
      expect.objectContaining({ kind: "missing-fact-reference", path: "metricClaims[0].factIds" }),
    ]);
  });

  it("rejects a metric assembled from another fact's value and this fact's subject", async () => {
    const modulePath = "./prohibitedClaims.js";
    const gate = await import(modulePath).catch(() => undefined);
    const canon = {
      facts: [
        {
          id: "fact-beacon-history",
          metrics: [{ value: 124, unit: "commits", subject: "Beacon repository", timeframe: "since launch" }],
        },
        {
          id: "fact-launch-interlock",
          metrics: [{ value: 58, unit: "gate runs", subject: "Launch interlock", timeframe: "audit period" }],
        },
      ],
    };

    const result = gate?.analyzeProhibitedClaims?.({
      text: "The Launch interlock completed 124 gate runs during the audit period.",
      canon,
      metricClaims: [
        {
          id: "claim-launch-runs",
          text: "The Launch interlock completed 124 gate runs during the audit period.",
          factIds: ["fact-beacon-history", "fact-launch-interlock"],
          value: 124,
          unit: "gate runs",
          subject: "Launch interlock",
          timeframe: "audit period",
        },
      ],
    });

    expect(result?.ok).toBe(false);
    expect(result?.issues).toEqual([
      expect.objectContaining({
        kind: "metric-conflict",
        path: "metricClaims[0]",
      }),
    ]);
  });

  it("binds a project year to exact synthetic source and owner evidence", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const baseEvidence = {
      text: "Gatehouse 2024",
      markers: [{
        path: "projects[0].year", tag: "div", classes: ["meta"], text: "2024", visible: true,
        textBefore: "Gatehouse ", offset: 10, entryPath: "projects[0]", entryVisible: true, entryCount: 1, contextGroup: "0",
      }],
      owners: [{
        path: "projects[0].name", tag: "span", classes: ["project-name"], text: "Gatehouse", visible: true,
        entryPath: "projects[0]", entryVisible: true, entryCount: 1, parentTag: "div", parentClasses: ["title"], parentGroup: "0", contextClasses: ["eh"], contextGroup: "0",
      }],
    };
    const analyze = (renderedDocument: typeof baseEvidence) => analyzeProhibitedClaims({
      text: "ignored static HTML",
      canon: { facts: [], projects: [{ name: "Gatehouse", year: "2024" }] },
      numericExemptions: [{
        id: "gatehouse-year", text: "Gatehouse 2024", classification: "date", sourcePaths: ["projects[0].year"],
      }],
      renderedDocument,
    });

    expect(analyze(baseEvidence).issues).toEqual([]);
    const attacks = [
      (e: typeof baseEvidence) => { e.markers[0].path = "projects[1].year"; },
      (e: typeof baseEvidence) => { e.markers[0].text = "2025"; },
      (e: typeof baseEvidence) => { e.markers[0].offset = 0; },
      (e: typeof baseEvidence) => { e.owners[0].path = "projects[1].name"; },
      (e: typeof baseEvidence) => { e.owners[0].text = "Acme"; },
      (e: typeof baseEvidence) => { e.owners[0].classes = ["notes"]; },
      (e: typeof baseEvidence) => { e.owners[0].entryPath = "projects[1]"; },
      (e: typeof baseEvidence) => { e.owners[0].entryCount = 2; },
    ];
    for (const attack of attacks) {
      const evidence = structuredClone(baseEvidence);
      attack(evidence);
      expect(analyze(evidence).issues).toContainEqual(expect.objectContaining({ kind: "invalid-numeric-exemption" }));
    }
  });

  it("rejects spoofed owner headings even when canonical names are buried in notes", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const project = analyzeProhibitedClaims({
      text: "ignored",
      canon: { facts: [], projects: [{ name: "Gatehouse", year: "2024" }] },
      numericExemptions: [{ id: "year", text: "Acme 2024", classification: "date", sourcePaths: ["projects[0].year"] }],
      renderedDocument: {
        text: "Acme 2024 Gatehouse buried in notes",
        markers: [{ path: "projects[0].year", tag: "div", classes: ["meta"], text: "2024", visible: true, textBefore: "Acme ", offset: 5, entryPath: "projects[0]", entryVisible: true, entryCount: 1, contextGroup: "0" }],
        owners: [{ path: "projects[0].name", tag: "span", classes: ["project-name"], text: "Gatehouse", visible: true, entryPath: "projects[0]", entryVisible: true, entryCount: 1, parentTag: "div", parentClasses: ["notes"], parentGroup: "1", contextClasses: [], contextGroup: "1" }],
      },
    });
    expect(project.issues).toContainEqual(expect.objectContaining({ kind: "invalid-numeric-exemption" }));

    const experience = analyzeProhibitedClaims({
      text: "ignored",
      canon: { facts: [], experience: [{ title: "Engineer", org: "Northwind", start: "2022", end: "Present" }] },
      numericExemptions: [{ id: "range", text: "Acme Engineer 2022–Present", classification: "date", sourcePaths: ["experience[0].start", "experience[0].end"] }],
      renderedDocument: {
        text: "Acme Engineer 2022–Present Engineer Northwind buried in notes",
        markers: [
          { path: "experience[0].start", tag: "span", classes: [], text: "2022", visible: true, textBefore: "Acme Engineer ", offset: 14, entryPath: "experience[0]", entryVisible: true, entryCount: 1, metaGroup: "0", metaText: "2022–Present", contextGroup: "0" },
          { path: "experience[0].end", tag: "span", classes: [], text: "Present", visible: true, textBefore: "Acme Engineer 2022–", offset: 19, entryPath: "experience[0]", entryVisible: true, entryCount: 1, metaGroup: "0", metaText: "2022–Present", contextGroup: "0" },
        ],
        owners: [
          { path: "experience[0].title", tag: "span", classes: ["title"], text: "Engineer", visible: true, entryPath: "experience[0]", entryVisible: true, entryCount: 1, parentTag: "div", parentClasses: ["notes"], parentGroup: "1", contextClasses: [], contextGroup: "1" },
          { path: "experience[0].org", tag: "span", classes: ["org"], text: "Northwind", visible: true, entryPath: "experience[0]", entryVisible: true, entryCount: 1, parentTag: "div", parentClasses: ["notes"], parentGroup: "1", contextClasses: [], contextGroup: "1" },
        ],
      },
    });
    expect(experience.issues).toContainEqual(expect.objectContaining({ kind: "invalid-numeric-exemption" }));
  });

  it("does not let a later Acme range borrow an earlier exact Northwind range", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: "ignored",
      canon: { facts: [], experience: [{ title: "Engineer", org: "Northwind", start: "2022", end: "Present" }] },
      numericExemptions: [{ id: "borrowed", text: "Acme Engineer 2022–Present", classification: "date", sourcePaths: ["experience[0].start", "experience[0].end"] }],
      renderedDocument: {
        text: "Engineer Northwind 2022–Present Acme Engineer 2022–Present",
        markers: [
          { path: "experience[0].start", tag: "span", classes: [], text: "2022", visible: true, textBefore: "Engineer Northwind ", offset: 19, entryPath: "experience[0]", entryVisible: true, entryCount: 1, metaGroup: "0", metaText: "2022–Present", contextGroup: "0" },
          { path: "experience[0].end", tag: "span", classes: [], text: "Present", visible: true, textBefore: "Engineer Northwind 2022–", offset: 24, entryPath: "experience[0]", entryVisible: true, entryCount: 1, metaGroup: "0", metaText: "2022–Present", contextGroup: "0" },
        ],
        owners: [
          { path: "experience[0].title", tag: "span", classes: ["title"], text: "Engineer", visible: true, entryPath: "experience[0]", entryVisible: true, entryCount: 1, parentTag: "div", parentClasses: [], parentGroup: "0", contextClasses: ["eh"], contextGroup: "0" },
          { path: "experience[0].org", tag: "span", classes: ["org"], text: "Northwind", visible: true, entryPath: "experience[0]", entryVisible: true, entryCount: 1, parentTag: "div", parentClasses: [], parentGroup: "0", contextClasses: ["eh"], contextGroup: "0" },
        ],
      },
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "invalid-numeric-exemption" }));
  });

  it("fails closed when a canon-bound date has no browser-rendered evidence", async () => {
    const { analyzeProhibitedClaims } = await import("./prohibitedClaims.js");
    const result = analyzeProhibitedClaims({
      text: '<div data-canon-entry="projects[0]"><b>Gatehouse</b><div class="meta" data-canon-source="projects[0].year">2024</div></div>',
      canon: { facts: [], projects: [{ name: "Gatehouse", year: "2024" }] },
      numericExemptions: [{
        id: "gatehouse-year",
        text: "Gatehouse 2024",
        classification: "date",
        sourcePaths: ["projects[0].year"],
      }],
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "invalid-numeric-exemption" }));
  });
});
