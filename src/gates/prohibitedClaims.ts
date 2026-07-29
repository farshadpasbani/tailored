import { z } from "zod";
import type { ProhibitionConcept } from "../canon/prohibitions.js";
import type { RenderedDocumentEvidence, RenderedOwnerMarker, RenderedSourceMarker } from "../render/chrome.js";
import type { Gate } from "./gate.js";
import { htmlToText } from "./text.js";
import { normalizePhone, tokenizeNumericOccurrences } from "./numeric.js";

export interface StructuredMetric {
  value: number;
  unit: string;
  subject: string;
  timeframe?: string;
}

export interface MetricFact {
  id: string;
  metrics?: StructuredMetric[];
}

export interface MetricClaim extends StructuredMetric {
  id: string;
  text: string;
  factIds: string[];
}

export type NumericExemptionClassification = "identity" | "date" | "reference";

export interface NumericExemption {
  id: string;
  text: string;
  classification: NumericExemptionClassification;
  sourcePaths?: string[];
}

export interface ProhibitedClaimIssue {
  kind: "metric-conflict" | "metric-text-mismatch" | "missing-fact-reference" | "unknown-fact-reference" | "forbidden-claim"
    | "uncovered-numeric-claim" | "ambiguous-numeric-record" | "duplicate-numeric-record"
    | "numeric-value-mismatch" | "invalid-numeric-exemption";
  path: string;
  message: string;
  sourcePath?: string;
  concept?: string;
}

export interface ProhibitedClaimsInput {
  text: string;
  canon: {
    facts: MetricFact[];
    identity?: { name?: string; phone?: string };
    projects?: Array<{ name: string; year?: string }>;
    experience?: Array<{ title: string; org: string; start: string; end: string }>;
    education?: Array<{ qualification: string; institution: string; year: string }>;
    publications?: string[];
    claims?: { cannot?: Array<{ id: string; statement: string; concepts: ProhibitionConcept[] }> };
  };
  metricClaims?: MetricClaim[];
  numericExemptions?: NumericExemption[];
  /**
   * Employer names that count as an internal-IP mention on their own, in addition to
   * the generic aliases ("internal", "proprietary", "employer", ...).
   * Defaults to {@link DEFAULT_EMPLOYER_ALIASES}. This repository is public, so the
   * shipped default is fictional; a deployment passes its own real employer name here.
   */
  employerAliases?: string[];
  /** Browser-computed text and marker visibility. Required for canon-bound dates. */
  renderedDocument?: RenderedDocumentEvidence;
}

export interface ProhibitedClaimsResult {
  ok: boolean;
  issues: ProhibitedClaimIssue[];
}

const normalize = (value: string | undefined): string =>
  (value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, " ");

interface ForbiddenConcept {
  id: ProhibitionConcept;
  requiredAliasGroups: RegExp[][];
}

/**
 * Fictional stand-in for the candidate's employer. Naming a real employer in a public
 * repository would leak exactly the internal-IP association this gate exists to police,
 * so callers supply their own via `ProhibitedClaimsInput.employerAliases`.
 */
export const DEFAULT_EMPLOYER_ALIASES = ["Acme Engineering"];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Word-bounded patterns for the configured employer names, matched against normalized text. */
function employerPatterns(aliases: string[] | undefined): RegExp[] {
  return (aliases ?? DEFAULT_EMPLOYER_ALIASES)
    .map((alias) => normalize(alias))
    .filter(Boolean)
    .map((alias) => new RegExp(`\\b${escapeRegExp(alias)}\\b`));
}

/** Injects the configured employer names into the internal-IP concept's first alias group. */
function withEmployerAliases(concept: ForbiddenConcept, employer: RegExp[]): ForbiddenConcept {
  if (concept.id !== "internal-ip" || employer.length === 0) return concept;
  const [first, ...rest] = concept.requiredAliasGroups;
  return { ...concept, requiredAliasGroups: [[...first, ...employer], ...rest] };
}

