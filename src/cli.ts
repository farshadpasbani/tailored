#!/usr/bin/env node
import { linkSync, readFileSync, writeFileSync, realpathSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import yaml from "js-yaml";
import { loadCanon } from "./canon/load.js";
import { migrateCanon } from "./canon/migrate.js";
import { loadJd } from "./jd/load.js";
import { lintAiTells } from "./gates/aiTell.js";
import { assertPageFit } from "./gates/pageFit.js";
import { extractPdfText } from "./gates/run.js";
import { analyzeAts, analyzeRequirementAts, parseChecks } from "./gates/ats.js";
import { canonToText, analyzeFit, analyzeRequirementFit, validateThresholds, type FitEvidencePolicy } from "./gates/fit.js";
import { issueBaselineReceipt, loadRequirements, prepareRequirementsBaseline, RequirementsSchema, sha256Text, type BaselineReceipt, type ReceiptResolver } from "./requirements/schema.js";
import { migrateLegacyJdToRequirements } from "./requirements/migrate.js";
import { analyzeTrace } from "./gates/trace.js";
import { verifyClaimIntegrity } from "./gates/claimIntegrity.js";
import { loadEvidenceFile } from "./evidence/schema.js";
import { analyzeImpact, type ImpactOptions } from "./gates/impact.js";
import { checkDistinct } from "./gates/distinct.js";
import { scanProtected } from "./gates/ipGuard.js";
import { analyzeProhibitedClaims, hasVisibleNumericOccurrences, MetricClaimsFileSchema, type MetricClaim, type NumericExemption } from "./gates/prohibitedClaims.js";
import { inspectRenderedDocument, renderToPdf } from "./render/chrome.js";
import { jdMarkdownToHtml } from "./jd/pdf.js";
import { version } from "./index.js";
import { verifyPack, verifyReceiptFreshness } from "./verify/pack.js";
import { VerifyReceiptSchema } from "./verify/receipt.js";

const program = new Command();
program.name("tailored").description("Deterministic gates around a stochastic CV writer. The model proposes; the gates decide.").version(version);

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function fitEvidencePolicy(allowCandidateAttested: boolean): FitEvidencePolicy {
  return { allowCandidateAttested, minConfidence: 0.5, allowedUses: ["fit"], allowedSensitivities: ["public", "private"], allowedProvenanceTypes: ["candidate-attested", "artifact", "external"] };
}

function receiptResolver(paths: string[]): ReceiptResolver {
  const receipts = new Map<string, unknown>();
  for (const path of paths) {
    let raw: any;
    try { raw = yaml.load(readFileSync(path, "utf8")); }
    catch (error) { fail(`could not read receipt at ${path}: ${(error as Error).message}`); }
    if (typeof raw?.sha256 !== "string") fail(`receipt at ${path} has no sha256`);
    receipts.set(raw.sha256, raw);
  }
  return (sha256) => receipts.get(sha256);
}

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
    const temporary = `${output}.tmp-${process.pid}`;
    try {
      writeFileSync(temporary, rendered, { encoding: "utf8", flag: "wx" });
      renameSync(temporary, output);
    } catch (error) {
      rmSync(temporary, { force: true });
      fail(`could not write migrated canon at ${output}: ${(error as Error).message}`);
    }
    console.log(`PASS: migrated ${input} to strict schemaVersion 2 at ${output} (${result.report.mapped.length} source values mapped)`);
  });

program
  .command("lint")
  .description("scan files for AI tells (em dashes, -- connectors, &mdash; entities)")
  .argument("<files...>", "files to lint")
  .action((files: string[]) => {
    let total = 0;
    for (const f of files) {
      let content: string;
      try { content = readFileSync(f, "utf8"); }
      catch (e) { fail(`cannot read ${f}: ${(e as Error).message}`); }
      const issues = lintAiTells(content);
      for (const i of issues) console.error(`${f}:${i.line}: ${i.rule} (${JSON.stringify(i.match)})`);
      total += issues.length;
    }
    if (total > 0) fail(`${total} AI tell(s) found across ${files.length} file(s)`);
    console.log(`PASS: ${files.length} file(s) clean of AI tells`);
  });

