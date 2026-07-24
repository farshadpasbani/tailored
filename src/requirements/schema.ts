import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { z } from "zod";
import type { Canon } from "../canon/schema.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_WEIGHT = 100;
const MAX_TOTAL_WEIGHT = 1_000;
const MAX_REQUIREMENTS = 1000;
const IsoDateSchema = z.string().regex(DATE, "Expected YYYY-MM-DD").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Expected a real calendar date");

export const RequirementWaiverSchema = z.object({
  id: z.string().min(1),
  date: IsoDateSchema,
  approvedBy: z.string().min(1),
  reason: z.string().min(1),
  archivedJdSha256: z.string().regex(SHA256, "Expected a lowercase SHA-256 digest"),
  receiptSha256: z.string().regex(SHA256, "Expected a lowercase SHA-256 digest"),
}).strict();

const ClassificationSchema = z.object({
  frozen: z.enum(["hard", "preferred"]),
  current: z.enum(["hard", "preferred"]),
  waiver: RequirementWaiverSchema.optional(),
}).strict().superRefine((classification, context) => {
  if (classification.current !== classification.frozen && !classification.waiver) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["waiver"],
    message: "Post-freeze reclassification requires a dated, receipt-bound waiver",
  });
  if (classification.current === classification.frozen && classification.waiver) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["waiver"],
    message: "A reclassification waiver is only valid when current differs from frozen",
  });
});

const EvidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("direct"), factIds: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal("transferable"), factIds: z.array(z.string().min(1)).min(1), note: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("gap"), note: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("waived"), waiver: RequirementWaiverSchema }).strict(),
]);

const SourceSpanSchema = z.object({
  quote: z.string().min(1), location: z.string().min(1),
  span: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict(),
}).strict().superRefine((source, context) => {
  if (source.span.end <= source.span.start) context.addIssue({ code: z.ZodIssueCode.custom, path: ["span", "end"], message: "Span end must exceed start" });
});

const AtsSchema = z.object({
  literals: z.array(z.object({ term: z.string().min(1), source: SourceSpanSchema }).strict()),
  aliases: z.array(z.object({ term: z.string().min(1), forLiteral: z.string().min(1), reason: z.string().min(1) }).strict()).default([]),
}).strict();

export const RequirementSchema = z.object({
  id: z.string().min(1),
  source: SourceSpanSchema,
  classification: ClassificationSchema,
  weight: z.number().finite().positive().max(MAX_WEIGHT),
  eligibilityImpact: z.enum(["none", "uncertain", "blocker"]),
  ats: AtsSchema,
  evidence: EvidenceSchema,
}).strict();

const BaselineReceiptPayloadSchema = z.object({
  schemaVersion: z.literal(1), action: z.literal("freeze-requirements"), issuedAt: z.string().datetime({ offset: true }),
  issuer: z.string().min(1).refine((value) => value.trim().length > 0, "Issuer cannot be blank"),
  archivedJdSha256: z.string().regex(SHA256), baselineSha256: z.string().regex(SHA256),
}).strict();

export const BaselineReceiptSchema = BaselineReceiptPayloadSchema.extend({ sha256: z.string().regex(SHA256) }).strict();
const BaselineSchema = z.object({ canonical: z.string().min(1), sha256: z.string().regex(SHA256), receiptSha256: z.string().regex(SHA256) }).strict();

const ReclassificationChangeSchema = z.object({
  id: z.string().min(1), action: z.literal("reclassify"), requirementId: z.string().min(1),
  changedOn: IsoDateSchema,
  before: z.object({ frozen: z.enum(["hard", "preferred"]), current: z.enum(["hard", "preferred"]) }).strict(),
  after: z.object({ frozen: z.enum(["hard", "preferred"]), current: z.enum(["hard", "preferred"]) }).strict(),
  waiver: z.object({ id: z.string().min(1), approvedBy: z.string().min(1), reason: z.string().min(1) }).strict(),
  receiptSha256: z.string().regex(SHA256),
}).strict().superRefine((change, context) => {
  if (change.before.frozen !== change.after.frozen) context.addIssue({ code: z.ZodIssueCode.custom, path: ["after", "frozen"], message: "Frozen classification cannot change" });
  if (change.before.current === change.after.current) context.addIssue({ code: z.ZodIssueCode.custom, path: ["after", "current"], message: "Reclassification must change current class" });
});

