import { z } from "zod";
import { PROHIBITION_CONCEPTS } from "./prohibitions.js";
const Link = z.object({ label: z.string(), url: z.string().url() });
const Project = z.object({ name: z.string(), tagline: z.string().optional(), year: z.string().optional(), links: z.array(Link).optional(), bullets: z.array(z.string()).min(1) });
const Experience = z.object({ title: z.string(), org: z.string(), location: z.string().optional(), start: z.string(), end: z.string().default("Present"), bullets: z.array(z.string()).min(1) });
const Education = z.object({ qualification: z.string(), institution: z.string(), result: z.string().optional(), year: z.string(), note: z.string().optional() });
const LegacyClaimsSchema = z.object({ can: z.array(z.string()).optional(), cannot: z.array(z.string()).optional() });
export const LegacyCanonSchema = z.object({
  identity: z.object({ name: z.string().min(1), role: z.string().min(1), location: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), links: z.array(Link).optional() }),
  summary: z.string().optional(),
  skills: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  projects: z.array(Project).default([]),
  experience: z.array(Experience).default([]),
  education: z.array(Education).default([]),
  certifications: z.array(z.string()).default([]),
  publications: z.array(z.string()).default([]),
  protectedTopics: z.array(z.string()).default([]),
  claims: LegacyClaimsSchema.optional(),
});
export type LegacyCanon = z.infer<typeof LegacyCanonSchema>;

const IdentityV2Schema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
}).strict();

const FactProvenanceV2Schema = z.object({
  type: z.enum(["candidate-attested", "artifact", "external"]),
  source: z.string().min(1),
  method: z.string().min(1).optional(),
  notes: z.array(z.string()).optional(),
}).strict();

export const StructuredMetricV2Schema = z.object({
  value: z.number().finite(),
  unit: z.string().min(1),
  subject: z.string().min(1),
  denominator: z.string().min(1).optional(),
  scale: z.string().min(1).optional(),
  timeframe: z.string().min(1).optional(),
}).strict();

export const FactV2Schema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  kind: z.string().min(1),
  subject: z.string().min(1),
  metrics: z.array(StructuredMetricV2Schema).optional(),
  provenance: FactProvenanceV2Schema,
  verifiedOn: z.string().min(1),
  status: z.enum(["verified", "candidate-attested", "unverified", "disputed"]),
  confidence: z.number().min(0).max(1),
  allowedUses: z.array(z.string()),
  sensitivity: z.enum(["public", "private", "confidential"]),
  prohibitedTransforms: z.array(z.string()).optional(),
}).strict();

const LinkV2Schema = z.object({
  label: z.string(),
  url: z.string().url(),
}).strict();

const IdentityDetailsV2Schema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  location: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  links: z.array(LinkV2Schema).optional(),
}).strict();

const SkillV2Schema = z.object({
  label: z.string(),
  value: z.string(),
}).strict();

const ProjectV2Schema = z.object({
  name: z.string(),
  tagline: z.string().optional(),
  year: z.string().optional(),
  links: z.array(LinkV2Schema).optional(),
  bullets: z.array(z.string()).min(1),
}).strict();

const ExperienceV2Schema = z.object({
  title: z.string(),
  org: z.string(),
  location: z.string().optional(),
  start: z.string(),
  end: z.string().default("Present"),
  bullets: z.array(z.string()).min(1),
}).strict();

const EducationV2Schema = z.object({
  qualification: z.string(),
  institution: z.string(),
  result: z.string().optional(),
  year: z.string(),
  note: z.string().optional(),
}).strict();

const ClaimsV2Schema = z.object({
  can: z.array(z.string()).optional(),
  cannot: z.array(z.object({
    id: z.string().min(1),
    statement: z.string().min(1),
    concepts: z.array(z.enum(PROHIBITION_CONCEPTS)).min(1),
  }).strict()).optional(),
}).strict();

const VerifiedFactGroupV2Schema = z.object({
  factIds: z.array(z.string().min(1)).min(1),
}).strict();

const TalkingPointV2Schema = z.object({
  addedOn: z.string(),
  useFor: z.string(),
  rule: z.string(),
  hierarchy: z.array(z.string()),
  proof: z.string(),
  keyWord: z.string(),
  line: z.string(),
}).strict();

const PositioningV2Schema = z.object({
  coreThesis: z.string(),
  defaultPositioning: z.array(z.string()),
}).strict();

const NumbersThatStandV2Schema = z.object({
  approved: z.array(z.string()),
  rule: z.string(),
}).strict();

export const CanonV2ObjectSchema = z.object({
  schemaVersion: z.literal(2),
  identity: IdentityDetailsV2Schema,
  summary: z.string().optional(),
  skills: z.array(SkillV2Schema).default([]),
  projects: z.array(ProjectV2Schema).default([]),
  experience: z.array(ExperienceV2Schema).default([]),
  education: z.array(EducationV2Schema).default([]),
  certifications: z.array(z.string()).default([]),
  publications: z.array(z.string()).default([]),
  protectedTopics: z.array(z.string()).default([]),
  claims: ClaimsV2Schema.optional(),
  verifiedFacts: z.record(VerifiedFactGroupV2Schema).default({}),
  talkingPoints: z.record(TalkingPointV2Schema).default({}),
  positioning: PositioningV2Schema.optional(),
  ipBoundaries: z.array(z.string()).default([]),
  discretion: z.record(z.string()).default({}),
  draftingGuidance: z.record(z.string()).default({}),
  numbersThatStand: NumbersThatStandV2Schema.optional(),
  facts: z.array(FactV2Schema).default([]),
}).strict();

export const LEGACY_CANON_NAMESPACES = Object.freeze(
  Object.keys(CanonV2ObjectSchema.shape).filter((key) => key !== "schemaVersion" && key !== "facts")
);

export const CanonV2Schema = CanonV2ObjectSchema.superRefine((canon, context) => {
  const seen = new Set<string>();
  canon.facts.forEach((fact, index) => {
    if (seen.has(fact.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["facts", index, "id"],
        message: `Duplicate fact ID ${JSON.stringify(fact.id)}`,
      });
    }
    seen.add(fact.id);
  });
  for (const [group, value] of Object.entries(canon.verifiedFacts)) {
    value.factIds.forEach((id, index) => {
      if (!seen.has(id)) context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifiedFacts", group, "factIds", index],
        message: `Unknown fact ID ${JSON.stringify(id)}`,
      });
    });
  }
  const prohibitionIds = new Set<string>();
  canon.claims?.cannot?.forEach((prohibition, index) => {
    if (prohibitionIds.has(prohibition.id)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claims", "cannot", index, "id"],
      message: `Duplicate prohibition ID ${JSON.stringify(prohibition.id)}`,
    });
    prohibitionIds.add(prohibition.id);
  });
});
export type CanonV2 = z.infer<typeof CanonV2Schema>;
export const CanonSchema = CanonV2Schema;
export type Canon = CanonV2;
