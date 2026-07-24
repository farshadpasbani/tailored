import { describe, expect, it } from "vitest";

describe("parseCanonV2", () => {
  it("rejects a duplicate fact ID at the second ID's exact path", async () => {
    const { parseCanonV2 } = await import("./load.js");
    const fact = (statement: string) => ({
      id: "fact-duplicate",
      statement,
      kind: "achievement",
      subject: "Launch interlock",
      provenance: { type: "candidate-attested" as const, source: "candidate" },
      verifiedOn: "2026-07-12",
      status: "verified" as const,
      confidence: 1,
      allowedUses: ["cv"],
      sensitivity: "private" as const,
    });
    const result = parseCanonV2({
      schemaVersion: 2,
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      facts: [fact("First statement."), fact("Second statement.")],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(expect.stringMatching(/^facts\.1\.id: Duplicate fact ID/));
    }
  });

  it("rejects a misspelled metric key with its exact array path", async () => {
    const loader = await import("./load.js") as Record<string, unknown>;
    const parseCanonV2 = loader.parseCanonV2 as
      | ((raw: unknown) => { ok: boolean; errors?: string[] })
      | undefined;
    const result = parseCanonV2?.({
      schemaVersion: 2,
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      facts: [{
        id: "fact-launch-interlock",
        statement: "The launch interlock completed 58 gate runs.",
        kind: "achievement",
        subject: "Launch interlock",
        metrics: [{
          value: 58,
          unit: "gate runs",
          subject: "Launch interlock",
          timeframe: "audit period",
          timefram: "typo must not be stripped",
        }],
        provenance: { type: "candidate-attested", source: "candidate" },
        verifiedOn: "2026-07-12",
        status: "verified",
        confidence: 1,
        allowedUses: ["cv"],
        sensitivity: "private",
      }],
    });

    expect(result?.ok).toBe(false);
    expect(result?.errors).toContainEqual(expect.stringMatching(/^facts\.0\.metrics\.0\.timefram:/));
  });

  it("rejects a misspelled fact key with its exact array path", async () => {
    const loader = await import("./load.js") as Record<string, unknown>;
    const parseCanonV2 = loader.parseCanonV2 as
      | ((raw: unknown) => { ok: boolean; errors?: string[] })
      | undefined;
    const result = parseCanonV2?.({
      schemaVersion: 2,
      identity: { name: "Alex Rivers", role: "AI Engineer" },
      facts: [{
        id: "fact-launch-interlock",
        statement: "The launch interlock completed 58 gate runs.",
        statment: "typo must not be stripped",
        kind: "achievement",
        subject: "Launch interlock",
        provenance: { type: "candidate-attested", source: "candidate" },
        verifiedOn: "2026-07-12",
        status: "verified",
        confidence: 1,
        allowedUses: ["cv"],
        sensitivity: "private",
      }],
    });

    expect(result?.ok).toBe(false);
    expect(result?.errors).toContainEqual(expect.stringMatching(/^facts\.0\.statment:/));
  });

  it("rejects a one-character nested-key typo with its exact path", async () => {
    const loader = await import("./load.js") as Record<string, unknown>;
    const parseCanonV2 = loader.parseCanonV2 as
      | ((raw: unknown) => { ok: boolean; errors?: string[] })
      | undefined;
    const result = parseCanonV2?.({
      schemaVersion: 2,
      identity: { name: "Alex Rivers", role: "AI Engineer", locaton: "Manchester" },
      facts: [],
    });

    expect(result?.ok).toBe(false);
    expect(result?.errors).toContainEqual(expect.stringMatching(/^identity\.locaton:/));
  });
});