program
  .command("page-fit")
  .description("assert a PDF fits within a maximum page count")
  .argument("<pdf>", "path to the PDF")
  .option("--max <n>", "maximum allowed pages", "1")
  .action(async (pdf: string, opts: { max: string }) => {
    const max = Number(opts.max);
    if (!Number.isInteger(max) || max < 1) fail(`--max must be a positive integer, got ${JSON.stringify(opts.max)}`);
    let res;
    try { res = await assertPageFit(pdf, max); }
    catch (e) { fail((e as Error).message); }
    if (!res.ok) fail(`${pdf} is ${res.pages} page(s), over the limit of ${res.max}`);
    console.log(`PASS: ${pdf} is ${res.pages} page(s), within ${res.max}`);
  });

program
  .command("ip-guard")
  .description("scan a file for a canon's protected topics")
  .argument("<file>", "file to scan")
  .requiredOption("--canon <canon>", "path to canon.yaml supplying protectedTopics")
  .option("--metric-claims <path>", "persisted structured metric claims for numeric document claims")
  .action(async (file: string, opts: { canon: string; metricClaims?: string }) => {
    const r = loadCanon(opts.canon);
    if (!r.ok) fail(`invalid canon\n  ${r.errors.join("\n  ")}`);
    let content: string;
    try { content = readFileSync(file, "utf8"); }
    catch (e) { fail(`cannot read ${file}: ${(e as Error).message}`); }
    if (hasVisibleNumericOccurrences(content) && !opts.metricClaims) {
      fail("document contains visible numeric occurrence(s); --metric-claims is required");
    }
    let metricClaims: MetricClaim[] | undefined;
    let numericExemptions: NumericExemption[] | undefined;
    if (opts.metricClaims) {
      let rawClaims: unknown;
      try { rawClaims = yaml.load(readFileSync(opts.metricClaims, "utf8")); }
      catch (e) { fail(`could not read/parse metric claims YAML at ${opts.metricClaims}: ${(e as Error).message}`); }
      const parsedClaims = MetricClaimsFileSchema.safeParse(rawClaims);
      if (!parsedClaims.success) {
        fail(`invalid metric claims\n  ${parsedClaims.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n  ")}`);
      }
      metricClaims = parsedClaims.data.claims;
      numericExemptions = parsedClaims.data.exemptions;
    }
    const leaks = scanProtected(content, r.data.protectedTopics);
    for (const l of leaks) console.error(`${file}:${l.line}: leaked protected topic "${l.term}"`);
    let renderedDocument;
    if (numericExemptions?.some(exemption => exemption.sourcePaths !== undefined)) {
      try { renderedDocument = await inspectRenderedDocument(file); }
      catch (error) { fail(`could not verify rendered canon markers: ${(error as Error).message}`); }
    }
    const prohibited = analyzeProhibitedClaims({ text: content, canon: r.data, metricClaims, numericExemptions, renderedDocument });
    for (const issue of prohibited.issues) {
      console.error(`${file}: forbidden claim ${issue.concept ?? issue.kind} (${issue.sourcePath ?? issue.path}): ${issue.message}`);
    }
    if (leaks.length > 0 || !prohibited.ok) {
      fail(`${leaks.length} protected-topic leak(s) and ${prohibited.issues.length} forbidden claim(s) in ${file}`);
    }
    console.log(`PASS: ${file} leaks none of ${r.data.protectedTopics.length} protected topic(s) and asserts no forbidden claims`);
  });

