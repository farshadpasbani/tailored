import { spawn } from "node:child_process";
export function parsePdfinfoPages(output: string): number {
  const m = output.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error("could not parse page count from pdfinfo output");
  return Number(m[1]);
}
export type Runner = (cmd: string, args: string[]) => Promise<string>;
const defaultRun: Runner = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args);
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("error", (e: NodeJS.ErrnoException) => reject(e.code === "ENOENT"
    ? new Error(`'${cmd}' not found. Install poppler (e.g. 'brew install poppler' / 'apt-get install poppler-utils').`) : e));
  p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `${cmd} exited ${code}`))));
});
export async function pageCount(pdfPath: string, run: Runner = defaultRun): Promise<number> { return parsePdfinfoPages(await run("pdfinfo", [pdfPath])); }
export async function assertPageFit(pdfPath: string, max: number, run: Runner = defaultRun) { const pages = await pageCount(pdfPath, run); return { ok: pages <= max, pages, max }; }
