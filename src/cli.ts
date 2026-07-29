#!/usr/bin/env node
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import yaml from "js-yaml";
import { loadCanon } from "./canon/load.js";
import { migrateCanon } from "./canon/migrate.js";
import { analyzeAts } from "./gates/ats.js";
import { atomicWriteFileSync } from "./fs/atomicWrite.js";
import { defaultOptions, GateInputError, type ConsoleReport, type Gate, type GateCommand } from "./gates/gate.js";
import { pageCount } from "./gates/pageFit.js";
import { GATES, gate, gateCommands, SMOKE_SET } from "./gates/registry.js";
import { extractPdfText } from "./gates/run.js";
import { loadJd } from "./jd/load.js";
import { issueBaselineReceipt, prepareRequirementsBaseline, RequirementsSchema, sha256Text, type BaselineReceipt } from "./requirements/schema.js";
import { migrateLegacyJdToRequirements } from "./requirements/migrate.js";
import { renderToPdf } from "./render/chrome.js";
import { jdMarkdownToHtml } from "./jd/pdf.js";
import { version } from "./index.js";
import { verifyPack, verifyReceiptFreshness } from "./verify/pack.js";
import { VerifyReceiptSchema } from "./verify/receipt.js";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

/**
 * The one findings formatter. Detail lines to stderr, one verdict line, exit from the
 * Finding's own `ok` - so what a command prints, what it counts, and what it exits with
 * cannot disagree.
 */
function report(result: ConsoleReport): void {
  for (const message of result.messages) console.error(message);
  if (result.verdict !== undefined) console.log(`${result.verdict}: ${result.summary}`);
  else if (result.ok) console.log(`PASS: ${result.summary}`);
  else console.error(`FAIL: ${result.summary}`);
  if (!result.ok) process.exit(1);
}

/** Wire one registry-declared gate command onto commander. */
function addGateCommand(program: Command, spec: GateCommand): void {
  const command = program.command(spec.name).description(spec.description);
  for (const argument of spec.arguments) command.argument(argument.name, argument.description);
  for (const option of spec.options) {
    if (option.collect) command.option(option.flags, option.description, (value: string, prior: string[]) => [...prior, value], [] as string[]);
    else if (option.required) command.requiredOption(option.flags, option.description);
    else command.option(option.flags, option.description, option.default);
  }
  command.action(async (...actionArguments: unknown[]) => {
    const options = actionArguments[spec.arguments.length] as Record<string, unknown>;
    try { report(await spec.run(actionArguments.slice(0, spec.arguments.length), options)); }
    catch (error) {
      if (!(error instanceof GateInputError)) throw error;
      for (const message of error.messages) console.error(message);
      fail(error.message);
    }
  });
}

function addVerifyPack(program: Command): void {
  program
    .command("verify-pack")
    .description("transactionally render and verify a complete CV/cover pack, then emit one hash-bound receipt")
    .argument("<descriptor>", "pack descriptor YAML")
    .argument("<output>", "new candidate directory; must not already exist")
    .action(async (descriptor: string, output: string) => {
      try {
        const receipt = await verifyPack(descriptor, output);
        console.log(`PASS: complete pack staged ready-for-human at ${output}; receipt ${receipt.receiptSha256}`);
      } catch (error) { fail((error as Error).message); }
    });
}

function addVerifyPackFresh(program: Command): void {
  program
    .command("verify-pack-fresh")
    .description("check whether a verify-pack receipt still binds every declared input and exact output")
    .argument("<descriptor>", "pack descriptor YAML")
    .argument("<candidate>", "candidate directory containing receipt.json and exact outputs")
    .action((descriptor: string, candidate: string) => {
      let raw: unknown;
      try { raw = JSON.parse(readFileSync(join(candidate, "receipt.json"), "utf8")); }
      catch (error) { fail(`could not read receipt: ${(error as Error).message}`); }
      const parsed = VerifyReceiptSchema.safeParse(raw);
      if (!parsed.success) fail(`invalid verify-pack receipt: ${parsed.error.message}`);
      let result;
      try { result = verifyReceiptFreshness(parsed.data, descriptor, candidate); }
      catch (error) { fail((error as Error).message); }
      if (!result.fresh) fail(`stale verify-pack receipt: ${result.stale.join(", ")}`);
      console.log(`FRESH: receipt inputs/outputs and engine identity match ${candidate}; this integrity check does not establish verifier provenance`);
    });
}

