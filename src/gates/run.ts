import { spawn } from "node:child_process";
export type Runner = (cmd: string, args: string[]) => Promise<string>;
export const defaultRun: Runner = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args);
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("error", (e: NodeJS.ErrnoException) => reject(e.code === "ENOENT"
    ? new Error(`'${cmd}' not found. Install poppler (e.g. 'brew install poppler' / 'apt-get install poppler-utils').`) : e));
  p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `${cmd} exited ${code}`))));
});
/** Extract the text layer of a PDF using poppler's pdftotext (stdout). */
export function extractPdfText(pdfPath: string, run: Runner = defaultRun): Promise<string> {
  return run("pdftotext", [pdfPath, "-"]);
}