const EvidenceWaiverChangeSchema = z.object({
  id: z.string().min(1), action: z.literal("waive-evidence"), requirementId: z.string().min(1),
  changedOn: IsoDateSchema,
  before: z.object({ kind: z.literal("gap"), note: z.string().min(1) }).strict(),
  after: z.object({
    kind: z.literal("waived"),
    waiver: z.object({ id: z.string().min(1), approvedBy: z.string().min(1), reason: z.string().min(1) }).strict(),
  }).strict(),
  receiptSha256: z.string().regex(SHA256),
}).strict();

const RequirementChangeSchema = z.union([ReclassificationChangeSchema, EvidenceWaiverChangeSchema]);

export const ChangeReceiptPayloadSchema = z.object({
  schemaVersion: z.literal(1), action: z.enum(["reclassify", "waive-evidence"]), issuedOn: IsoDateSchema,
  baselineReceiptSha256: z.string().regex(SHA256), archivedJdSha256: z.string().regex(SHA256),
  requirementId: z.string().min(1), beforeSha256: z.string().regex(SHA256), afterSha256: z.string().regex(SHA256),
  waiverSha256: z.string().regex(SHA256),
}).strict();
export const ChangeReceiptSchema = ChangeReceiptPayloadSchema.extend({ sha256: z.string().regex(SHA256) }).strict();

export const RequirementsSchema = z.object({
  schemaVersion: z.literal(2),
  role: z.string().min(1),
  company: z.string().min(1).optional(),
  archivedJd: z.object({ sha256: z.string().regex(SHA256, "Expected a lowercase SHA-256 digest") }).strict(),
  frozenAt: z.string().datetime({ offset: true }),
  requirements: z.array(RequirementSchema).min(1).max(MAX_REQUIREMENTS),
  baseline: BaselineSchema,
  changes: z.array(RequirementChangeSchema).default([]),
}).strict().superRefine((requirements, context) => {
  const ids = new Map<string, string>();
  const waiverIds = new Map<string, string>();
  requirements.requirements.forEach((requirement, index) => {
    if (requirement.classification.current !== requirement.classification.frozen || requirement.classification.waiver) context.addIssue({
      code: z.ZodIssueCode.custom, path: ["requirements", index, "classification"],
      message: "Frozen baseline classification must be unchanged; record post-freeze changes in changes[]",
    });
    if (requirement.evidence.kind === "waived") context.addIssue({ code: z.ZodIssueCode.custom, path: ["requirements", index, "evidence"], message: "A frozen baseline cannot begin with waived evidence" });
    if (requirement.eligibilityImpact !== "none" && requirement.evidence.kind !== "gap") context.addIssue({
      code: z.ZodIssueCode.custom, path: ["requirements", index, "evidence"], message: `${requirement.eligibilityImpact} eligibility requires explicit gap evidence`,
    });
    const folded = requirement.id.toLocaleLowerCase("en-US");
    const prior = ids.get(folded);
    if (prior) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requirements", index, "id"],
      message: prior === requirement.id
        ? `Duplicate requirement ID ${JSON.stringify(requirement.id)}`
        : `Requirement ID ${JSON.stringify(requirement.id)} case-collides with ${JSON.stringify(prior)}`,
    });
    ids.set(folded, requirement.id);
    const literalTerms = new Set(requirement.ats.literals.map((literal) => literal.term.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim()));
    requirement.ats.aliases.forEach((alias, aliasIndex) => {
      if (!literalTerms.has(alias.forLiteral.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim())) context.addIssue({ code: z.ZodIssueCode.custom, path: ["requirements", index, "ats", "aliases", aliasIndex, "forLiteral"], message: "Alias must name a literal term in the same requirement" });
    });
    for (const waiver of [requirement.classification.waiver, requirement.evidence.kind === "waived" ? requirement.evidence.waiver : undefined]) {
      if (!waiver) continue;
      const waiverFolded = waiver.id.toLocaleLowerCase("en-US");
      const priorWaiver = waiverIds.get(waiverFolded);
      if (priorWaiver) context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requirements", index, "waiver", "id"],
        message: `Waiver ID ${JSON.stringify(waiver.id)} duplicates or case-collides with ${JSON.stringify(priorWaiver)}`,
      });
      waiverIds.set(waiverFolded, waiver.id);
    }
  });
});

export type RequirementWaiver = z.infer<typeof RequirementWaiverSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Requirements = z.infer<typeof RequirementsSchema>;
declare const verifiedRequirementsBrand: unique symbol;
export type VerifiedRequirements = Requirements & { readonly [verifiedRequirementsBrand]: true };
export type BaselineReceipt = z.infer<typeof BaselineReceiptSchema>;
export type ChangeReceipt = z.infer<typeof ChangeReceiptSchema>;
export type ReceiptResolver = (sha256: string) => unknown;
export type BaselineReceiptResolver = (sha256: string) => unknown;
export type RequirementsParseResult = { ok: true; data: VerifiedRequirements } | { ok: false; errors: string[] };

