import { describe, expect, it } from "vitest";

function leaves(value: unknown, path = ""): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      leaves(item, path ? `${path}.${key}` : key)
    );
  }
  return [{ path, value }];
}

describe("migrateCanon", () => {
  it("does not silently grant legacy verified facts authority for fit", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const result = migrateCanon({ identity: { name: "Alex", role: "Engineer" }, verifiedFacts: { proof: { verifiedOn: "2026-07-12", points: ["Built a verified system."] } } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.facts[0].allowedUses).not.toContain("fit");
  });

  it("returns already-migrated v2 data unchanged", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const source = {
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      verifiedFacts: {
        launch: {
          verifiedOn: "2026-07-12",
          points: ["The launch interlock completed 58 gate runs."],
        },
      },
    };
    const first = migrateCanon(source);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = migrateCanon(first.data);

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data).toEqual(first.data);
  });

  it("maps every current v1 namespace without losing a source leaf", async () => {
    const source = {
      identity: {
        name: "Alex Rivers", role: "AI Engineer", location: "Manchester",
        email: "alex@example.com", phone: "+1 202 555 0142",
        links: [{ label: "Portfolio", url: "https://example.com" }],
      },
      summary: "Builds reliable systems.",
      skills: [{ label: "Languages", value: "TypeScript" }],
      projects: [{
        name: "Beacon", tagline: "A guarded workflow", year: "2026",
        links: [{ label: "Source", url: "https://example.com/beacon" }],
        bullets: ["Completed a bounded delivery cycle."],
      }],
      experience: [{
        title: "Engineer", org: "Example Works", location: "Leeds",
        start: "2024", end: "Present", bullets: ["Delivered audited changes."],
      }],
      education: [{
        qualification: "MEng", institution: "Example University", result: "Distinction",
        year: "2023", note: "Part-time study.",
      }],
      certifications: ["Example certificate"],
      publications: ["Example publication"],
      protectedTopics: ["Project Juniper"],
      claims: { can: ["Discuss public work."], cannot: ["Claim production AWS experience."] },
      verifiedFacts: {
        beacon: {
          verifiedOn: "2026-07-12", method: "Candidate-attested review.",
          calibration: "Bounded to the stated audit.", ipNote: "Do not expose internals.",
          points: ["The launch interlock completed 58 gate runs."],
        },
      },
      talkingPoints: {
        initiative: {
          addedOn: "2026-07-11", useFor: "Leadership roles", rule: "Use only when relevant.",
          hierarchy: ["Need", "Action", "Result"], proof: "Public delivery record.",
          keyWord: "initiative", line: "Found and closed the delivery gap.",
        },
      },
      positioning: {
        coreThesis: "Evidence before claims.",
        defaultPositioning: ["Systems delivery", "Deterministic assurance"],
      },
      ipBoundaries: ["Keep client implementation details private."],
      discretion: { visaSponsor: "Discuss when asked.", searchConfidentiality: "Private search." },
      draftingGuidance: {
        roleCondensation: "Condense overlapping roles.",
        educationOrdering: "Most relevant first.",
      },
      numbersThatStand: {
        approved: ["58 audited gate runs"],
        rule: "Use only with the matching subject and timeframe.",
      },
    };
    const { migrateCanon } = await import("./migrate.js");
    const { parseCanonV2 } = await import("./load.js");
    const result = migrateCanon(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parseCanonV2(result.data).ok).toBe(true);
    expect(result.unmapped).toEqual([]);
    const sourceLeaves = leaves(source);
    expect(result.report.mapped.map((entry) => entry.sourcePath).sort())
      .toEqual(sourceLeaves.map((entry) => entry.path).sort());
    const migratedValues = leaves(result.data).map((entry) => entry.value);
    for (const leaf of sourceLeaves) expect(migratedValues).toContain(leaf.value);
  });

  it("reports an unmapped source namespace instead of dropping it", async () => {
    const modulePath = "./migrate.js";
    const migration = await import(modulePath).catch(() => undefined);
    const result = migration?.migrateCanon?.({
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      draftingGudance: { summary: "Keep this source value." },
    });

    expect(result?.ok).toBe(false);
    expect(result?.unmapped).toEqual(["draftingGudance"]);
  });

  it("reports nested unmapped data at its exact source path", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const result = migrateCanon({
      identity: { name: "Alex Rivers", role: "AI Engineer", locaton: "Manchester" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unmapped).toEqual(["identity.locaton"]);
  });

  it("rejects empty, scalar, and malformed v2 inputs without throwing", async () => {
    const { migrateCanon } = await import("./migrate.js");
    for (const source of [undefined, null, "", 0, {}, { schemaVersion: 2 }]) {
      const result = migrateCanon(source);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects duplicate IDs in an existing v2 canon", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const fact = {
      id: "fact-duplicate",
      statement: "A bounded claim.",
      kind: "attested",
      subject: "Example",
      provenance: { type: "candidate-attested", source: "candidate" },
      verifiedOn: "2026-07-12",
      status: "candidate-attested",
      confidence: 1,
      allowedUses: ["cv"],
      sensitivity: "private",
    };
    const result = migrateCanon({
      schemaVersion: 2,
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      facts: [fact, { ...fact, statement: "Another bounded claim." }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.stringMatching(/^facts\.1\.id:/));
  });

  it("generates deterministic unique IDs for duplicate source statements", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const source = {
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      verifiedFacts: {
        launch: {
          verifiedOn: "2026-07-12",
          points: ["Completed 58 gate runs.", "Completed 58 gate runs."],
        },
      },
    };
    const first = migrateCanon(source);
    const second = migrateCanon(structuredClone(source));
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(new Set(first.data.facts.map((fact) => fact.id)).size).toBe(2);
      expect(first.data.facts[1].id).toBe(`${first.data.facts[0].id}-2`);
    }
  });

  it("classifies actual-style prohibitions into stable concept IDs", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const cannot = [
      "ANSYS: never used it. The structural MSc used Abaqus.",
      "AWS: the cloud certifications in progress are Azure, not AWS.",
      "Postgres / MySQL by name: shipped relational work is SQLite; never claim shipped Postgres/MySQL.",
      "Any internal employer tool detail, proprietary specifics, or personal-ownership claim over employer IP.",
      "Total years of experience as a stated number: never quantify career length.",
    ];
    const result = migrateCanon({
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      claims: { cannot },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.claims?.cannot.map((entry) => entry.concepts)).toEqual([
      ["ansys-hands-on"], ["aws-production"], ["database-production"], ["internal-ip"], ["ai-tenure"],
    ]);
  });

  it("fails migration when a prohibition cannot be classified", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const result = migrateCanon({
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      claims: { cannot: ["Never claim the moon is made of cheese."] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.stringMatching(/^claims\.cannot\.0: unclassifiable prohibition/));
  });

  it("moves verified point statements into canonical facts and leaves only references", async () => {
    const { migrateCanon } = await import("./migrate.js");
    const statement = "Coding agents landed 124 agent-authored commits across 5 repositories since 2026-06-01.";
    const result = migrateCanon({
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      verifiedFacts: { fleet: { verifiedOn: "2026-07-12", points: [statement] } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.facts[0].statement).toBe(statement);
    expect(result.data.verifiedFacts.fleet).toEqual({
      factIds: [result.data.facts[0].id],
    });
    expect(JSON.stringify(result.data.verifiedFacts)).not.toContain(statement);
    expect(result.data.facts[0].metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: 124, unit: "commits", subject: "coding-agent fleet",
        denominator: "not-applicable", scale: "absolute", timeframe: "2026-06-01",
      }),
    ]));
  });
});
