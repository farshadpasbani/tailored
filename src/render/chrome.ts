import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve as resolvePath } from "node:path";

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

export interface ChromeArgsOpts { ci?: boolean; extraArgs?: string[]; }
// CI runners and containers cannot initialise Chrome's setuid sandbox; it aborts in
// ZygoteHostImpl::Init(). We disable the sandbox ONLY there, keeping it on for normal
// local use where the input is trusted local HTML anyway.
export function buildChromeArgs(absHtmlPath: string, pdfPath: string, opts: ChromeArgsOpts = {}): string[] {
  const args = ["--headless=new", "--disable-gpu", "--no-pdf-header-footer"];
  if (opts.ci) args.push("--no-sandbox", "--disable-dev-shm-usage");
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);
  args.push(`--print-to-pdf=${pdfPath}`, `file://${absHtmlPath}`);
  return args;
}

export interface RenderOpts extends FindChromeOpts, ChromeArgsOpts {}
export async function renderToPdf(htmlPath: string, pdfPath: string, opts: RenderOpts = {}): Promise<void> {
  const bin = findChrome(opts);
  if (!bin) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  const abs = resolvePath(htmlPath);
  const ci = opts.ci ?? Boolean((opts.env ?? process.env).CI);
  const args = buildChromeArgs(abs, pdfPath, { ci, extraArgs: opts.extraArgs });
  await new Promise<void>((done, reject) => {
    const p = spawn(bin, args);
    let err = ""; p.stderr.on("data", (d) => (err += d));
    p.on("error", reject); p.on("close", (c) => (c === 0 ? done() : reject(new Error(err || `chrome exited ${c}`))));
  });
}