program
  .command("ats")
  .description("check a rendered CV PDF parses for ATS and covers a job's must-have keywords")
  .argument("<pdf>", "path to the rendered CV PDF")
  .requiredOption("--jd <jd>", "path to jd.yaml (role keywords)")
  .option("--min <ratio>", "minimum must-have coverage to pass (0..1)", "0.8")
  .action(async (pdf: string, opts: { jd: string; min: string }) => {
    const min = Number(opts.min);
    if (!(min >= 0 && min <= 1)) fail(`--min must be a number in [0,1], got ${JSON.stringify(opts.min)}`);
    const jd = loadJd(opts.jd);
    if (!jd.ok) fail(`invalid jd\n  ${jd.errors.join("\n  ")}`);
    // Warn on orphan synonym keys (likely typos): a synonym for a term that is not gated does nothing.
    for (const key of Object.keys(jd.data.synonyms)) {
      if (![...jd.data.mustHave, ...jd.data.niceToHave].includes(key))
        console.error(`WARN: synonym key "${key}" is not in mustHave/niceToHave`);
    }
    let text: string;
    try { text = await extractPdfText(pdf); }
    catch (e) { fail((e as Error).message); }
    const r = analyzeAts(text, jd.data, min);
    if (!r.parse.textLayer) console.error("  parse: no text layer (image-only PDF?)");
    if (!r.parse.contact) console.error("  parse: no contact email found");
    if (r.parse.headings < 3) console.error(`  parse: only ${r.parse.headings}/3 standard headings found`);
    for (const m of r.must.missing) console.error(`  missing must-have: ${m}`);
    for (const t of [...r.must.synonymOnly, ...r.nice.synonymOnly])
      console.error(`  WARN: "${t}" covered only via synonym; the JD names it literally - surface this to the candidate as add-or-waive, a screener greps the literal string`);
    const pct = Math.round(r.must.ratio * 100);
    if (!r.ok) fail(`ats: ${r.parse.ok ? "parseable" : "not parseable"}, must-have coverage ${pct}% (${r.must.covered.length}/${jd.data.mustHave.length}), min ${Math.round(min * 100)}%`);
    console.log(`PASS: ats - parseable, must-have coverage ${pct}% (${r.must.covered.length}/${jd.data.mustHave.length}); nice-to-have ${Math.round(r.nice.ratio * 100)}%`);
  });

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
    const temporary = `${output}.tmp-${process.pid}`;
    try { writeFileSync(temporary, rendered, { encoding: "utf8", flag: "wx" }); renameSync(temporary, output); }
    catch (error) { rmSync(temporary, { force: true }); fail(`could not write migrated requirements at ${output}: ${(error as Error).message}`); }
    console.log(`PASS: migrated legacy keywords to explicit-gap requirements v2 at ${output}`);
  });

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
    const temporary = `${receiptPath}.tmp-${process.pid}`;
    try { writeFileSync(temporary, rendered, { encoding: "utf8", flag: "wx" }); linkSync(temporary, receiptPath); rmSync(temporary); }
    catch (error) { rmSync(temporary, { force: true }); fail(`could not write baseline receipt: ${(error as Error).message}`); }
    console.log(`PASS: issued external baseline receipt ${issued.sha256} at ${receiptPath}`);
  });

program
  .command("fit")
  .description("calculate verified fit only from a frozen requirements-to-canon-evidence map")
  .requiredOption("--requirements <path>", "path to requirements.yaml v2")
  .requiredOption("--jd-text <path>", "path to the hash-bound archived job description")
  .requiredOption("--canon <canon>", "path to canon.yaml v2")
  .requiredOption("--baseline-receipt <path>", "trusted externally stored baseline receipt")
  .option("--allow-candidate-attested", "explicitly permit candidate-attested facts to award fit weight")
  .option("--receipt <path>", "prior waiver receipt (repeatable)", (value: string, prior: string[]) => [...prior, value], [] as string[])
  .option("--as-of <date>", "receipt-validation date (YYYY-MM-DD)")
  .action((opts: { requirements: string; jdText: string; canon: string; baselineReceipt: string; allowCandidateAttested?: boolean; receipt: string[]; asOf?: string }) => {
    const canon = loadCanon(opts.canon);
    if (!canon.ok) fail(`invalid canon\n  ${canon.errors.join("\n  ")}`);
    const requirements = loadRequirements(opts.requirements, { archivedJdPath: opts.jdText, canon: canon.data, baselineReceiptResolver: receiptResolver([opts.baselineReceipt]), receiptResolver: receiptResolver(opts.receipt), asOfDate: opts.asOf });
    if (!requirements.ok) fail(`invalid requirements\n  ${requirements.errors.join("\n  ")}`);
    const result = analyzeRequirementFit(requirements.data, canon.data, fitEvidencePolicy(Boolean(opts.allowCandidateAttested)));
    for (const requirement of result.direct) console.error(`  direct evidence: ${requirement.id}`);
    for (const requirement of result.transferable) console.error(`  transferable evidence: ${requirement.id}`);
    for (const requirement of result.materialGaps) console.error(`  material gap: ${requirement.id}`);
    for (const requirement of result.waived) console.error(`  waived evidence gap: ${requirement.id} (${requirement.evidence.kind === "waived" ? requirement.evidence.waiver.id : ""})`);
    for (const requirement of result.reclassified) console.error(`  reclassified by validated prior receipt: ${requirement.id}`);
    for (const requirement of result.ineligibleEvidence) console.error(`  ineligible canon evidence: ${requirement.id}`);
    for (const requirement of result.eligibilityUncertainties) console.error(`  eligibility uncertain: ${requirement.id}`);
    for (const requirement of result.hardBlockers) console.error(`  HARD BLOCKER: ${requirement.id}`);
    console.log(`${result.verdict}: verified requirement-evidence fit ${Math.round(result.score * 100)}% (${result.earnedWeight}/${result.totalWeight} weighted evidence)`);
    if (result.verdict === "BLOCKED" || result.verdict === "WEAK") process.exit(1);
  });