function addValidate(program: Command): void {
  program
    .command("validate")
    .description("validate a canon.yaml against the schema")
    .argument("<canon>", "path to canon.yaml")
    .action((canon: string) => {
      const r = loadCanon(canon);
      if (!r.ok) fail(`invalid canon\n  ${r.errors.join("\n  ")}`);
      if (r.schemaVersion === 1) console.error("WARN: legacy schemaVersion 1 canon; run tailored migrate-canon");
      console.log(`PASS: ${canon} is a valid canon for ${r.data.identity.name}`);
    });
}

function addMigrateCanon(program: Command): void {
  program
    .command("migrate-canon")
    .description("migrate a legacy canon to strict schemaVersion 2 YAML")
    .argument("<input>", "path to a legacy or v2 canon.yaml")
    .argument("[output]", "output path; omit to write YAML to stdout")
    .action((input: string, output?: string) => {
      let raw: unknown;
      try { raw = yaml.load(readFileSync(input, "utf8")); }
      catch (e) { fail(`could not read/parse YAML at ${input}: ${(e as Error).message}`); }
      const result = migrateCanon(raw);
      if (!result.ok) fail(`canon migration failed\n  ${result.errors.join("\n  ")}`);
      const rendered = yaml.dump(result.data, { noRefs: true, lineWidth: 100, sortKeys: false });
      if (!output) {
        process.stdout.write(rendered);
        return;
      }
      try { atomicWriteFileSync(output, rendered); }
      catch (error) { fail(`could not write migrated canon at ${output}: ${(error as Error).message}`); }
      console.log(`PASS: migrated ${input} to strict schemaVersion 2 at ${output} (${result.report.mapped.length} source values mapped)`);
    });
}

function addMigrateRequirements(program: Command): void {
  program
    .command("migrate-requirements")
    .description("migrate legacy jd.yaml keywords to explicit-gap requirements v2")
    .argument("<jd>", "path to legacy jd.yaml")
    .requiredOption("--jd-text <path>", "path to the archived job description")
    .requiredOption("--frozen-at <iso>", "ISO timestamp for the deterministic freeze")
    .requiredOption("--baseline-issuer <name>", "human or trusted system that will issue the external baseline receipt")
    .argument("[output]", "output path; omit to write YAML to stdout")
    .action((jdPath: string, output: string | undefined, opts: { jdText: string; frozenAt: string; baselineIssuer: string }) => {
      const jd = loadJd(jdPath);
      if (!jd.ok) fail(`invalid legacy jd\n  ${jd.errors.join("\n  ")}`);
      let archivedJdText: string;
      try { archivedJdText = readFileSync(opts.jdText, "utf8"); }
      catch (error) { fail(`cannot read archived JD at ${opts.jdText}: ${(error as Error).message}`); }
      let migrated;
      try { migrated = migrateLegacyJdToRequirements(jd.data, { archivedJdText, frozenAt: opts.frozenAt, baselineIssuer: opts.baselineIssuer }); }
      catch (error) { fail((error as Error).message); }
      const rendered = yaml.dump(migrated, { noRefs: true, lineWidth: 100, sortKeys: false });
      if (!output) { process.stdout.write(rendered); return; }
      try { atomicWriteFileSync(output, rendered); }
      catch (error) { fail(`could not write migrated requirements at ${output}: ${(error as Error).message}`); }
      console.log(`PASS: migrated legacy keywords to explicit-gap requirements v2 at ${output}`);
    });
}

