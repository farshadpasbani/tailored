#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { loadCanon } from "./canon/load.js";
import { loadJd } from "./jd/load.js";
import { lintAiTells } from "./gates/aiTell.js";
import { assertPageFit } from "./gates/pageFit.js";
import { extractPdfText } from "./gates/run.js";
import { analyzeAts } from "./gates/ats.js";
import { canonToText, analyzeFit, validateThresholds } from "./gates/fit.js";
import { analyzeTrace } from "./gates/trace.js";
import { scanProtected } from "./gates/ipGuard.js";
import { renderToPdf } from "./render/chrome.js";
import { jdMarkdownToHtml } from "./jd/pdf.js";
import { version } from "./index.js";

const program = new Command();
program.name("tailored").description("Deterministic gates around a stochastic CV writer. The model proposes; the gates decide.").version(version);

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

program
  .command("validate")
  .description("validate a canon.yaml against the schema")
  .argument("<canon>", "path to canon.yaml")
  .action((canon: string) => {
    const r = loadCanon(canon);
    if (!r.ok) fail(`invalid canon\n  ${r.errors.join("\n  ")}`);
    console.log(`PASS: ${canon} is a valid canon for ${r.data.identity.name}`);
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
  .action((file: string, opts: { canon: string }) => {
    const r = loadCanon(opts.canon);
    if (!r.ok) fail(`invalid canon\n  ${r.errors.join("\n  ")}`);
    const leaks = scanProtected(readFileSync(file, "utf8"), r.data.protectedTopics);
    for (const l of leaks) console.error(`${file}:${l.line}: leaked protected topic "${l.term}"`);
    if (leaks.length > 0) fail(`${leaks.length} protected-topic leak(s) in ${file}`);
    console.log(`PASS: ${file} leaks none of ${r.data.protectedTopics.length} protected topic(s)`);
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
    const pct = Math.round(r.must.ratio * 100);
    if (!r.ok) fail(`ats: ${r.parse.ok ? "parseable" : "not parseable"}, must-have coverage ${pct}% (${r.must.covered.length}/${jd.data.mustHave.length}), min ${Math.round(min * 100)}%`);
    console.log(`PASS: ats - parseable, must-have coverage ${pct}% (${r.must.covered.length}/${jd.data.mustHave.length}); nice-to-have ${Math.round(r.nice.ratio * 100)}%`);
  });

program
  .command("fit")
  .description("triage a jd's must-have coverage against the canon before authoring anything")
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
  .command("trace")
  .description("check every numeric claim, employer, institution, and project in an HTML document traces to the canon")
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
    if (!result.ok) fail(`trace: ${result.untracedNumbers.length} untraced claim(s), ${result.nameIssues.length} name/date issue(s) in ${html}`);
    console.log(`PASS: trace - every claim in ${html} traces to the canon`);
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
    if (!trace.ok) fail(`example CV fails trace: ${trace.untracedNumbers.length} untraced claim(s), ${trace.nameIssues.length} name/date issue(s)`);
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
    const fit = analyzeFit(canonToText(canon.data), jd.data, { apply: 0.8, floor: 0.5 });
    if (fit.verdict !== "APPLY") fail(`example candidate does not verdict APPLY on fit: ${fit.verdict}, missing ${fit.must.missing.join(", ")}`);
    let atsText: string;
    try { atsText = await extractPdfText(pdf); }
    catch (e) { fail((e as Error).message); }
    const ats = analyzeAts(atsText, jd.data, 0.8);
    if (!ats.ok) fail(`example CV fails ats: coverage ${Math.round(ats.must.ratio * 100)}%, missing ${ats.must.missing.join(", ")}`);
    console.log(`PASS: smoke rendered ${html} to ${res.pages} page(s) (max ${res.max}), fit verdict ${fit.verdict}, clean of AI tells, ats coverage ${Math.round(ats.must.ratio * 100)}%, every claim traces to the canon`);
  });

program.parseAsync(process.argv);
