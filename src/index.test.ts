import { describe, expect, it } from "vitest";
import {
  CanonV2Schema,
  CanonSchema,
  LegacyCanonSchema,
  MetricClaimsFileSchema,
  analyzeProhibitedClaims,
  analyzeClaimIntegrity,
  analyzeClaimIntegrityPreflight,
  computeClaimBindingHash,
  EvidenceFileSchema,
  inspectRenderedDocument,
  migrateCanon,
  parseCanonV2,
  verifyClaimIntegrity,
  buildResourceManifest,
  verifyPack,
  verifyReceiptFreshness,
  VerifyReceiptSchema,
  RequirementsSchema,
  analyzeRequirementFit,
  analyzeRequirementAts,
  VerifyPolicySchema,
  CorpusDescriptorSchema,
  assertVerifierIssuedReceipt,
} from "./index.js";
import type { VerifyClaimIntegrityInput } from "./index.js";

describe("public canon v2 API", () => {
  it("exports the schema, loader, migration, and prohibited-claims gate", () => {
    expect(CanonV2Schema).toBeDefined();
    expect(CanonSchema).toBe(CanonV2Schema);
    expect(LegacyCanonSchema).not.toBe(CanonSchema);
    expect(MetricClaimsFileSchema).toBeDefined();
    expect(parseCanonV2).toBeTypeOf("function");
    expect(migrateCanon).toBeTypeOf("function");
    expect(analyzeProhibitedClaims).toBeTypeOf("function");
    expect(EvidenceFileSchema).toBeDefined();
    expect(analyzeClaimIntegrity).toBeTypeOf("function");
    expect(analyzeClaimIntegrityPreflight).toBeTypeOf("function");
    expect(computeClaimBindingHash).toBeTypeOf("function");
    expect(verifyClaimIntegrity).toBeTypeOf("function");
    expect(inspectRenderedDocument).toBeTypeOf("function");
    expect(buildResourceManifest).toBeTypeOf("function");
    expect(verifyPack).toBeTypeOf("function");
    expect(verifyReceiptFreshness).toBeTypeOf("function");
    expect(VerifyReceiptSchema).toBeDefined();
    expect(RequirementsSchema).toBeDefined();
    expect(analyzeRequirementFit).toBeTypeOf("function");
    expect(analyzeRequirementAts).toBeTypeOf("function");
    expect(VerifyPolicySchema).toBeDefined();
    expect(CorpusDescriptorSchema).toBeDefined();
    expect(assertVerifierIssuedReceipt).toBeTypeOf("function");
  });

  it("does not expose snapshot fault hooks to production callers", () => {
    expectTypeOnly<Extract<keyof VerifyClaimIntegrityInput, "snapshotWrite" | "onTemporaryCreated">>();
  });

  it("does not expose verify-pack test adapters or authoritative receipt constructors", async () => {
    const api = await import("./index.js");
    expect(api).not.toHaveProperty("verifyPackForTest");
    expect(api).not.toHaveProperty("TestVerifyReceiptSchema");
  });
});

function expectTypeOnly<T extends never>(): void {}