const FORBIDDEN_CONCEPTS: ForbiddenConcept[] = [
  {
    id: "internal-ip",
    requiredAliasGroups: [
      [
        /\binternal\b/,
        /\bconfidential\b/,
        /\bproprietary\b/,
        /\bclient\b/,
        /\bemployer\b/,
      ],
      [
        /\bmetrics?\b/,
        /\bfigures?\b/,
        /\bimplementation details?\b/,
        /\bsource code\b/,
        /\bclient names?\b/,
        /\btool(?:s|ing)?\b/,
        /\bimplement(?:ation|ed|ing)?\b/,
        /\b(?:built|owned|designed)\b/,
      ],
    ],
  },
  {
    id: "openai-api",
    requiredAliasGroups: [
      [
        /\bopen ?ai\b/,
        /\bchat ?gpt\b/,
        /\bgpt(?:[ -]?\d+(?:\.\d+)?)?\b/,
      ],
      [
        /\bapi\b/,
        /\bendpoints?\b/,
        /\bsdk\b/,
        /\bintegrat(?:e|ed|es|ing|ion|ions)\b/,
        /\bclient librar(?:y|ies)\b/,
      ],
    ],
  },
  {
    id: "chartership",
    requiredAliasGroups: [[
      /\bchartered engineer\b/,
      /\bchartership\b/,
      /\b(?:ceng|ieng|engtech)\b/,
    ]],
  },
  {
    id: "engineering-sign-off",
    requiredAliasGroups: [
      [
        /\bengineering\b/,
        /\bengineered\b/,
        /\bdesigns?\b/,
      ],
      [
        /\bsign(?:ed|ing)?(?: off)?\b/,
        /\bapprov(?:e|ed|es|ing|al)\b/,
        /\bdelegated authority\b/,
        /\bauthorit(?:y|ies)\b/,
      ],
    ],
  },
  {
    id: "aws-production",
    requiredAliasGroups: [
      [/\baws\b/, /\bamazon web services\b/],
      [
        /\bhands? on\b/,
        /\bproduction\b/,
        /\bdeploy(?:ed|ing|ment)?\b/,
        /\boperat(?:e|ed|es|ing|ion)\b/,
        /\b(?:build|built)\b/,
      ],
    ],
  },
  {
    id: "ansys-hands-on",
    requiredAliasGroups: [
      [/\bansys\b/, /\bansys mechanical\b/],
      [
        /\bhands? on\b/,
        /\banalys(?:is|ed|ing)\b/,
        /\bsimulat(?:e|ed|es|ing|ion|ions)\b/,
        /\bdeliver(?:ed|ing|y)?\b/,
        /\bmodel(?:led|ing)?\b/,
      ],
    ],
  },
  {
    id: "database-production",
    requiredAliasGroups: [
      [
        /\bdatabases?\b/,
        /\bpostgres(?:ql)?\b/,
        /\bmysql\b/,
        /\bsql server\b/,
        /\bmongodb\b/,
        /\bredis\b/,
      ],
      [
        /\bhands? on\b/,
        /\bproduction\b/,
        /\bdesign(?:ed|ing)?\b/,
        /\boperat(?:e|ed|es|ing|ion)\b/,
        /\badminist(?:er|ered|ering|ration)\b/,
        /\b(?:build|built)\b/,
      ],
    ],
  },
  {
    id: "langchain-delivery",
    requiredAliasGroups: [
      [/\blangchain\b/],
      [
        /\bhands? on\b/,
        /\bdeliver(?:ed|ing|y)?\b/,
        /\b(?:build|built)\b/,
        /\bimplement(?:ed|ing|ation)?\b/,
        /\bcustomer\b/,
      ],
    ],
  },
  {
    id: "audio-video-experience",
    requiredAliasGroups: [
      [
        /\baudio\b/,
        /\bvideo\b/,
        /\bspeech to text\b/,
        /\bspeech recognition\b/,
        /\bmultimodal\b/,
      ],
      [
        /\bexperience\b/,
        /\b(?:build|built)\b/,
        /\bimplement(?:ed|ing|ation)?\b/,
        /\bdeliver(?:ed|ing|y)?\b/,
        /\bpipelines?\b/,
        /\btrain(?:ed|ing)?\b/,
        /\bdeploy(?:ed|ing|ment)?\b/,
      ],
    ],
  },
  {
    id: "ai-tenure",
    requiredAliasGroups: [[
      /\b(?:ai|machine learning|ml) engineer(?:ing)?\s+(?:\w+\s+){0,5}(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) years?\b/,
      /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) years?\s+(?:\w+\s+){0,5}(?:ai|machine learning|ml) engineer(?:ing)?\b/,
    ]],
  },
];

function mentionsConcept(text: string, concept: ForbiddenConcept): boolean {
  const normalized = normalize(text);
  return concept.requiredAliasGroups.every((group) =>
    group.some((alias) => alias.test(normalized))
  );
}

