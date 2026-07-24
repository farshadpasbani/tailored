import { z } from "zod";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { StructuredMetricV2Schema } from "../canon/schema.js";

const StableIdSchema = z.string().min(1).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Must be a stable lowercase ID");

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "Must be a lowercase SHA-256 digest");
const MetricDimensionSchema = z.string().min(1).refine(
  value => value === "not-applicable" || !/^(?:n[.\/]?a\.?|none|null|not[ _-]?applicable|[-–—])$/i.test(value),
  "Use the exact literal 'not-applicable' when a metric dimension does not apply",
);
export const CompleteStructuredMetricSchema = StructuredMetricV2Schema.extend({
  unit: MetricDimensionSchema,
  subject: MetricDimensionSchema,
  denominator: MetricDimensionSchema,
  scale: MetricDimensionSchema,
  timeframe: MetricDimensionSchema,
});

const ArtifactSchema = z.object({
  id: StableIdSchema,
  path: z.string().min(1),
  sha256: Sha256Schema,
  resourceRoot: z.string().min(1),
  resources: z.array(z.object({ path: z.string().min(1), sha256: Sha256Schema }).strict()),
  resourceManifestSha256: Sha256Schema,
}).strict();

const EmployerSourceSchema = z.object({
  id: StableIdSchema,
  subject: z.string().min(1),
  text: z.string().min(1),
  archivePath: z.string().min(1),
  archiveSha256: Sha256Schema,
  textSha256: Sha256Schema,
  metrics: z.array(CompleteStructuredMetricSchema).min(1).optional(),
}).strict();

const ClaimEvidenceCommonSchema = z.object({
  id: StableIdSchema,
  artifact: z.string().min(1),
  text: z.string().min(1),
  evidenceIds: z.array(StableIdSchema).min(1),
  artifactSha256: Sha256Schema,
  textSha256: Sha256Schema,
  bindingSha256: Sha256Schema,
  metrics: z.array(CompleteStructuredMetricSchema).min(1).optional(),
}).strict();

const ClaimEvidenceSchema = z.discriminatedUnion("namespace", [
  ClaimEvidenceCommonSchema.extend({ namespace: z.literal("candidate"), subject: z.literal("candidate") }),
  ClaimEvidenceCommonSchema.extend({ namespace: z.literal("employer"), subject: z.literal("employer") }),
]);

export const EvidenceFileObjectSchema = z.object({
  schemaVersion: z.literal(2),
  artifacts: z.array(ArtifactSchema).min(1),
  employerSources: z.array(EmployerSourceSchema).default([]),
  claims: z.array(ClaimEvidenceSchema).min(1),
}).strict();

export const EvidenceFileSchema = EvidenceFileObjectSchema.superRefine((evidence, context) => {
  const artifactIds = new Set<string>();
  evidence.artifacts.forEach((artifact, index) => {
    if (artifactIds.has(artifact.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "id"], message: `Duplicate artifact ID ${JSON.stringify(artifact.id)}` });
    artifactIds.add(artifact.id);
  });
  const employerIds = new Set<string>();
  evidence.employerSources.forEach((source, index) => {
    const normalized = source.id.toLowerCase();
    if (employerIds.has(normalized)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["employerSources", index, "id"],
      message: `Duplicate or case-colliding employer source ID ${JSON.stringify(source.id)}`,
    });
    employerIds.add(normalized);
  });

  const claimIds = new Set<string>();
  evidence.claims.forEach((claim, index) => {
    const normalized = claim.id.toLowerCase();
    if (claimIds.has(normalized)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claims", index, "id"],
      message: `Duplicate or case-colliding claim ID ${JSON.stringify(claim.id)}`,
    });
    claimIds.add(normalized);
    if (!artifactIds.has(claim.artifact)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claims", index, "artifact"],
      message: `Unknown artifact ID ${JSON.stringify(claim.artifact)}`,
    });
  });
});

export type EvidenceFile = z.infer<typeof EvidenceFileSchema>;
export type ClaimEvidence = EvidenceFile["claims"][number];

export type EvidenceParseResult = { ok: true; data: EvidenceFile } | { ok: false; errors: string[] };

function issuePath(issue: z.ZodIssue): string {
  return issue.path.join(".") || "(root)";
}

export function parseEvidenceFile(raw: unknown): EvidenceParseResult {
  const parsed = EvidenceFileSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.flatMap((issue) => issue.code === "unrecognized_keys"
      ? issue.keys.map((key) => `${[...issue.path, key].join(".")}: Unrecognized key`)
      : [`${issuePath(issue)}: ${issue.message}`]),
  };
}

export function loadEvidenceFile(path: string): EvidenceParseResult {
  let raw: unknown;
  try { raw = yaml.load(readFileSync(path, "utf8")); }
  catch (error) { return { ok: false, errors: [`could not read/parse YAML at ${path}: ${(error as Error).message}`] }; }
  return parseEvidenceFile(raw);
}
