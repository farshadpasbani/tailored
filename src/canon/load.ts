import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { z } from "zod";
import { CanonV2Schema, type CanonV2 } from "./schema.js";
import { migrateCanon } from "./migrate.js";
export type LoadedCanon = CanonV2;
export type ParseResult =
  | { ok: true; data: LoadedCanon; schemaVersion: 1 | 2 }
  | { ok: false; errors: string[] };
export type ParseV2Result = { ok: true; data: CanonV2 } | { ok: false; errors: string[] };

function formatIssues(issues: z.ZodIssue[]): string[] {
  return issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) =>
        `${[...issue.path, key].join(".") || "(root)"}: Unrecognized key`
      );
    }
    return [`${issue.path.join(".") || "(root)"}: ${issue.message}`];
  });
}

export function parseCanonV2(raw: unknown): ParseV2Result {
  const result = CanonV2Schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: formatIssues(result.error.issues) };
}
export function parseCanon(raw: unknown): ParseResult {
  if (typeof raw === "object" && raw !== null && "schemaVersion" in raw) {
    const result = parseCanonV2(raw);
    return result.ok ? { ...result, schemaVersion: 2 } : result;
  }
  // Compatibility reads use the migration itself, rather than the permissive
  // v1 schema, so private guidance namespaces cannot be silently stripped.
  const migrated = migrateCanon(raw);
  if (!migrated.ok) return { ok: false, errors: migrated.errors };
  return { ok: true, data: migrated.data, schemaVersion: 1 };
}
export function loadCanon(path: string): ParseResult {
  let raw: unknown;
  try { raw = yaml.load(readFileSync(path, "utf8")); }
  catch (e) { return { ok: false, errors: [`could not read/parse YAML at ${path}: ${(e as Error).message}`] }; }
  return parseCanon(raw);
}