function isCandidateAssertion(
  concept: ProhibitionConcept,
  clause: string,
  canon: ProhibitedClaimsInput["canon"],
): boolean {
  const normalized = normalize(clause);
  if (/\b(?:i|i'm|i've|my|mine|me)\b/.test(normalized)) return true;
  const candidateName = normalize(canon.identity?.name);
  if (candidateName && normalized.includes(candidateName)) return true;
  const requirementFrame = /\brequirements?\s*(?::|includes?\b)/.test(normalized)
    || /\b(?:vacancy|position|specification|job description|role description|job advert|the role)\b[\s\S]*\b(?:seeks?|seeking|required|requires?|calls for|must have|lists?|asks?)\b/.test(normalized)
    || /\bcandidates?\s+(?:must|should)\s+have\b/.test(normalized)
    || /^seeking\b/.test(normalized);
  const publicProvenance = /\bpublic\s+(?:vacancy|job advert|documentation|record)\b[\s\S]*\b(?:states?|describes?|lists?|reports?)\b/.test(normalized);
  if (concept === "internal-ip") {
    if (/\bworked with internal stakeholders\b/.test(normalized)) return false;
    return !(publicProvenance || requirementFrame);
  }
  if (requirementFrame || publicProvenance) return false;
  if (/\b(?:evolved|industry|discipline|technology|public documentation|public record)\b/.test(normalized)) return false;
  return true;
}

function visibleClauses(input: string): string[] {
  const withBoundaries = input.replace(/<\/(?:p|li|div|h[1-6]|section|article)>/gi, ". ");
  return htmlToText(withBoundaries).split(/(?<=[.!?;])\s+/).map((clause) => clause.trim()).filter(Boolean);
}

export const MetricClaimsFileSchema = z.object({
  schemaVersion: z.literal(1),
  claims: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    factIds: z.array(z.string().min(1)),
    value: z.number().finite(),
    unit: z.string().min(1),
    subject: z.string().min(1),
    timeframe: z.string().min(1).optional(),
  }).strict()).default([]),
  exemptions: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    classification: z.enum(["identity", "date", "reference"]),
    sourcePaths: z.array(z.string().min(1)).min(1).optional(),
  }).strict()).default([]),
}).strict().superRefine((file, context) => {
  if (file.claims.length + file.exemptions.length === 0) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["claims"],
    message: "at least one metric claim or numeric exemption is required",
  });
  const seen = new Set<string>();
  file.claims.forEach((record, index) => {
    if (seen.has(record.id)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claims", index, "id"],
      message: `Duplicate persisted ID ${JSON.stringify(record.id)}`,
    });
    seen.add(record.id);
  });
  file.exemptions.forEach((record, index) => {
    if (seen.has(record.id)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exemptions", index, "id"],
      message: `Duplicate persisted ID ${JSON.stringify(record.id)}`,
    });
    seen.add(record.id);
    if (record.classification !== "date" && record.sourcePaths !== undefined) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["exemptions", index, "sourcePaths"],
      message: `${record.classification} exemptions must not declare sourcePaths`,
    });
    if (record.classification === "date") {
      const tokens = tokenizeNumericOccurrences(record.text);
      const token = tokens.length === 1 ? tokens[0] : undefined;
      const range = token?.raw.match(/^(?:19|20)\d{2}\s*[–—-]\s*(?:Present|(?:19|20)\d{2})$/i);
      const bareYear = token?.kind === "number" && /^(?:19|20)\d{2}$/.test(token.raw);
      const required = range ? 2 : bareYear ? 1 : 0;
      if ((record.sourcePaths?.length ?? 0) !== required) context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exemptions", index, "sourcePaths"],
        message: required === 0
          ? "standalone full dates must not declare sourcePaths"
          : `canon-bound date requires exactly ${required} source path(s)`,
      });
    }
  });
});

export type MetricClaimsFile = z.infer<typeof MetricClaimsFileSchema>;

function sameMetric(claim: StructuredMetric, fact: StructuredMetric): boolean {
  return claim.value === fact.value
    && normalize(claim.unit) === normalize(fact.unit)
    && normalize(claim.subject) === normalize(fact.subject)
    && normalize(claim.timeframe) === normalize(fact.timeframe);
}

export function hasVisibleNumericOccurrences(input: string): boolean {
  return tokenizeNumericOccurrences(htmlToText(input)).length > 0;
}

interface DateSource { path: string; value: string; kind: "project" | "experience" | "education" | "publication"; index: number }

