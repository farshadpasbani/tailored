import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
  GATES,
  PACK_GATES,
  SMOKE_SET,
  gate,
  gateCommands,
} from "./index.js";
import type { Finding, Gate, GateInput, GateSeverity, VerifyClaimIntegrityInput } from "./index.js";

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
    // The retired test-only verifier is replaced by data, not by a second entry point:
    // the public receipt declares which adapters produced it, and nothing else.
    expect(VerifyReceiptSchema.shape.dependencies.unwrap().options).toEqual(["production", "injected"]);
  });
});

describe("public gate-registry API", () => {
  it("exports the registry and the four gate types a consumer can act on", () => {
    expect(GATES.length).toBeGreaterThan(0);
    expect(PACK_GATES.length).toBeGreaterThan(0);
    expect(SMOKE_SET.length).toBeGreaterThan(0);
    expect(gate).toBeTypeOf("function");
    expect(gateCommands).toBeTypeOf("function");
    // Compile-time proof that each of the four is exported and usable from the entry point.
    const finding: Finding = { id: "x", ok: true, messages: [] };
    const severity: GateSeverity = "advisory";
    const entry: Gate = { id: finding.id, severity, run: null, command: null };
    const reader: (input: GateInput) => number = input => input.artifacts.length;
    expect([entry.id, reader]).toBeDefined();
  });

  it("keeps the CLI-declaration layer and the pack lane's internals off the published surface", () => {
    // A published package cannot un-export a type without a breaking change, so the shapes a
    // consumer should not pin are checked against the built declaration, not the source.
    const declaration = "dist/index.d.ts";
    if (!existsSync(declaration)) return;
    const exported = readFileSync(declaration, "utf8");
    const gateTypes = exported.match(/export type \{([^}]*)\} from ["']\.\/gates\/gate\.js["']/)?.[1] ?? "";
    expect(gateTypes.split(",").map(name => name.trim()).filter(Boolean).sort()).toEqual(["Finding", "Gate", "GateInput", "GateSeverity"]);
    for (const internal of ["GateCommand", "ConsoleReport", "GateArtifact", "GateThresholds", "PackGate"]) {
      expect(exported).not.toMatch(new RegExp(`\\b${internal}\\b`));
    }
  });
});

function expectTypeOnly<T extends never>(): void {}