program
  .command("requirements-ats")
  .description("report literal ATS vocabulary separately from verified requirement fit")
  .argument("<pdf>", "rendered CV PDF")
  .requiredOption("--requirements <path>", "path to requirements.yaml v2")
  .requiredOption("--jd-text <path>", "path to the hash-bound archived job description")
  .requiredOption("--canon <canon>", "path to canon.yaml v2")
  .requiredOption("--baseline-receipt <path>", "trusted externally stored baseline receipt")
  .option("--min <ratio>", "minimum literal ATS term coverage", "0.8")
  .option("--include-ats-aliases", "explicitly include reviewed aliases/paraphrases in the ATS score")
  .option("--receipt <path>", "prior waiver receipt (repeatable)", (value: string, prior: string[]) => [...prior, value], [] as string[])
  .option("--as-of <date>", "receipt-validation date (YYYY-MM-DD)")
  .action(async (pdf: string, opts: { requirements: string; jdText: string; canon: string; baselineReceipt: string; min: string; includeAtsAliases?: boolean; receipt: string[]; asOf?: string }) => {
    const min = Number(opts.min);
    if (!(min >= 0 && min <= 1)) fail(`--min must be a number in [0,1], got ${JSON.stringify(opts.min)}`);
    const canon = loadCanon(opts.canon);
    if (!canon.ok) fail(`invalid canon\n  ${canon.errors.join("\n  ")}`);
    const requirements = loadRequirements(opts.requirements, { archivedJdPath: opts.jdText, canon: canon.data, baselineReceiptResolver: receiptResolver([opts.baselineReceipt]), receiptResolver: receiptResolver(opts.receipt), asOfDate: opts.asOf });
    if (!requirements.ok) fail(`invalid requirements\n  ${requirements.errors.join("\n  ")}`);
    let text: string;
    try { text = await extractPdfText(pdf); }
    catch (error) { fail((error as Error).message); }
    const parse = parseChecks(text);
    const result = analyzeRequirementAts(text, requirements.data, min, { includeAliases: Boolean(opts.includeAtsAliases) });
    if (!parse.textLayer) console.error("  parse: no text layer (image-only PDF?)");
    if (!parse.contact) console.error("  parse: no contact email found");
    if (parse.headings < 3) console.error(`  parse: only ${parse.headings}/3 standard headings found`);
    for (const term of result.missing) console.error(`  missing ATS term: ${term}`);
    const summary = `ATS ${result.policy.includeAliases ? "literal+alias" : "literal"} vocabulary ${Math.round(result.ratio * 100)}% (${result.covered.length}/${result.covered.length + result.missing.length}); verified fit is not inferred`;
    if (!parse.ok || !result.ok) fail(`${parse.ok ? "parseable" : "not parseable"}; ${summary}`);
    console.log(`PASS: ${summary}`);
  });

program
  .command("legacy-fit")
  .description("legacy compatibility: keyword coverage against canon text (not verified fit)")
  .requiredOption("--jd <jd>", "path to jd.yaml")
  .requiredOption("--canon <canon>", "path to canon.yaml")
  .option("--apply <ratio>", "must-have coverage at/above which the verdict is APPLY", "0.8")
  .option("--floor <ratio>", "must-have coverage below which the verdict is SKIP", "0.5")
  .action((opts: { jd: string; canon: string; apply: string; floor: string }) => {
    const apply = Number(opts.apply), floor = Number(opts.floor);
    if (!(apply >= 0 && apply <= 1)) fail(`--apply must be a number in [0,1], got ${JSON.stringify(opts.apply)}`);
    if (!(floor >= 0 && floor <= 1)) fail(`--floor must be a number in [0,1], got ${JSON.stringify(opts.floor)}`);
    const thresholdError = validateThresholds(apply, floor);
    if (thresholdError) fail(thresholdError);
    const jd = loadJd(opts.jd);
    if (!jd.ok) fail(`invalid jd\n  ${jd.errors.join("\n  ")}`);
    const canon = loadCanon(opts.canon);
    if (!canon.ok) fail(`invalid canon\n  ${canon.errors.join("\n  ")}`);
    const r = analyzeFit(canonToText(canon.data), jd.data, { apply, floor });
    for (const m of r.must.missing)
      console.error(`  gap: "${m}" not covered by the canon - does the canon genuinely lack it, or is it phrased differently?`);
    const pct = Math.round(r.must.ratio * 100);
    console.log(`${r.verdict}: must-have coverage ${pct}% (${r.must.covered.length}/${jd.data.mustHave.length}); nice-to-have ${Math.round(r.nice.ratio * 100)}%`);
    if (r.verdict === "SKIP") process.exit(1);
  });