function resolveDateSource(canon: ProhibitedClaimsInput["canon"], path: string): DateSource | undefined {
  let match = path.match(/^projects\[(\d+)]\.year$/);
  if (match) {
    const index = Number(match[1]);
    const item = canon.projects?.[index];
    return item?.year ? { path, value: item.year, kind: "project", index } : undefined;
  }
  match = path.match(/^experience\[(\d+)]\.(start|end)$/);
  if (match) {
    const index = Number(match[1]);
    const item = canon.experience?.[index];
    const value = item?.[match[2] as "start" | "end"];
    return item && value ? { path, value, kind: "experience", index } : undefined;
  }
  match = path.match(/^education\[(\d+)]\.year$/);
  if (match) {
    const index = Number(match[1]);
    const item = canon.education?.[index];
    return item ? { path, value: item.year, kind: "education", index } : undefined;
  }
  match = path.match(/^publications\[(\d+)]$/);
  if (match) {
    const index = Number(match[1]);
    const item = canon.publications?.[index];
    return item ? { path, value: item, kind: "publication", index } : undefined;
  }
  return undefined;
}

function normalizedRange(value: string): string {
  return value.normalize("NFKC").replace(/[–—]/g, "-").replace(/\s+/g, "").toLowerCase();
}

function isGroundedDateExemption(
  canon: ProhibitedClaimsInput["canon"],
  occurrence: ReturnType<typeof tokenizeNumericOccurrences>[number],
  record: NumericExemption,
  rendered: RenderedDocumentEvidence | undefined,
  occurrenceIndex: number,
): boolean {
  const range = occurrence.raw.match(/^((?:19|20)\d{2})\s*[–—-]\s*(Present|(?:19|20)\d{2})$/i);
  if (!range && occurrence.kind === "date") return record.sourcePaths === undefined;
  if (!rendered) return false;
  const markers = rendered.markers ?? [];
  if (range) {
    if (record.sourcePaths?.length !== 2) return false;
    const sources = record.sourcePaths.map((path) => resolveDateSource(canon, path));
    const bound = record.sourcePaths.map((path) => markers.filter((marker) => marker.path === path));
    return sources.every((source): source is DateSource => source !== undefined)
      && sources[0].kind === "experience" && sources[1].kind === "experience"
      && sources[0].index === sources[1].index
      && sources[0].path.endsWith(".start") && sources[1].path.endsWith(".end")
      && sources[0].value === range[1] && normalize(sources[1].value) === normalize(range[2])
      && bound[0].length === 1 && bound[1].length === 1
      && bound[0][0].visible && bound[1][0].visible
      && bound[0][0].tag === "span" && bound[1][0].tag === "span"
      && bound[0][0].text === sources[0].value && normalize(bound[1][0].text) === normalize(sources[1].value)
      && markerOccurrenceIndex(rendered, bound[0][0]) === occurrenceIndex
      && bound[0][0].entryPath === `experience[${sources[0].index}]`
      && bound[1][0].entryPath === bound[0][0].entryPath
      && bound[0][0].entryVisible === true && bound[1][0].entryVisible === true
      && bound[0][0].entryCount === 1 && bound[1][0].entryCount === 1
      && hasCanonicalOwners(canon, sources[0], bound[0][0], rendered.owners ?? [])
      && bound[0][0].metaGroup !== undefined && bound[0][0].metaGroup === bound[1][0].metaGroup
      && normalizedRange(bound[0][0].metaText ?? "").includes(normalizedRange(occurrence.raw));
  }
  if (occurrence.kind !== "number" || !/^(?:19|20)\d{2}$/.test(occurrence.raw) || record.sourcePaths?.length !== 1) return false;
  const source = resolveDateSource(canon, record.sourcePaths[0]);
  if (!source) return false;
  const bound = markers.filter((marker) => marker.path === record.sourcePaths![0]);
  if (bound.length !== 1 || !bound[0].visible || markerOccurrenceIndex(rendered, bound[0]) !== occurrenceIndex) return false;
  if (source.kind === "publication") return bound[0].tag === "li"
    && bound[0].text === source.value && source.value.includes(occurrence.raw);
  return source.value === occurrence.raw && bound[0].tag === "div"
    && bound[0].classes.includes("meta")
    && bound[0].text === occurrence.raw
    && bound[0].entryPath === `${source.kind === "project" ? "projects" : "education"}[${source.index}]`
    && bound[0].entryVisible === true
    && bound[0].entryCount === 1
    && hasCanonicalOwners(canon, source, bound[0], rendered.owners ?? []);
}

