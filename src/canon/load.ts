import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { CanonSchema, type Canon } from "./schema.js";
export type ParseResult = { ok: true; data: Canon } | { ok: false; errors: string[] };
export function parseCanon(raw: unknown): ParseResult {
  const r = CanonSchema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
}
export function loadCanon(path: string): ParseResult {
  let raw: unknown;
  try { raw = yaml.load(readFileSync(path, "utf8")); }
  catch (e) { return { ok: false, errors: [`could not read/parse YAML at ${path}: ${(e as Error).message}`] }; }
  return parseCanon(raw);
}
