import { type Runner, defaultRun } from "./run.js";
export function parsePdfinfoPages(output: string): number {
  const m = output.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error("could not parse page count from pdfinfo output");
  return Number(m[1]);
}
export async function pageCount(pdfPath: string, run: Runner = defaultRun): Promise<number> { return parsePdfinfoPages(await run("pdfinfo", [pdfPath])); }
export async function assertPageFit(pdfPath: string, max: number, run: Runner = defaultRun) { const pages = await pageCount(pdfPath, run); return { ok: pages <= max, pages, max }; }
