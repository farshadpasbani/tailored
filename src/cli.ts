#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
import { scanProtected } from "./gates/ipGuard.js";
import { renderToPdf } from "./render/chrome.js";
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
  .command("smoke")
  .description("render the alex-rivers example and run the page-fit and ai-tell gates")
  .action(async () => {
    // Resolve the bundled example relative to this file (dist/cli.js -> ../examples/...)
    // so `tailored smoke` works from any working directory, including a global install.
    const html = fileURLToPath(new URL("../examples/alex-rivers/cv.html", import.meta.url));
    const pdf = join(tmpdir(), `tailored-smoke-${process.pid}.pdf`);
    const tells = lintAiTells(readFileSync(html, "utf8"));
    if (tells.length > 0) fail(`${html} has ${tells.length} AI tell(s)`);
    try { await renderToPdf(html, pdf); }
    catch (e) { fail((e as Error).message); }
    let res;
    // The Alex Rivers CV is one page by design; the smoke gate enforces that.
    try { res = await assertPageFit(pdf, 1); }
    catch (e) { fail((e as Error).message); }
    if (!res.ok) fail(`${html} rendered to ${res.pages} page(s), over the limit of ${res.max}`);
    console.log(`PASS: smoke rendered ${html} to ${res.pages} page(s) (max ${res.max}), clean of AI tells`);
  });

program.parseAsync(process.argv);