function markerOccurrenceIndex(rendered: RenderedDocumentEvidence, marker: RenderedSourceMarker): number {
  if (marker.offset !== marker.textBefore.length || !rendered.text.startsWith(marker.textBefore)) return -1;
  if (!rendered.text.slice(marker.offset).trimStart().startsWith(marker.text)) return -1;
  return tokenizeNumericOccurrences(marker.textBefore).length;
}

interface ExpectedOwner {
  path: string;
  value: string;
  tag: string;
  requiredClass: string;
  parentClass?: string;
  contextClass?: string;
}

function expectedOwners(canon: ProhibitedClaimsInput["canon"], source: DateSource): ExpectedOwner[] | undefined {
  if (source.kind === "project") {
    const item = canon.projects?.[source.index];
    return item ? [{ path: `projects[${source.index}].name`, value: item.name, tag: "span", requiredClass: "project-name", parentClass: "title", contextClass: "eh" }] : undefined;
  }
  if (source.kind === "experience") {
    const item = canon.experience?.[source.index];
    return item ? [
      { path: `experience[${source.index}].title`, value: item.title, tag: "span", requiredClass: "title", contextClass: "eh" },
      { path: `experience[${source.index}].org`, value: item.org, tag: "span", requiredClass: "org", contextClass: "eh" },
    ] : undefined;
  }
  if (source.kind === "education") {
    const item = canon.education?.[source.index];
    return item ? [
      { path: `education[${source.index}].qualification`, value: item.qualification, tag: "span", requiredClass: "title", contextClass: "two" },
      { path: `education[${source.index}].institution`, value: item.institution, tag: "span", requiredClass: "institution", contextClass: "two" },
    ] : undefined;
  }
  return [];
}

function hasCanonicalOwners(
  canon: ProhibitedClaimsInput["canon"],
  source: DateSource,
  marker: RenderedSourceMarker,
  owners: RenderedOwnerMarker[],
): boolean {
  const expected = expectedOwners(canon, source);
  if (expected === undefined) return false;
  const bound = expected.map(owner => owners.filter(candidate => candidate.path === owner.path));
  if (bound.some(matches => matches.length !== 1)) return false;
  const fields = bound.map(matches => matches[0]);
  return fields.every((field, index) => {
    const owner = expected[index];
    return field.visible
      && field.entryVisible === true
      && field.entryCount === 1
      && field.entryPath === marker.entryPath
      && field.tag === owner.tag
      && field.classes.includes(owner.requiredClass)
      && field.parentTag === "div"
      && (owner.parentClass === undefined || field.parentClasses?.includes(owner.parentClass))
      && (owner.contextClass === undefined || field.contextClasses?.includes(owner.contextClass))
      && field.contextGroup !== undefined && field.contextGroup === marker.contextGroup
      && field.text === owner.value;
  })
    && (fields.length < 2 || (fields[0].parentGroup !== undefined && fields.every(field => field.parentGroup === fields[0].parentGroup)));
}

