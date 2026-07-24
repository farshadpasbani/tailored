import { createHash } from "node:crypto";
import { z } from "zod";
import { CanonV2Schema, LEGACY_CANON_NAMESPACES, type CanonV2 } from "./schema.js";
import { classifyProhibition } from "./prohibitions.js";

const V1_NAMESPACES = new Set(LEGACY_CANON_NAMESPACES);

export type MigrationResult =
  | { ok: true; data: CanonV2; unmapped: []; report: { mapped: Array<{ sourcePath: string; targetPath: string }> } }
  | { ok: false; unmapped: string[]; errors: string[] };

function formatMigrationIssues(issues: z.ZodIssue[]): { errors: string[]; unmapped: string[] } {
  const unmapped: string[] = [];
  const errors = issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => {
        const path = [...issue.path, key].join(".");
        unmapped.push(path);
        return `${path}: unmapped source data`;
      });
    }
    return [`${issue.path.join(".") || "(root)"}: ${issue.message}`];
  });
  return { errors, unmapped: unmapped.sort() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function leafPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${path}[${index}]`));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      leafPaths(item, path ? `${path}.${key}` : key)
    );
  }
  return [path];
}

function slug(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "fact";
}

function stableFactId(subject: string, statement: string): string {
  const digest = createHash("sha256")
    .update(subject)
    .update("\0")
    .update(statement)
    .digest("hex")
    .slice(0, 12);
  return `fact-${slug(subject)}-${digest}`;
}

function metricsFromStatement(statement: string): NonNullable<CanonV2["facts"][number]["metrics"]> | undefined {
  const metrics: NonNullable<CanonV2["facts"][number]["metrics"]> = [];
  const commits = statement.match(/\b(\d+)\s+(?:agent-authored\s+)?commits?\s+across\s+(\d+)\s+(?:of\s+my\s+)?repositories\b/i);
  if (commits) {
    const timeframe = statement.match(/since\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "not-applicable";
    metrics.push({ value: Number(commits[1]), unit: "commits", subject: "coding-agent fleet", denominator: "not-applicable", scale: "absolute", timeframe });
    metrics.push({ value: Number(commits[2]), unit: "repositories", subject: "coding-agent fleet", denominator: "not-applicable", scale: "absolute", timeframe });
  }
  const gateRuns = statement.match(/\bgate\b[\s\S]{0,80}\bexecuted\s+(\d+)\s+times\b/i);
  if (gateRuns) metrics.push({ value: Number(gateRuns[1]), unit: "gate executions", subject: "interlock gate", denominator: "not-applicable", scale: "absolute", timeframe: "not-applicable" });
  return metrics.length > 0 ? metrics : undefined;
}

function migratedVerifiedFacts(raw: Record<string, unknown>): {
  facts: CanonV2["facts"];
  groups: CanonV2["verifiedFacts"];
} {
  if (!isRecord(raw.verifiedFacts)) return { facts: [], groups: {} };
  const facts: CanonV2["facts"] = [];
  const groups: CanonV2["verifiedFacts"] = {};
  const idCounts = new Map<string, number>();
  for (const [subject, groupValue] of Object.entries(raw.verifiedFacts)) {
    if (!isRecord(groupValue) || !Array.isArray(groupValue.points)) continue;
    const factIds: string[] = [];
    for (const point of groupValue.points) {
      if (typeof point !== "string") continue;
      const baseId = stableFactId(subject, point);
      const count = idCounts.get(baseId) ?? 0;
      idCounts.set(baseId, count + 1);
      const notes = [groupValue.calibration, groupValue.ipNote]
        .filter((note): note is string => typeof note === "string");
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      factIds.push(id);
      facts.push({
        id,
        statement: point,
        kind: "attested",
        subject,
        ...(metricsFromStatement(point) ? { metrics: metricsFromStatement(point) } : {}),
        provenance: {
          type: "candidate-attested",
          source: `verifiedFacts.${subject}`,
          ...(typeof groupValue.method === "string" ? { method: groupValue.method } : {}),
          ...(notes.length > 0 ? { notes } : {}),
        },
        verifiedOn: typeof groupValue.verifiedOn === "string" ? groupValue.verifiedOn : "unknown",
        status: "candidate-attested",
        confidence: 1,
        allowedUses: ["cv", "cover", "interview"],
        sensitivity: typeof groupValue.ipNote === "string" ? "confidential" : "private",
      });
    }
    if (factIds.length > 0) {
      groups[subject] = { factIds };
    }
  }
  return { facts, groups };
}

function migratedClaims(raw: Record<string, unknown>): CanonV2["claims"] | { errors: string[] } {
  if (!isRecord(raw.claims)) return undefined;
  if (raw.claims.can !== undefined && (!Array.isArray(raw.claims.can) || raw.claims.can.some((item) => typeof item !== "string"))) {
    return { errors: ["claims.can: Expected an array of strings"] };
  }
  if (raw.claims.cannot !== undefined && !Array.isArray(raw.claims.cannot)) {
    return { errors: ["claims.cannot: Expected an array of strings"] };
  }
  const can = raw.claims.can as string[] | undefined;
  const cannot: NonNullable<NonNullable<CanonV2["claims"]>["cannot"]> = [];
  if (Array.isArray(raw.claims.cannot)) {
    for (const [index, statement] of raw.claims.cannot.entries()) {
      if (typeof statement !== "string") return { errors: [`claims.cannot.${index}: Expected string`] };
      const concepts = classifyProhibition(statement);
      if (concepts.length === 0) return { errors: [`claims.cannot.${index}: unclassifiable prohibition`] };
      cannot.push({ id: `prohibition-${stableFactId("claim", statement).slice(5)}`, statement, concepts });
    }
  }
  return { ...(can ? { can } : {}), ...(cannot.length > 0 ? { cannot } : {}) };
}

export function migrateCanon(raw: unknown): MigrationResult {
  if (!isRecord(raw)) {
    return { ok: false, unmapped: ["(root)"], errors: ["canon must be a mapping"] };
  }
  if (raw.schemaVersion === 2) {
    const parsed = CanonV2Schema.safeParse(raw);
    if (!parsed.success) {
      const formatted = formatMigrationIssues(parsed.error.issues);
      return { ok: false, ...formatted };
    }
    return {
      ok: true,
      data: parsed.data,
      unmapped: [],
      report: {
        mapped: leafPaths(raw).map((sourcePath) => ({ sourcePath, targetPath: sourcePath })),
      },
    };
  }
  const unmapped = Object.keys(raw).filter((key) => !V1_NAMESPACES.has(key)).sort();
  if (unmapped.length > 0) {
    return { ok: false, unmapped, errors: unmapped.map((path) => `${path}: unmapped source data`) };
  }
  const claims = migratedClaims(raw);
  if (claims && "errors" in claims) return { ok: false, unmapped: [], errors: claims.errors };
  const verified = migratedVerifiedFacts(raw);
  const candidate = {
    schemaVersion: 2 as const,
    ...raw,
    ...(claims ? { claims } : {}),
    verifiedFacts: verified.groups,
    facts: verified.facts,
  };
  const parsed = CanonV2Schema.safeParse(candidate);
  if (!parsed.success) {
    const formatted = formatMigrationIssues(parsed.error.issues);
    return { ok: false, ...formatted };
  }
  return {
    ok: true,
    data: parsed.data,
    unmapped: [],
    report: {
      mapped: leafPaths(raw).map((sourcePath) => ({ sourcePath, targetPath: sourcePath })),
    },
  };
}
