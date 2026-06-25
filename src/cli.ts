#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { loadCanon } from "./canon/load.js";
import { lintAiTells } from "./gates/aiTell.js";
import { assertPageFit } from "./gates/pageFit.js";
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
      const issues = lintAiTells(readFileSync(f, "utf8"));
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
    const html = "examples/alex-rivers/cv.html";
    const pdf = join(tmpdir(), `tailored-smoke-${process.pid}.pdf`);
    const tells = lintAiTells(readFileSync(html, "utf8"));
    if (tells.length > 0) fail(`${html} has ${tells.length} AI tell(s)`);
    try { await renderToPdf(html, pdf); }
    catch (e) { fail((e as Error).message); }
    let res;
    try { res = await assertPageFit(pdf, 2); }
    catch (e) { fail((e as Error).message); }
    if (!res.ok) fail(`${html} rendered to ${res.pages} page(s), over the limit of ${res.max}`);
    console.log(`PASS: smoke rendered ${html} to ${res.pages} page(s) (max ${res.max}), clean of AI tells`);
  });

program.parseAsync(process.argv);
