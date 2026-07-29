import { GateInputError, type Gate } from "./gate.js";
import { type Runner, defaultRun } from "./run.js";
export function parsePdfinfoPages(output: string): number {
  const m = output.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error("could not parse page count from pdfinfo output");
  return Number(m[1]);
}
export async function pageCount(pdfPath: string, run: Runner = defaultRun): Promise<number> { return parsePdfinfoPages(await run("pdfinfo", [pdfPath])); }
export async function assertPageFit(pdfPath: string, max: number, run: Runner = defaultRun) { const pages = await pageCount(pdfPath, run); return { ok: pages <= max, pages, max }; }

/**
 * Terminal-only. A pack receipt gets its page verdict from `page-integrity`, which the
 * staging transaction raises against each artifact's declared maximum; this command asks the
 * same question of a loose PDF.
 */
export const pageFitGate: Gate = {
  id: "page-fit",
  severity: "blocking",
  run: null,
  command: {
    name: "page-fit",
    description: "assert a PDF fits within a maximum page count",
    arguments: [{ name: "<pdf>", description: "path to the PDF" }],
    options: [{ flags: "--max <n>", description: "maximum allowed pages", default: "1" }],
    run: async (args, options) => {
      const pdf = args[0] as string;
      const max = Number(options.max);
      if (!Number.isInteger(max) || max < 1) throw new GateInputError(`--max must be a positive integer, got ${JSON.stringify(options.max)}`);
      let result;
      try { result = await assertPageFit(pdf, max); }
      catch (error) { throw new GateInputError((error as Error).message); }
      return {
        id: "page-fit", ok: result.ok, messages: [],
        summary: result.ok
          ? `${pdf} is ${result.pages} page(s), within ${result.max}`
          : `${pdf} is ${result.pages} page(s), over the limit of ${result.max}`,
      };
    },
  },
};