function addIssueBaselineReceipt(program: Command): void {
  program
    .command("issue-baseline-receipt")
    .description("explicitly issue an external trust anchor for a frozen requirements baseline")
    .argument("<requirements>", "requirements.yaml containing the baseline records")
    .requiredOption("--jd-text <path>", "archived job description")
    .requiredOption("--issuer <name>", "human or trusted system issuing the anchor")
    .argument("<receipt>", "external receipt output path")
    .action((requirementsPath: string, receiptPath: string, opts: { jdText: string; issuer: string }) => {
      let raw: unknown, jdText: string;
      try { raw = yaml.load(readFileSync(requirementsPath, "utf8")); jdText = readFileSync(opts.jdText, "utf8"); }
      catch (error) { fail(`could not read issuance input: ${(error as Error).message}`); }
      const parsed = RequirementsSchema.safeParse(raw);
      if (!parsed.success) fail(`invalid requirements for issuance\n  ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n  ")}`);
      if (sha256Text(jdText) !== parsed.data.archivedJd.sha256) fail("archived JD hash does not match requirements");
      const prepared = prepareRequirementsBaseline(parsed.data.requirements);
      let issued: BaselineReceipt;
      try { issued = issueBaselineReceipt(prepared.sha256, { frozenAt: parsed.data.frozenAt, archivedJdSha256: parsed.data.archivedJd.sha256, issuer: opts.issuer }); }
      catch (error) { fail(`invalid baseline receipt input: ${(error as Error).message}`); }
      if (parsed.data.baseline.canonical !== prepared.canonical || parsed.data.baseline.sha256 !== prepared.sha256) fail("requirements baseline does not match the frozen requirement map");
      if (parsed.data.baseline.receiptSha256 !== issued.sha256) fail("requirements baseline receipt reference does not match this issuer");
      const rendered = yaml.dump(issued, { noRefs: true, lineWidth: 120 });
      // Exclusive: re-issuing over an existing anchor is a mistake to report, not a write to redo.
      try { atomicWriteFileSync(receiptPath, rendered, { exclusive: true }); }
      catch (error) { fail(`could not write baseline receipt: ${(error as Error).message}`); }
      console.log(`PASS: issued external baseline receipt ${issued.sha256} at ${receiptPath}`);
    });
}

function addRender(program: Command): void {
  program
    .command("render")
    .description("render an HTML file to PDF via headless Chrome")
    .argument("<html>", "path to the HTML file")
    .argument("<pdf>", "output PDF path")
    .action(async (html: string, pdf: string) => {
      try { await renderToPdf(html, pdf); }
      catch (e) { fail((e as Error).message); }
      console.log(`PASS: rendered ${html} to ${pdf}`);
    });
}

function addJdPdf(program: Command): void {
  program
    .command("jd-pdf")
    .description("render a captured job description (markdown/text) to an archival PDF beside the CV")
    .argument("<input>", "path to the captured job description (markdown or plain text)")
    .argument("<pdf>", "output PDF path")
    .option("--title <title>", "role title for the header")
    .option("--company <company>", "company name for the header")
    .option("--location <location>", "location for the header")
    .option("--source <url>", "source URL of the posting")
    .option("--date <date>", "capture date (YYYY-MM-DD); defaults to today")
    .action(async (input: string, pdf: string, opts: { title?: string; company?: string; location?: string; source?: string; date?: string }) => {
      let markdown: string;
      try { markdown = readFileSync(input, "utf8"); }
      catch (e) { fail(`cannot read ${input}: ${(e as Error).message}`); }
      const date = opts.date ?? new Date().toISOString().slice(0, 10);
      const html = jdMarkdownToHtml(markdown, { title: opts.title, company: opts.company, location: opts.location, source: opts.source, date });
      const htmlPath = join(tmpdir(), `tailored-jd-${process.pid}.html`);
      try {
        writeFileSync(htmlPath, html, "utf8");
        // The JD body is untrusted employer text. We escape it, but disable scripts in
        // the renderer too as defence in depth: a job description never needs JS.
        // NB: --blink-settings=scriptEnabled=false makes headless Chrome exit 0 while
        // writing no PDF; --disable-javascript disables JS without breaking print-to-pdf.
        await renderToPdf(htmlPath, pdf, { extraArgs: ["--disable-javascript"] });
      } catch (e) { fail((e as Error).message); }
      console.log(`PASS: rendered job description to ${pdf}`);
    });
}

/**
 * How each gate in SMOKE_SET sees the bundled example. Everything else - the thresholds, the
 * wording, the verdict - comes from the gate itself. Exported so a test can pin that the set
 * and this table stay in step.
 */
export function smokeCalls(html: string, pdf: string, example: (name: string) => string): Record<string, { args: unknown[]; options: Record<string, unknown> }> {
  return {
    "ai-tell": { args: [[html]], options: {} },
    trace: { args: [html], options: { canon: example("canon.yaml") } },
    impact: { args: [html], options: {} },
    "page-fit": { args: [pdf], options: { max: "1" } },
    "fit-blockers": {
      args: [],
      options: {
        requirements: example("requirements.yaml"), jdText: example("job-description.md"),
        canon: example("canon.yaml"), baselineReceipt: example("baseline-receipt.yaml"),
        allowCandidateAttested: true,
      },
    },
    "legacy-ats": { args: [pdf], options: { jd: example("jd.yaml") } },
  };
}

