import { describe, expect, it } from "vitest";
import type { LegacyJd } from "../jd/schema.js";
import { migrateLegacyJdToRequirements } from "./migrate.js";

const jd: LegacyJd = {
  role: "ML Engineer", company: "Example",
  mustHave: ["Python", "Python!"], niceToHave: ["Kubernetes"],
  synonyms: { Python: ["Py"] },
};
const options = {
  archivedJdText: "Python\nPython!\nKubernetes",
  frozenAt: "2026-07-12T12:00:00.000Z",
  baselineIssuer: "test-reviewer",
};

describe("legacy JD migration", () => {
  it("is deterministic and preserves keywords as ATS-only terms with explicit evidence gaps", () => {
    const first = migrateLegacyJdToRequirements(jd, options);
    const second = migrateLegacyJdToRequirements(jd, options);
    expect(first).toEqual(second);
    expect(first.requirements.map((r) => r.id)).toEqual(["req-python", "req-python-2", "req-kubernetes"]);
    expect(first.requirements[0]).toMatchObject({
      source: { quote: "Python", location: "archived JD line 1; legacy jd.yaml mustHave[0]" },
      classification: { frozen: "hard", current: "hard" },
      ats: { literals: [{ term: "Python" }], aliases: [{ term: "Py", forLiteral: "Python" }] },
      evidence: { kind: "gap" },
    });
    expect(first.requirements[2].classification.current).toBe("preferred");
  });

  it("binds the migration to the exact archived JD text", () => {
    const first = migrateLegacyJdToRequirements(jd, options);
    const changed = migrateLegacyJdToRequirements(jd, { ...options, archivedJdText: `${options.archivedJdText}\nchanged` });
    expect(first.archivedJd.sha256).not.toBe(changed.archivedJd.sha256);
  });

  it("refuses to invent a source quote for a legacy keyword absent from the archived JD", () => {
    expect(() => migrateLegacyJdToRequirements({ ...jd, mustHave: ["Rust"] }, options)).toThrow(/cannot be frozen/);
  });

  it("does not return a migration with an unusable baseline anchor", () => {
    expect(() => migrateLegacyJdToRequirements(jd, { ...options, baselineIssuer: "" })).toThrow();
    expect(() => migrateLegacyJdToRequirements(jd, { ...options, frozenAt: "not-an-instant" })).toThrow();
  });
});
