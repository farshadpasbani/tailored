import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
export interface FindChromeOpts { env?: Record<string, string | undefined>; platform?: NodeJS.Platform; exists?: (p: string) => boolean; }
const CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"],
  win32: ["C:/Program Files/Google/Chrome/Application/chrome.exe"],
};
export function findChrome(opts: FindChromeOpts = {}): string | null {
  const env = opts.env ?? process.env; const exists = opts.exists ?? existsSync;
  if (env.CHROME_BIN && exists(env.CHROME_BIN)) return env.CHROME_BIN;
  for (const c of CANDIDATES[opts.platform ?? process.platform] ?? []) if (exists(c)) return c;
  return null;
}
export async function renderToPdf(htmlPath: string, pdfPath: string, opts: FindChromeOpts = {}): Promise<void> {
  const bin = findChrome(opts);
  if (!bin) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  const abs = (await import("node:path")).resolve(htmlPath);
  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`, `file://${abs}`]);
    let err = ""; p.stderr.on("data", (d) => (err += d));
    p.on("error", reject); p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err || `chrome exited ${c}`))));
  });
}
