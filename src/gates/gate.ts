import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import type { Canon } from "../canon/schema.js";
import type { EvidenceFile } from "../evidence/schema.js";
import { loadRequirements, type ReceiptResolver, type VerifiedRequirements } from "../requirements/schema.js";
import type { Strategy } from "../strategy/schema.js";
import type { PriorDoc } from "./distinct.js";

export type GateSeverity = "blocking" | "advisory";

/**
 * The one shape a gate verdict takes. The CLI's exit code, verify-pack's receipt
 * entries, and smoke all derive from a Finding; no caller re-derives a verdict from
 * a gate's internals.
 */
export interface Finding { id: string; ok: boolean; messages: string[] }

/** One document under inspection: its pack artifact ID, staged HTML, and extracted PDF text. */
export interface GateArtifact { id: string; html: string; pdfText: string }

/**
 * The quality standards a gate reads. The policy schema declares the same eight numbers
 * independently today; giving them one owner is card 3 (policy/thresholds.ts), deliberately
 * out of scope here.
 */
export interface GateThresholds {
  atsMinimum: number;
  fitMinimumConfidence: number;
  fitMinimumScore: number;
  minimumFontPt: number;
  minimumMarginMm: number;
  minimumLineHeight: number;
  maximumSharedRuns: number;
  maximumSignaturePhrases: number;
}

/** Everything the pack lane can show a gate. A gate reads only the members it needs. */
export interface GateInput {
  artifacts: GateArtifact[];
  canon: Canon;
  evidence: EvidenceFile;
  requirements: VerifiedRequirements;
  strategy: Strategy;
  priors: PriorDoc[];
  thresholds: GateThresholds;
  /**
   * Findings the staging transaction already produced per artifact (claim verification,
   * PDF text layer, page count). Aggregating gates fold these into one Finding; they are
   * evidence a gate cannot recompute because it does not own the staging transaction.
   */
  upstream: Finding[];
}

/**
 * A gate verdict rendered for a terminal. The Finding decides; `summary` is the one-line
 * verdict text and `verdict` replaces the PASS/FAIL word for the gates that print a verdict
 * of their own (fit, legacy-fit).
 */
export interface ConsoleReport extends Finding {
  summary: string;
  verdict?: string;
}

/**
 * A gate command's refusal to run: bad flags, unreadable files, input that fails its schema.
 * `messages` carries any detail lines the command had already produced before it gave up, so
 * a partial batch still reports what it found.
 */
export class GateInputError extends Error {
  constructor(message: string, readonly messages: string[] = []) { super(message); }
}

export interface GateCommandArgument { name: string; description: string }
export interface GateCommandOption {
  flags: string;
  description: string;
  default?: string;
  required?: boolean;
  /** Repeatable option: every occurrence is collected into an array. */
  collect?: boolean;
}

/**
 * A gate's standalone CLI command, declared rather than hand-wired, so registering a gate
 * is all it takes to reach the CLI. `run` receives commander's positional arguments and
 * parsed options and returns the same Finding the gate lane speaks.
 */
export interface GateCommand {
  name: string;
  description: string;
  arguments: GateCommandArgument[];
  options: GateCommandOption[];
  run(args: readonly unknown[], options: Record<string, unknown>): Promise<ConsoleReport>;
}

export interface Gate {
  id: string;
  severity: GateSeverity;
  /** Receipt lane. `null` for CLI-only legacy checks that never enter a pack receipt. */
  run: ((input: GateInput) => Promise<Finding>) | null;
  /** Terminal lane. `null` for gates with no standalone command. */
  command: GateCommand | null;
}

/** Commander's option name for a flag spec, e.g. `--min-font <pt>` becomes `minFont`. */
export function optionName(flags: string): string {
  const long = flags.split(/[ ,]+/).find(part => part.startsWith("--")) ?? flags;
  return long.replace(/^--/, "").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** The option object commander would build from a spec's declared defaults alone. */
export function defaultOptions(command: GateCommand): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const option of command.options) {
    if (option.collect) options[optionName(option.flags)] = [];
    else if (option.default !== undefined) options[optionName(option.flags)] = option.default;
  }
  return options;
}

/** Number a flag whose value must be a ratio in [0,1]. */
export function ratioOption(raw: unknown, flag: string): number {
  const value = Number(raw);
  if (!(value >= 0 && value <= 1)) throw new GateInputError(`${flag} must be a number in [0,1], got ${JSON.stringify(raw)}`);
  return value;
}

/**
 * Fold the per-artifact findings the staging transaction produced under one gate ID into a
 * single Finding. An empty set fails: a gate that saw nothing proved nothing.
 */
export function aggregateUpstream(id: string, upstream: readonly Finding[]): Finding {
  const values = upstream.filter(finding => finding.id === id || finding.id.startsWith(`${id}:`));
  return { id, ok: values.length > 0 && values.every(value => value.ok), messages: values.flatMap(value => value.messages) };
}

/** The flags every requirements-anchored command needs to reach a hash-bound requirement map. */
export const REQUIREMENTS_OPTIONS: readonly GateCommandOption[] = [
  { flags: "--requirements <path>", description: "path to requirements.yaml v2", required: true },
  { flags: "--jd-text <path>", description: "path to the hash-bound archived job description", required: true },
  { flags: "--canon <canon>", description: "path to canon.yaml v2", required: true },
  { flags: "--baseline-receipt <path>", description: "trusted externally stored baseline receipt", required: true },
];

/** The trailing prior-waiver flags those same commands share. */
export const RECEIPT_OPTIONS: readonly GateCommandOption[] = [
  { flags: "--receipt <path>", description: "prior waiver receipt (repeatable)", collect: true },
  { flags: "--as-of <date>", description: "receipt-validation date (YYYY-MM-DD)" },
];

/** Resolve REQUIREMENTS_OPTIONS/RECEIPT_OPTIONS into the externally anchored requirement map. */
export function loadCommandRequirements(options: Record<string, unknown>, canon: Canon): VerifiedRequirements {
  const requirements = loadRequirements(options.requirements as string, {
    archivedJdPath: options.jdText as string,
    canon,
    baselineReceiptResolver: receiptResolver([options.baselineReceipt as string]),
    receiptResolver: receiptResolver((options.receipt as string[] | undefined) ?? []),
    asOfDate: options.asOf as string | undefined,
  });
  if (!requirements.ok) throw new GateInputError(`invalid requirements\n  ${requirements.errors.join("\n  ")}`);
  return requirements.data;
}

/** Index externally stored receipts by their self-declared digest, the form loadRequirements wants. */
export function receiptResolver(paths: readonly string[]): ReceiptResolver {
  const receipts = new Map<string, unknown>();
  for (const path of paths) {
    let raw: { sha256?: unknown };
    try { raw = yaml.load(readFileSync(path, "utf8")) as { sha256?: unknown }; }
    catch (error) { throw new GateInputError(`could not read receipt at ${path}: ${(error as Error).message}`); }
    if (typeof raw?.sha256 !== "string") throw new GateInputError(`receipt at ${path} has no sha256`);
    receipts.set(raw.sha256, raw);
  }
  return (sha256: string) => receipts.get(sha256);
}
