import { existsSync } from "node:fs";

/**
 * Owns the facts about Chrome itself, shared by both modules that drive it: where the binary
 * is on this machine, and the flags every headless invocation uses.
 */

export interface ChromeProbe {
  env: Record<string, string | undefined>;
  platform: NodeJS.Platform;
  exists: (path: string) => boolean;
}

const CANDIDATES: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"],
  win32: ["C:/Program Files/Google/Chrome/Application/chrome.exe"],
};

/** Pure discovery over a described machine: CHROME_BIN wins, then the known install paths. */
export function locateChrome(probe: ChromeProbe): string | null {
  if (probe.env.CHROME_BIN && probe.exists(probe.env.CHROME_BIN)) return probe.env.CHROME_BIN;
  for (const candidate of CANDIDATES[probe.platform] ?? []) if (probe.exists(candidate)) return candidate;
  return null;
}

/** The Chrome this machine offers, or null. Callers that need one report their own failure. */
export function findChrome(): string | null {
  return locateChrome({ env: process.env, platform: process.platform, exists: existsSync });
}

/** Same page geometry for printing and for inspection, so both see one layout. */
const DOCUMENT_RENDER_ARGS = ["--window-size=1240,1754", "--run-all-compositor-stages-before-draw"];

/**
 * The flags shared by every headless run, wrapped around the ones a caller needs for its own
 * purpose.
 *
 * CI runners and containers cannot initialise Chrome's setuid sandbox; it aborts in
 * ZygoteHostImpl::Init(). We disable the sandbox ONLY there, keeping it on for normal local
 * use where the input is trusted local HTML anyway.
 */
export function headlessChromeArgs(purposeArgs: string[] = []): string[] {
  const args = ["--headless=new", "--disable-gpu", ...purposeArgs, ...DOCUMENT_RENDER_ARGS];
  if (process.env.CI) args.push("--no-sandbox", "--disable-dev-shm-usage");
  return args;
}