const verifiedRequirements = new WeakSet<object>();

export function isVerifiedRequirements(value: unknown): value is VerifiedRequirements {
  return typeof value === "object" && value !== null && verifiedRequirements.has(value);
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Cannot canonicalize a non-finite number");
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError(`Cannot canonicalize ${typeof value}`);
  return encoded;
}

export function digestCanonical(value: unknown): string { return sha256Text(canonicalize(value)); }

export function prepareRequirementsBaseline(requirements: Requirement[]) {
  const canonical = canonicalize(requirements);
  const baselineSha256 = sha256Text(canonical);
  return { canonical, sha256: baselineSha256 };
}

export function issueBaselineReceipt(baselineSha256: string, input: { frozenAt: string; archivedJdSha256: string; issuer: string }): BaselineReceipt {
  const payload = BaselineReceiptPayloadSchema.parse({
    schemaVersion: 1,
    action: "freeze-requirements",
    issuedAt: input.frozenAt,
    issuer: input.issuer,
    archivedJdSha256: input.archivedJdSha256,
    baselineSha256,
  });
  return BaselineReceiptSchema.parse({ ...payload, sha256: digestCanonical(payload) });
}

export function createChangeReceipt(input: { action: "reclassify" | "waive-evidence"; issuedOn: string; baselineReceiptSha256: string; archivedJdSha256: string; requirementId: string; before: unknown; after: unknown; waiver: unknown }): ChangeReceipt {
  const payload = { schemaVersion: 1 as const, action: input.action, issuedOn: input.issuedOn, baselineReceiptSha256: input.baselineReceiptSha256, archivedJdSha256: input.archivedJdSha256, requirementId: input.requirementId, beforeSha256: digestCanonical(input.before), afterSha256: digestCanonical(input.after), waiverSha256: digestCanonical(input.waiver) };
  return { ...payload, sha256: digestCanonical(payload) };
}