program
  .command("claim-integrity")
  .description("verify claim-marker coverage, exact evidence bindings, namespace separation, and structured metrics; does not prove arbitrary semantic truth")
  .argument("<html>", "path to authored CV or cover HTML")
  .requiredOption("--artifact <id>", "artifact ID recorded in evidence.yaml, such as cv or cover")
  .requiredOption("--canon <canon>", "path to strict or migratable canon.yaml")
  .requiredOption("--evidence <evidence>", "path to strict evidence.yaml")
  .action(async (html: string, opts: { artifact: string; canon: string; evidence: string }) => {
    const canon = loadCanon(opts.canon);
    if (!canon.ok) fail(`invalid canon\n  ${canon.errors.join("\n  ")}`);
    const evidence = loadEvidenceFile(opts.evidence);
    if (!evidence.ok) fail(`invalid evidence\n  ${evidence.errors.join("\n  ")}`);
    let result;
    try { result = await verifyClaimIntegrity({ htmlPath: html, evidencePath: opts.evidence, artifact: opts.artifact, evidence: evidence.data, canon: canon.data }); }
    catch (error) { fail(`cannot establish rendered claim integrity for ${html}: ${(error as Error).message}`); }
    for (const problem of result.issues) {
      console.error(`  ${problem.artifact}:line ${problem.line} [${problem.kind}]${problem.claimId ? ` ${problem.claimId}:` : ""} ${problem.message}`);
    }
    if (!result.ok) fail(`claim-integrity: ${result.issues.length} blocking issue(s) in artifact ${JSON.stringify(opts.artifact)}`);
    console.log(`PASS: claim structural and evidence integrity passed for ${opts.artifact}; this does not prove arbitrary semantic truth or editorial quality`);
  });

program
  .command("trace")
  .description("legacy defence-in-depth check for disconnected numeric values, names, and dates; does not prove semantic truth")
  .argument("<html>", "path to the rendered HTML document (cv.html or cover.html)")
  .requiredOption("--canon <canon>", "path to canon.yaml")
  .option("--jd-text <path>", "path to the archived job description text, for claims that describe the employer")
  .action((html: string, opts: { canon: string; jdText?: string }) => {
    const r = loadCanon(opts.canon);
    if (!r.ok) fail(`invalid canon\n  ${r.errors.join("\n  ")}`);
    let content: string;
    try { content = readFileSync(html, "utf8"); }
    catch (e) { fail(`cannot read ${html}: ${(e as Error).message}`); }
    let jdText = "";
    if (opts.jdText) {
      try { jdText = readFileSync(opts.jdText, "utf8"); }
      catch (e) { fail(`cannot read ${opts.jdText}: ${(e as Error).message}`); }
    }
    const result = analyzeTrace(content, r.data, jdText);
    for (const c of result.untracedNumbers) console.error(`  untraced claim: "${c.raw}" (no matching value in the canon${opts.jdText ? " or --jd-text" : ""})`);
    for (const i of result.nameIssues) console.error(i.kind === "unknown-name" ? `  unknown name: "${i.detail}" (not in the canon)` : `  date mismatch: ${i.detail} (does not match the canon)`);
    for (const s of result.structuralIssues) console.error(`  structural: ${s}`);
    if (!result.ok) fail(`trace: ${result.untracedNumbers.length} untraced claim(s), ${result.nameIssues.length} name/date issue(s), ${result.structuralIssues.length} structural issue(s) in ${html}`);
    console.log(`PASS: trace - disconnected numeric/name/date checks passed for ${html}; this legacy check does not prove semantic truth`);
  });

