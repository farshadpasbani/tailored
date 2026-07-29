import { describe, it, expect } from "vitest";
import { GATES, PACK_GATES, gateCommands, gate, SMOKE_SET } from "./registry.js";
import type { Gate, GateInput, PackGate } from "./gate.js";
import { verifyPolicySchemaFor, VerifyPolicySchema, REQUIRED_BLOCKING_GATES, REQUIRED_ADVISORY_GATES } from "../policy/verify.js";
import { assembleFindings } from "../verify/pack.js";
import { buildProgram, smokeCalls, COMMAND_ORDER, BUILTIN_COMMANDS } from "../cli.js";

/**
 * The receipt vocabulary, written out by hand. Every policy.yaml in existence and every
 * receipt ever issued speaks these exact strings in this exact order, so this is a copy of
 * that contract rather than a projection of the registry: a change on either side fails here.
 */
const RECEIPT_ORDER = [
  "canon-schema", "evidence-schema", "requirements-trust", "fit-blockers", "protected-topics",
  "prohibited-claims", "claim-integrity", "pdf-text-layer", "page-integrity", "corpus-eligibility",
  "ats", "ai-tell", "impact", "distinctness", "strategy-selection", "evidence-altitude",
  "editorial", "accessibility",
];

/** The severity each of those IDs carries, likewise written out rather than derived. */
const RECEIPT_SEVERITY: Record<string, "blocking" | "advisory"> = {
  "canon-schema": "blocking", "evidence-schema": "blocking", "requirements-trust": "blocking",
  "fit-blockers": "blocking", "protected-topics": "blocking", "prohibited-claims": "blocking",
  "claim-integrity": "blocking", "pdf-text-layer": "blocking", "page-integrity": "blocking",
  "corpus-eligibility": "blocking",
  ats: "advisory", "ai-tell": "advisory", impact: "advisory", distinctness: "advisory",
  "strategy-selection": "advisory", "evidence-altitude": "advisory", editorial: "advisory",
  accessibility: "advisory",
};

/**
 * The one-file-plus-one-registration proof. `synthetic-check` exists only here: it is
 * registered into a copy of the registry and must reach CLI dispatch, policy derivation,
 * and verify-pack assembly without any other module being edited.
 */
const synthetic: PackGate = {
  id: "synthetic-check",
  severity: "advisory",
  run: async (input: GateInput) => ({
    id: "synthetic-check",
    ok: false,
    messages: input.artifacts.map(artifact => `synthetic saw ${artifact.id}`),
  }),
  command: {
    name: "synthetic-check",
    description: "a gate registered by a test",
    arguments: [{ name: "<html>", description: "path" }],
    options: [{ flags: "--limit <n>", description: "a limit", default: "3" }],
    run: async () => ({ id: "synthetic-check", ok: true, messages: [], summary: "synthetic" }),
  },
};

const registry: readonly Gate[] = [...GATES, synthetic];
const packRegistry: readonly PackGate[] = [...PACK_GATES, synthetic];

const policyThresholds = {
  atsMinimum: 0.8, fitMinimumConfidence: 0.5, fitMinimumScore: 0.8,
  minimumFontPt: 9, minimumMarginMm: 8, minimumLineHeight: 1.28,
  maximumSharedRuns: 0, maximumSignaturePhrases: 0,
};

describe("the registry owns the gate set", () => {
  it("declares the pack lane in receipt order", () => {
    expect(PACK_GATES.map(entry => entry.id)).toEqual(RECEIPT_ORDER);
  });

  it("gives every pack gate the severity its ID has always carried", () => {
    for (const entry of PACK_GATES) expect(`${entry.id}=${entry.severity}`).toBe(`${entry.id}=${RECEIPT_SEVERITY[entry.id]}`);
  });

  it("projects those same IDs into the policy schema's required set", () => {
    expect([...REQUIRED_BLOCKING_GATES]).toEqual(RECEIPT_ORDER.filter(id => RECEIPT_SEVERITY[id] === "blocking"));
    expect([...REQUIRED_ADVISORY_GATES]).toEqual(RECEIPT_ORDER.filter(id => RECEIPT_SEVERITY[id] === "advisory"));
  });

  it("keeps every declared gate ID unique across both lanes", () => {
    const ids = GATES.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a smoke gate-set that resolves against the registry, with an invocation for each", () => {
    const calls = smokeCalls("cv.html", "cv.pdf", name => name);
    expect(SMOKE_SET.length).toBeGreaterThan(0);
    for (const id of SMOKE_SET) {
      expect(gate(id).command).not.toBeNull();
      expect(calls).toHaveProperty(id);
    }
  });

  it("pins the published help order against the commands actually registered", () => {
    expect(new Set(COMMAND_ORDER)).toEqual(new Set([...BUILTIN_COMMANDS.keys(), ...gateCommands().map(command => command.name)]));
    expect(buildProgram().commands.map(command => command.name())).toEqual(COMMAND_ORDER);
  });
});

describe("adding a gate is one file plus one registration", () => {
  it("reaches CLI dispatch", () => {
    const names = buildProgram(registry).commands.map(command => command.name());
    expect(names).toContain("synthetic-check");
    // Every registry command is dispatched, not just the synthetic one.
    for (const command of gateCommands(registry)) expect(names).toContain(command.name);
  });

  it("carries its declared flags into the dispatched command", () => {
    const command = buildProgram(registry).commands.find(entry => entry.name() === "synthetic-check");
    expect(command?.options.map(option => option.flags)).toContain("--limit <n>");
  });

  it("reaches policy derivation", () => {
    const schema = verifyPolicySchemaFor(packRegistry);
    const policy = {
      schemaVersion: 1,
      gates: [...PACK_GATES.map(entry => ({ id: entry.id, severity: entry.severity })), { id: "synthetic-check", severity: "advisory" }],
      thresholds: policyThresholds,
    };
    expect(schema.safeParse(policy).success).toBe(true);
    // The shipped schema derives from the shipped registry, so it rejects the unknown gate.
    expect(VerifyPolicySchema.safeParse(policy).success).toBe(false);
  });

  it("reaches verify-pack assembly", async () => {
    const input = { artifacts: [{ id: "cv", html: "<p>x</p>", pdfText: "x" }] } as unknown as GateInput;
    const policy = { schemaVersion: 1 as const, gates: [{ id: "synthetic-check" as never, severity: "advisory" as const }], thresholds: policyThresholds };
    const findings = await assembleFindings(input, policy, { waivers: [], attestations: [], packSha256: "a", policySha256: "b" }, [synthetic]);
    expect(findings).toEqual([{
      id: "synthetic-check", severity: "advisory", ok: false,
      messages: ["synthetic saw cv"], disposition: "review-required",
    }]);
  });
});
