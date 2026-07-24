import { describe, expect, it } from "vitest";
import { EvidenceFileSchema, parseEvidenceFile } from "./schema.js";

const digest = "a".repeat(64);
const valid = {
  schemaVersion: 2 as const,
  artifacts: [{ id: "cv", path: "cv.html", sha256: digest, resourceRoot: ".", resources: [], resourceManifestSha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" }],
  employerSources: [{ id: "employer.jd.example-scale", subject: "Example Ltd", text: "Example Ltd serves most of the market.", archivePath: "archive/jd.txt", archiveSha256: digest, textSha256: digest }],
  claims: [{ id: "cv.example-scale", artifact: "cv", text: "Example Ltd serves most of the market.", subject: "employer" as const, namespace: "employer" as const, evidenceIds: ["employer.jd.example-scale"], artifactSha256: digest, textSha256: digest, bindingSha256: digest }],
};

describe("EvidenceFileSchema", () => {
  it("accepts explicit subject/authority and archived hashes", () => expect(EvidenceFileSchema.parse(valid)).toEqual(valid));
  it.each([
    ["missing subject", { ...valid, claims: [{ ...valid.claims[0], subject: undefined }] }],
    ["missing artifact hash", { ...valid, claims: [{ ...valid.claims[0], artifactSha256: undefined }] }],
    ["bad digest", { ...valid, artifacts: [{ ...valid.artifacts[0], sha256: "short" }] }],
    ["missing resource contract", { ...valid, artifacts: [{ id: "cv", path: "cv.html", sha256: digest }] }],
    ["unknown artifact", { ...valid, claims: [{ ...valid.claims[0], artifact: "cover" }] }],
    ["unknown root key", { ...valid, surprise: true }],
    ["public subject", { ...valid, claims: [{ ...valid.claims[0], subject: "public" }] }],
    ["candidate subject with employer authority", { ...valid, claims: [{ ...valid.claims[0], subject: "candidate", namespace: "employer" }] }],
    ["employer subject with candidate authority", { ...valid, claims: [{ ...valid.claims[0], subject: "employer", namespace: "candidate" }] }],
  ])("rejects %s", (_label, input) => expect(EvidenceFileSchema.safeParse(input).success).toBe(false));

  it.each(["denominator", "scale", "timeframe"])("requires explicit metric %s (use not-applicable when valid)", field => {
    const complete = { value: 90, subject: "market coverage", unit: "percent", denominator: "market", scale: "relative share", timeframe: "current" };
    const missing = { ...complete } as Record<string, unknown>; delete missing[field];
    expect(EvidenceFileSchema.safeParse({ ...valid, claims: [{ ...valid.claims[0], metrics: [missing] }] }).success).toBe(false);
    expect(EvidenceFileSchema.safeParse({ ...valid, claims: [{ ...valid.claims[0], metrics: [{ ...complete, [field]: "not-applicable" }] }] }).success).toBe(true);
    expect(EvidenceFileSchema.safeParse({ ...valid, claims: [{ ...valid.claims[0], metrics: [{ ...complete, [field]: "N/A" }] }] }).success).toBe(false);
    for (const alias of ["n.a.", "not_applicable", "not applicable", "-"]) {
      expect(EvidenceFileSchema.safeParse({ ...valid, claims: [{ ...valid.claims[0], metrics: [{ ...complete, [field]: alias }] }] }).success).toBe(false);
    }
  });

  it("rejects case-colliding IDs with exact paths", () => {
    const parsed = parseEvidenceFile({ ...valid, employerSources: [valid.employerSources[0], { ...valid.employerSources[0], id: "EMPLOYER.JD.EXAMPLE-SCALE" }], claims: [valid.claims[0], { ...valid.claims[0], id: "CV.EXAMPLE-SCALE" }] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('employerSources.1.id: Duplicate or case-colliding employer source ID "EMPLOYER.JD.EXAMPLE-SCALE"');
      expect(parsed.errors).toContain('claims.1.id: Duplicate or case-colliding claim ID "CV.EXAMPLE-SCALE"');
    }
  });
});