program
  .command("impact")
  .description("lint a CV against the recruiter six-second skim (readability, summary length, duplication, voice, dates, bullets)")
  .argument("<html>", "path to the authored CV HTML")
  .option("--min-font <pt>", "minimum body font-size in pt", "9")
  .option("--min-margin <mm>", "minimum @page margin in mm", "8")
  .option("--min-line-height <ratio>", "minimum unitless body line-height", "1.28")
  .option("--summary-max-words <n>", "maximum words in .summary", "60")
  .option("--bullet-max-words <n>", "maximum words per li", "45")
  .option("--skill-max-words <n>", "maximum words per skills-row value", "18")
  .option("--skip-min-font", "silence the minimum font-size check")
  .option("--skip-min-margin", "silence the minimum page-margin check")
  .option("--skip-min-line-height", "silence the minimum line-height check")
  .option("--skip-summary-ceiling", "silence the summary word-ceiling check")
  .option("--skip-duplicate-sentence", "silence the duplicate-sentence check")
  .option("--skip-skill-density", "silence the skills-row keyword-dump check")
  .option("--skip-contrast", "silence the rhetorical-contrast counter")
  .option("--skip-person-consistency", "silence the person-consistency check")
  .option("--skip-dated-entries", "silence the dated-entries check")
  .option("--skip-bullet-bounds", "silence the bullet bounds/weak-phrase check")
  .action((html: string, opts: Record<string, string | boolean | undefined>) => {
    const minFontPt = Number(opts.minFont);
    const minMarginMm = Number(opts.minMargin);
    const minLineHeight = Number(opts.minLineHeight);
    const summaryMaxWords = Number(opts.summaryMaxWords);
    const bulletMaxWords = Number(opts.bulletMaxWords);
    const skillMaxWords = Number(opts.skillMaxWords);
    if (![minFontPt, minMarginMm, minLineHeight, summaryMaxWords, bulletMaxWords, skillMaxWords].every((n) => Number.isFinite(n) && n > 0))
      fail("--min-font, --min-margin, --min-line-height, --summary-max-words, --bullet-max-words, and --skill-max-words must be positive numbers");
    const options: ImpactOptions = {
      minFontPt, minMarginMm, minLineHeight, summaryMaxWords, bulletMaxWords, skillMaxWords,
      checkMinFont: !opts.skipMinFont,
      checkMinMargin: !opts.skipMinMargin,
      checkMinLineHeight: !opts.skipMinLineHeight,
      checkSummaryCeiling: !opts.skipSummaryCeiling,
      checkDuplicateSentence: !opts.skipDuplicateSentence,
      checkSkillDensity: !opts.skipSkillDensity,
      checkContrast: !opts.skipContrast,
      checkPersonConsistency: !opts.skipPersonConsistency,
      checkDatedEntries: !opts.skipDatedEntries,
      checkBulletBounds: !opts.skipBulletBounds,
    };
    let content: string;
    try { content = readFileSync(html, "utf8"); }
    catch (e) { fail(`cannot read ${html}: ${(e as Error).message}`); }
    const r = analyzeImpact(content, options);
    let violations = 0;
    if (r.readability && !r.readability.fontOk) { console.error(`  readability: body font-size ${r.readability.fontPt ?? "unknown"}pt is below the floor of ${minFontPt}pt`); violations++; }
    if (r.readability && !r.readability.marginOk) { console.error(`  readability: @page margin ${r.readability.marginMm.join("mm, ") || "unknown"}mm is below the floor of ${minMarginMm}mm`); violations++; }
    if (r.readability && !r.readability.lineHeightOk && !opts.skipMinLineHeight) { console.error(`  readability: body line-height ${r.readability.lineHeight ?? "undeclared (or unit-carrying)"} is below the floor of ${minLineHeight}; page-fit must come from selecting less content, not compressing what stays`); violations++; }
    if (r.summary && !r.summary.ok) { console.error(`  summary ceiling: .summary is ${r.summary.words} words, over the ${summaryMaxWords}-word ceiling`); violations++; }
    if (r.duplicates && !r.duplicates.ok) {
      for (const d of r.duplicates.duplicates) {
        const lines = d.locations.map((l) => l.line).join(" and ");
        console.error(`  duplicate sentence (lines ${lines}): "${d.sentence}"`);
        violations++;
      }
    }
    if (r.skills && !r.skills.ok) {
      for (const v of r.skills.violations) { console.error(`  skill density: ${v.words}-word skills row over the ${skillMaxWords}-word cap (a keyword dump reads as ATS bait): "${v.text.slice(0, 80)}..."`); violations++; }
    }
    if (r.contrast && !r.contrast.ok) { console.error(`  rhetorical contrast: "${r.contrast.matches.join('", "')}" used ${r.contrast.count} times, over the limit of 1`); violations++; }
    if (r.person && !r.person.ok) { console.error("  person consistency: document mixes first-person and third-person self-reference"); violations++; }
    if (r.dated && !r.dated.ok) {
      for (const u of r.dated.undated) { console.error(`  dated entries: undated entry in ${u.section}: "${u.header}"`); violations++; }
    }
    if (r.bullets && !r.bullets.ok) {
      for (const v of r.bullets.violations) { console.error(`  bullet bounds (${v.reason}): "${v.text}"`); violations++; }
    }
    if (!r.ok) fail(`impact: ${violations} violation(s) in ${html}`);
    console.log(`PASS: impact - ${html} clean of all enabled checks`);
  });