function addSmoke(program: Command): void {
  program
    .command("smoke")
    .description("render the alex-rivers example and run the page-fit and ai-tell gates")
    .action(async () => {
      // Resolve the bundled example relative to this file (dist/cli.js -> ../examples/...)
      // so `tailored smoke` works from any working directory, including a global install.
      const example = (name: string) => fileURLToPath(new URL(`../examples/alex-rivers/${name}`, import.meta.url));
      const html = example("cv.html");
      const pdf = join(tmpdir(), `tailored-smoke-${process.pid}.pdf`);
      try { await renderToPdf(html, pdf); }
      catch (e) { fail((e as Error).message); }
      const calls = smokeCalls(html, pdf, example);
      let fitVerdict = "";
      for (const id of SMOKE_SET) {
        const command = gate(id).command;
        if (!command) fail(`smoke gate ${id} has no command`);
        const call = calls[id];
        if (!call) fail(`smoke has no invocation for gate ${id}`);
        let result: ConsoleReport;
        try { result = await command.run(call.args, { ...defaultOptions(command), ...call.options }); }
        catch (error) { fail(`example fails ${id}: ${(error as Error).message}`); }
        if (!result.ok) fail(`example fails ${id}: ${[...result.messages, result.summary].join("; ")}`);
        if (id === "fit-blockers") fitVerdict = result.verdict ?? "";
      }
      // The reports carry the verdict, not the figures the summary line quotes; re-derive the
      // two the line names. Card 5 (docs generated from the registry) is where a report shape
      // rich enough to carry them belongs.
      const pages = await pageCount(pdf);
      const jd = loadJd(example("jd.yaml"));
      if (!jd.ok) fail(`example jd invalid:\n  ${jd.errors.join("\n  ")}`);
      const ats = analyzeAts(await extractPdfText(pdf), jd.data, 0.8);
      console.log(`PASS: smoke rendered ${html} to ${pages} page(s) (max 1), verified fit ${fitVerdict}, legacy ATS coverage ${Math.round(ats.must.ratio * 100)}%, clean of AI tells, every claim traces to the canon, impact clean`);
    });
}

/**
 * The commands that are not a gate, and the order every command is registered in. The order
 * is the CLI's published help; a newly registered gate appends to the end of it rather than
 * needing an edit here.
 */
export const BUILTIN_COMMANDS = new Map<string, (program: Command) => void>([
  ["verify-pack", addVerifyPack],
  ["verify-pack-fresh", addVerifyPackFresh],
  ["validate", addValidate],
  ["migrate-canon", addMigrateCanon],
  ["migrate-requirements", addMigrateRequirements],
  ["issue-baseline-receipt", addIssueBaselineReceipt],
  ["render", addRender],
  ["jd-pdf", addJdPdf],
  ["smoke", addSmoke],
]);

/** The published help order. Every registered command must appear here exactly once. */
export const COMMAND_ORDER = [
  "verify-pack", "verify-pack-fresh", "validate", "migrate-canon", "lint", "page-fit", "ip-guard",
  "ats", "migrate-requirements", "issue-baseline-receipt", "fit", "requirements-ats", "legacy-fit",
  "claim-integrity", "trace", "impact", "distinct", "render", "jd-pdf", "smoke",
];

export function buildProgram(gates: readonly Gate[] = GATES): Command {
  const program = new Command();
  program.name("tailored").description("Deterministic gates around a stochastic CV writer. The model proposes; the gates decide.").version(version);
  const commands = new Map(gateCommands(gates).map(command => [command.name, command]));
  for (const name of COMMAND_ORDER) {
    const builtin = BUILTIN_COMMANDS.get(name);
    if (builtin) { builtin(program); continue; }
    const command = commands.get(name);
    if (command) addGateCommand(program, command);
  }
  for (const command of commands.values()) if (!COMMAND_ORDER.includes(command.name)) addGateCommand(program, command);
  return program;
}

/** True only when this module is the process entry point, so importing it does not run the CLI. */
function runningAsCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try { return realpathSync(entry) === fileURLToPath(import.meta.url); }
  catch { return false; }
}

if (runningAsCli()) buildProgram().parseAsync(process.argv);