function addNumericCoverageIssues(input: ProhibitedClaimsInput, issues: ProhibitedClaimIssue[]): void {
  if (input.metricClaims === undefined && input.numericExemptions === undefined) return;
  const text = input.renderedDocument?.text ?? htmlToText(input.text);
  const occurrences = tokenizeNumericOccurrences(text);
  const mappings = new Map<number, number>();
  const records = [
    ...(input.metricClaims ?? []).map((record, index) => ({ kind: "metric" as const, record, path: `metricClaims[${index}]` })),
    ...(input.numericExemptions ?? []).map((record, index) => ({ kind: "exemption" as const, record, path: `numericExemptions[${index}]` })),
  ];
  for (const entry of records) {
    const first = text.indexOf(entry.record.text);
    const unique = first !== -1 && text.indexOf(entry.record.text, first + 1) === -1;
    const contained = unique
      ? occurrences.filter((occurrence) => occurrence.index >= first && occurrence.end <= first + entry.record.text.length)
      : [];
    if (!unique || contained.length !== 1) {
      issues.push({
        kind: "ambiguous-numeric-record",
        path: `${entry.path}.text`,
        message: "record text must occur once and contain exactly one visible numeric occurrence",
      });
      continue;
    }
    const occurrenceIndex = occurrences.indexOf(contained[0]);
    mappings.set(occurrenceIndex, (mappings.get(occurrenceIndex) ?? 0) + 1);
    if (entry.kind === "metric") {
      if (contained[0].kind !== "number" || contained[0].value !== entry.record.value) {
        issues.push({
          kind: "numeric-value-mismatch",
          path: `${entry.path}.value`,
          message: `record declares ${entry.record.value} but its visible numeric occurrence is ${JSON.stringify(contained[0].raw)}`,
        });
      }
    } else {
      const classificationMatches = entry.record.classification === "identity"
        ? contained[0].kind === "phone"
          && input.canon.identity?.phone !== undefined
          && normalizePhone(contained[0].raw) === normalizePhone(input.canon.identity.phone)
        : entry.record.classification === "date"
          ? isGroundedDateExemption(input.canon, contained[0], entry.record, input.renderedDocument, occurrenceIndex)
          : contained[0].kind === "version" || contained[0].kind === "reference";
      if (!classificationMatches) issues.push({
        kind: "invalid-numeric-exemption",
        path: `${entry.path}.classification`,
        message: `${JSON.stringify(contained[0].raw)} is not grounded as ${entry.record.classification}`,
      });
    }
  }
  occurrences.forEach((occurrence, index) => {
    const count = mappings.get(index) ?? 0;
    if (count === 0) issues.push({
      kind: "uncovered-numeric-claim",
      path: "text",
      message: `visible numeric occurrence ${JSON.stringify(occurrence.raw)} has no persisted metric or exemption record`,
    });
    if (count > 1) issues.push({
      kind: "duplicate-numeric-record",
      path: "text",
      message: `visible numeric occurrence ${JSON.stringify(occurrence.raw)} is mapped by ${count} records`,
    });
  });
}

export function analyzeProhibitedClaims(input: ProhibitedClaimsInput): ProhibitedClaimsResult {
  const issues: ProhibitedClaimIssue[] = [];
  addNumericCoverageIssues(input, issues);
  const clauses = visibleClauses(input.text);
  const employer = employerPatterns(input.employerAliases);
  for (const [sourceIndex, prohibition] of (input.canon.claims?.cannot ?? []).entries()) {
    for (const conceptId of prohibition.concepts) {
      const base = FORBIDDEN_CONCEPTS.find((candidate) => candidate.id === conceptId);
      const concept = base && withEmployerAliases(base, employer);
      if (concept && clauses.some((clause) => mentionsConcept(clause, concept) && isCandidateAssertion(conceptId, clause, input.canon))) {
        issues.push({
          kind: "forbidden-claim",
          path: "text",
          sourcePath: `claims.cannot[${sourceIndex}]`,
          concept: conceptId,
          message: `text asserts the forbidden ${conceptId} concept`,
        });
      }
    }
  }
  for (const [index, claim] of (input.metricClaims ?? []).entries()) {
    if (!htmlToText(input.text).includes(claim.text)) {
      issues.push({
        kind: "metric-text-mismatch",
        path: `metricClaims[${index}].text`,
        message: "persisted metric claim text is absent from the visible document",
      });
      continue;
    }
    if (claim.factIds.length === 0) {
      issues.push({
        kind: "missing-fact-reference",
        path: `metricClaims[${index}].factIds`,
        message: "a structured metric must reference at least one supporting fact",
      });
      continue;
    }
    const unknownIndex = claim.factIds.findIndex((id) =>
      !input.canon.facts.some((fact) => fact.id === id)
    );
    if (unknownIndex !== -1) {
      issues.push({
        kind: "unknown-fact-reference",
        path: `metricClaims[${index}].factIds[${unknownIndex}]`,
        message: `unknown fact ID ${JSON.stringify(claim.factIds[unknownIndex])}`,
      });
      continue;
    }
    const referenced = input.canon.facts.filter((fact) => claim.factIds.includes(fact.id));
    const supported = referenced.some((fact) =>
      (fact.metrics ?? []).some((metric) => sameMetric(claim, metric))
    );
    if (!supported) {
      issues.push({
        kind: "metric-conflict",
        path: `metricClaims[${index}]`,
        message: "no referenced fact supports this value, unit, subject, and timeframe together",
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export const prohibitedClaimsGate: Gate = {
  id: "prohibited-claims",
  severity: "blocking",
  run: async input => {
    const issues = input.artifacts.flatMap(artifact => analyzeProhibitedClaims({ text: artifact.html, canon: input.canon }).issues);
    return { id: "prohibited-claims", ok: issues.length === 0, messages: issues.map(issue => issue.message) };
  },
  command: null,
};