program
  .command("distinct")
  .description("fail when a document shares an 8+ word run of prose with prior applications (the anti-template gate)")
  .argument("<html>", "path to the new authored HTML")
  .argument("<priors...>", "paths to prior applications' HTML to compare against")
  .option("--max-shared <n>", "tolerated number of shared 8+ word runs", "0")
  .option("--max-signatures <n>", "tolerated number of signature phrases (4+ words recurring in 2+ priors)", "0")
  .option("--ignore-section <name>", "section heading to exclude (repeatable; factual sections legitimately repeat)", (v: string, acc: string[]) => acc.concat(v), [] as string[])
  .option("--canon <canon>", "canon.yaml; a signature phrase found verbatim in the canon is a fact, not a voice tic, and is exempt")
  .action((html: string, priors: string[], opts: { maxShared: string; maxSignatures: string; ignoreSection: string[]; canon?: string }) => {
    const maxShared = Number(opts.maxShared);
    const maxSignatures = Number(opts.maxSignatures);
    if (![maxShared, maxSignatures].every((n) => Number.isFinite(n) && n >= 0)) fail("--max-shared and --max-signatures must be non-negative numbers");
    let canonText: string | undefined;
    if (opts.canon) {
      const c = loadCanon(opts.canon);
      if (!c.ok) fail(`invalid canon\n  ${c.errors.join("\n  ")}`);
      // The exemption corpus is every fact the canon states, including the identity
      // and date fields canonToText (a skills-matching corpus) leaves out.
      canonText = [
        canonToText(c.data),
        c.data.identity.name, c.data.identity.role,
        c.data.identity.location ?? "", c.data.identity.email ?? "", c.data.identity.phone ?? "",
        ...(c.data.identity.links ?? []).map((l) => `${l.label} ${l.url}`),
        ...c.data.experience.flatMap((e) => [`${e.title} ${e.org} ${e.location ?? ""} ${e.start} ${e.end}`]),
        ...c.data.education.map((e) => `${e.qualification} ${e.institution} ${e.year} ${e.result ?? ""}`),
        ...c.data.projects.flatMap((p) => (p.links ?? []).map((l) => `${l.label} ${l.url}`)),
      ].join("\n");
    }
    let content: string;
    try { content = readFileSync(html, "utf8"); }
    catch (e) { fail(`cannot read ${html}: ${(e as Error).message}`); }
    // A "../*/cover.html"-style glob naturally includes the document under test;
    // comparing a file against itself would fail every fresh draft, so drop it.
    const selfPath = realpathSync(html);
    const priorDocs = priors
      .filter((p) => {
        try { return realpathSync(p) !== selfPath; }
        catch { return true; }
      })
      .map((p) => {
        try { return { name: p, html: readFileSync(p, "utf8") }; }
        catch (e) { fail(`cannot read ${p}: ${(e as Error).message}`); }
      });
    if (priorDocs.length < priors.length) console.log(`  (skipping the document itself from the prior set)`);
    const r = checkDistinct(content, priorDocs, { maxShared, maxSignatures, ignoreSections: opts.ignoreSection, canonText });
    for (const run of r.shared) console.error(`  shared with ${run.sources.join(", ")}: "${run.text}"`);
    for (const run of r.signatures) console.error(`  signature phrase (also in ${run.sources.join(", ")}): "${run.text}"`);
    if (!r.ok) fail(`distinct: ${r.shared.length} shared run(s) and ${r.signatures.length} signature phrase(s) between ${html} and prior applications (max ${maxShared}/${maxSignatures}); rewrite them for this role, do not raise the ceiling`);
    console.log(`PASS: distinct - ${html} shares ${r.shared.length} run(s), ${r.signatures.length} signature phrase(s) with ${priorDocs.length} prior document(s)`);
  });

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