export function parseRequirements(
  raw: unknown,
  context: { archivedJdText: string; canon: Canon; baselineReceiptResolver: BaselineReceiptResolver; receiptResolver?: ReceiptResolver; asOfDate?: string; maxReceiptAgeDays?: number },
): RequirementsParseResult {
  const parsed = RequirementsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };
  const errors: string[] = [];
  const asOfDate = context.asOfDate === undefined || IsoDateSchema.safeParse(context.asOfDate).success
    ? context.asOfDate
    : undefined;
  if (context.asOfDate !== undefined && asOfDate === undefined) errors.push("asOfDate: expected a real YYYY-MM-DD date");
  const maxReceiptAgeDays = context.maxReceiptAgeDays === undefined
    || (Number.isFinite(context.maxReceiptAgeDays) && context.maxReceiptAgeDays >= 0)
    ? context.maxReceiptAgeDays
    : undefined;
  if (context.maxReceiptAgeDays !== undefined && maxReceiptAgeDays === undefined) errors.push("maxReceiptAgeDays: expected a finite non-negative number");
  const baselineDigest = digestCanonical(parsed.data.requirements);
  if (canonicalize(parsed.data.requirements) !== parsed.data.baseline.canonical) errors.push("baseline.canonical: persisted frozen map does not match requirements");
  if (baselineDigest !== parsed.data.baseline.sha256) errors.push("baseline.sha256: frozen requirement map digest does not match");
  const trustedBaseline = BaselineReceiptSchema.safeParse(context.baselineReceiptResolver?.(parsed.data.baseline.receiptSha256));
  if (!trustedBaseline.success) {
    errors.push("baseline.receiptSha256: referenced trusted external baseline receipt is missing or malformed");
  } else {
    const { sha256, ...payload } = trustedBaseline.data;
    if (sha256 !== parsed.data.baseline.receiptSha256 || digestCanonical(payload) !== sha256) errors.push("baseline.receiptSha256: external baseline receipt hash mismatch");
    if (trustedBaseline.data.baselineSha256 !== baselineDigest) errors.push("baseline.receiptSha256: external receipt does not bind the frozen map");
    if (trustedBaseline.data.archivedJdSha256 !== parsed.data.archivedJd.sha256) errors.push("baseline.receiptSha256: external receipt does not bind the archived JD");
    if (trustedBaseline.data.issuedAt !== parsed.data.frozenAt) errors.push("baseline.receiptSha256: external receipt was not issued at freeze time");
  }
  if (typeof context.archivedJdText !== "string") {
    errors.push("archivedJd: archived JD text is required to verify the frozen hash and source quotes");
  } else {
    const actual = sha256Text(context.archivedJdText);
    if (actual !== parsed.data.archivedJd.sha256) errors.push(
      `archivedJd.sha256: ${parsed.data.archivedJd.sha256} does not match archived JD digest ${actual}`,
    );
    parsed.data.requirements.forEach((requirement, index) => {
      if (!context.archivedJdText!.includes(requirement.source.quote)) errors.push(
        `requirements.${index}.source.quote: exact quote is not present in the archived JD`,
      );
      if (context.archivedJdText!.slice(requirement.source.span.start, requirement.source.span.end) !== requirement.source.quote) errors.push(
        `requirements.${index}.source.span: span does not select the exact quote`,
      );
      requirement.ats.literals.forEach((literal, literalIndex) => {
        const selected = context.archivedJdText!.slice(literal.source.span.start, literal.source.span.end);
        if (selected !== literal.source.quote) errors.push(`requirements.${index}.ats.literals.${literalIndex}.source.span: span does not select the exact archive text`);
        const normalizedTerm = literal.term.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
        const normalizedQuote = literal.source.quote.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
        if (normalizedTerm !== normalizedQuote) errors.push(`requirements.${index}.ats.literals.${literalIndex}.term: literal term does not match its archive source`);
        if (literal.source.span.start < requirement.source.span.start || literal.source.span.end > requirement.source.span.end) errors.push(`requirements.${index}.ats.literals.${literalIndex}.source.span: literal lies outside its requirement source span`);
      });
    });
  }

  if (!context.canon || !Array.isArray(context.canon.facts)) errors.push("canon: verified canon facts are required");
  const exactFacts = new Set(context.canon?.facts.map((fact) => fact.id) ?? []);
  const foldedFacts = new Map((context.canon?.facts ?? []).map((fact) => [fact.id.toLocaleLowerCase("en-US"), fact.id]));
  parsed.data.requirements.forEach((requirement, index) => {
    const factIds = requirement.evidence.kind === "direct" || requirement.evidence.kind === "transferable"
      ? requirement.evidence.factIds : [];
    factIds.forEach((factId, factIndex) => {
      if (exactFacts.has(factId)) return;
      const actual = foldedFacts.get(factId.toLocaleLowerCase("en-US"));
      errors.push(`requirements.${index}.evidence.factIds.${factIndex}: ${actual
        ? `Canon fact ID case does not match; expected ${JSON.stringify(actual)}`
        : `Unknown canon fact ID ${JSON.stringify(factId)}`}`);
    });
    for (const waiver of [requirement.classification.waiver, requirement.evidence.kind === "waived" ? requirement.evidence.waiver : undefined]) {
      if (waiver && waiver.archivedJdSha256 !== parsed.data.archivedJd.sha256) errors.push(
        `requirements.${index}.waiver.archivedJdSha256: waiver is not bound to the archived JD hash`,
      );
    }
  });
  const resolved = structuredClone(parsed.data);
  const changeIds = new Set<string>();
  const waiverIds = new Set<string>();
  const receiptHashes = new Set<string>();
  const lastChangedOn = new Map<string, string>();
  for (const [index, change] of parsed.data.changes.entries()) {
    if (changeIds.has(change.id)) { errors.push(`changes.${index}.id: duplicate change ID`); continue; }
    changeIds.add(change.id);
    const waiverId = change.action === "reclassify" ? change.waiver.id : change.after.waiver.id;
    const foldedWaiverId = waiverId.toLocaleLowerCase("en-US");
    if (waiverIds.has(foldedWaiverId)) { errors.push(`changes.${index}: duplicate or case-colliding waiver ID`); continue; }
    waiverIds.add(foldedWaiverId);
    if (receiptHashes.has(change.receiptSha256)) { errors.push(`changes.${index}.receiptSha256: receipt replay is not allowed`); continue; }
    receiptHashes.add(change.receiptSha256);
    const requirement = resolved.requirements.find((item) => item.id === change.requirementId);
    if (!requirement) { errors.push(`changes.${index}.requirementId: unknown requirement`); continue; }
    const currentState = change.action === "reclassify"
      ? { frozen: requirement.classification.frozen, current: requirement.classification.current }
      : requirement.evidence;
    if (canonicalize(currentState) !== canonicalize(change.before)) { errors.push(`changes.${index}.before: does not match exact current state`); continue; }
    const receiptRaw = context.receiptResolver?.(change.receiptSha256);
    const receiptParsed = ChangeReceiptSchema.safeParse(receiptRaw);
    if (!receiptParsed.success) { errors.push(`changes.${index}.receiptSha256: referenced prior receipt is missing or malformed`); continue; }
    const receipt = receiptParsed.data;
    const { sha256, ...payload } = receipt;
    if (sha256 !== change.receiptSha256 || digestCanonical(payload) !== sha256) { errors.push(`changes.${index}.receiptSha256: receipt hash mismatch`); continue; }
    const waiverApproval = change.action === "reclassify" ? change.waiver : change.after.waiver;
    if (receipt.action !== change.action || receipt.requirementId !== change.requirementId || receipt.archivedJdSha256 !== parsed.data.archivedJd.sha256 || receipt.baselineReceiptSha256 !== parsed.data.baseline.receiptSha256 || receipt.beforeSha256 !== digestCanonical(change.before) || receipt.afterSha256 !== digestCanonical(change.after) || receipt.waiverSha256 !== digestCanonical(waiverApproval)) { errors.push(`changes.${index}.receiptSha256: receipt binding does not match JD, requirement, action, waiver, or exact state transition`); continue; }
    if (receipt.issuedOn !== change.changedOn) { errors.push(`changes.${index}.changedOn: change date does not match receipt`); continue; }
    const freezeDate = parsed.data.frozenAt.slice(0, 10);
    const asOf = asOfDate;
    const ageDays = asOf === undefined ? undefined : (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${receipt.issuedOn}T00:00:00Z`)) / 86_400_000;
    const priorChangedOn = lastChangedOn.get(change.requirementId);
    const maxAge = maxReceiptAgeDays;
    if (receipt.issuedOn < freezeDate) { errors.push(`changes.${index}.changedOn: receipt predates freeze`); continue; }
    if (asOf !== undefined && receipt.issuedOn > asOf) { errors.push(`changes.${index}.changedOn: receipt is future-dated`); continue; }
    if (ageDays !== undefined && maxAge !== undefined && ageDays > maxAge) { errors.push(`changes.${index}.changedOn: receipt is stale`); continue; }
    if (priorChangedOn && receipt.issuedOn < priorChangedOn) { errors.push(`changes.${index}.changedOn: changes are not chronological`); continue; }
    lastChangedOn.set(change.requirementId, receipt.issuedOn);
    const waiver = {
      ...waiverApproval,
      date: change.changedOn,
      archivedJdSha256: parsed.data.archivedJd.sha256,
      receiptSha256: change.receiptSha256,
    };
    if (change.action === "reclassify") requirement.classification = { ...change.after, waiver };
    else requirement.evidence = { kind: "waived", waiver };
  }
  resolved.requirements.forEach((requirement, index) => {
    if (requirement.eligibilityImpact !== "none" && requirement.evidence.kind !== "gap") errors.push(`requirements.${index}.evidence: ${requirement.eligibilityImpact} eligibility cannot be satisfied or waived by non-gap evidence`);
  });
  const totalWeight = resolved.requirements.reduce((sum, requirement) => sum + requirement.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight > MAX_TOTAL_WEIGHT) errors.push(`requirements: aggregate weight must be finite and at most ${MAX_TOTAL_WEIGHT}`);
  if (errors.length > 0) return { ok: false, errors };
  deepFreeze(resolved);
  verifiedRequirements.add(resolved);
  return { ok: true, data: resolved as VerifiedRequirements };
}

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

export function loadRequirements(
  path: string,
  context: { archivedJdPath: string; canon: Canon; baselineReceiptResolver: BaselineReceiptResolver; receiptResolver?: ReceiptResolver; asOfDate?: string; maxReceiptAgeDays?: number },
): RequirementsParseResult {
  let raw: unknown;
  let archivedJdText: string;
  try { raw = yaml.load(readFileSync(path, "utf8")); }
  catch (error) { return { ok: false, errors: [`could not read/parse requirements YAML at ${path}: ${(error as Error).message}`] }; }
  try { archivedJdText = readFileSync(context.archivedJdPath, "utf8"); }
  catch (error) { return { ok: false, errors: [`could not read archived JD at ${context.archivedJdPath}: ${(error as Error).message}`] }; }
  return parseRequirements(raw, { archivedJdText, canon: context.canon, baselineReceiptResolver: context.baselineReceiptResolver, receiptResolver: context.receiptResolver, asOfDate: context.asOfDate, maxReceiptAgeDays: context.maxReceiptAgeDays });
}