program
  .command("smoke")
  .description("render the alex-rivers example and run the page-fit and ai-tell gates")
  .action(async () => {
    // Resolve the bundled example relative to this file (dist/cli.js -> ../examples/...)
    // so `tailored smoke` works from any working directory, including a global install.
    const html = fileURLToPath(new URL("../examples/alex-rivers/cv.html", import.meta.url));
    const pdf = join(tmpdir(), `tailored-smoke-${process.pid}.pdf`);
    const htmlContent = readFileSync(html, "utf8");
    const tells = lintAiTells(htmlContent);
    if (tells.length > 0) fail(`${html} has ${tells.length} AI tell(s)`);
    const canonPath = fileURLToPath(new URL("../examples/alex-rivers/canon.yaml", import.meta.url));
    const canon = loadCanon(canonPath);
    if (!canon.ok) fail(`example canon invalid:\n  ${canon.errors.join("\n  ")}`);
    const trace = analyzeTrace(htmlContent, canon.data, "");
    if (!trace.ok) fail(`example CV fails trace: ${trace.untracedNumbers.length} untraced claim(s), ${trace.nameIssues.length} name/date issue(s), ${trace.structuralIssues.length} structural issue(s)`);
    const impact = analyzeImpact(htmlContent, {
      minFontPt: 9, minMarginMm: 8, minLineHeight: 1.28, summaryMaxWords: 60, bulletMaxWords: 45, skillMaxWords: 18,
      checkMinFont: true, checkMinMargin: true, checkMinLineHeight: true, checkSummaryCeiling: true,
      checkDuplicateSentence: true, checkSkillDensity: true,
      checkContrast: true, checkPersonConsistency: true, checkDatedEntries: true, checkBulletBounds: true,
    });
    if (!impact.ok) fail(`${html} fails the impact lint gate`);
    try { await renderToPdf(html, pdf); }
    catch (e) { fail((e as Error).message); }
    let res;
    // The Alex Rivers CV is one page by design; the smoke gate enforces that.
    try { res = await assertPageFit(pdf, 1); }
    catch (e) { fail((e as Error).message); }
    if (!res.ok) fail(`${html} rendered to ${res.pages} page(s), over the limit of ${res.max}`);
    const jdPath = fileURLToPath(new URL("../examples/alex-rivers/jd.yaml", import.meta.url));
    const jd = loadJd(jdPath);
    if (!jd.ok) fail(`example jd invalid:\n  ${jd.errors.join("\n  ")}`);
    const requirementsPath = fileURLToPath(new URL("../examples/alex-rivers/requirements.yaml", import.meta.url));
    const baselineReceiptPath = fileURLToPath(new URL("../examples/alex-rivers/baseline-receipt.yaml", import.meta.url));
    const archivedJdPath = fileURLToPath(new URL("../examples/alex-rivers/job-description.md", import.meta.url));
    const requirements = loadRequirements(requirementsPath, { archivedJdPath, canon: canon.data, baselineReceiptResolver: receiptResolver([baselineReceiptPath]) });
    if (!requirements.ok) fail(`example requirements invalid\n  ${requirements.errors.join("\n  ")}`);
    const fit = analyzeRequirementFit(requirements.data, canon.data, fitEvidencePolicy(true));
    if (fit.verdict !== "STRONG") fail(`example candidate does not verdict STRONG on verified fit: ${fit.verdict}`);
    let atsText: string;
    try { atsText = await extractPdfText(pdf); }
    catch (e) { fail((e as Error).message); }
    const ats = analyzeAts(atsText, jd.data, 0.8);
    if (!ats.ok) fail(`example CV fails ats: coverage ${Math.round(ats.must.ratio * 100)}%, missing ${ats.must.missing.join(", ")}`);
    console.log(`PASS: smoke rendered ${html} to ${res.pages} page(s) (max ${res.max}), verified fit ${fit.verdict}, legacy ATS coverage ${Math.round(ats.must.ratio * 100)}%, clean of AI tells, every claim traces to the canon, impact clean`);
  });

program.parseAsync(process.argv);
