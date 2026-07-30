import { existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { findChrome, headlessChromeArgs } from "./chrome.js";

/**
 * Owns turning an HTML file into a PDF. Finding Chrome, building its arguments, spawning it
 * and proving it actually wrote something are all implementation of `render`.
 */

export interface RenderOptions {
  /** Extra Chrome flags for this document, such as disabling JS for untrusted input. */
  extraArgs?: string[];
}

export async function render(htmlPath: string, pdfPath: string, options: RenderOptions = {}): Promise<void> {
  const binary = findChrome();
  if (!binary) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  const absolute = resolve(htmlPath);
  const args = [
    ...headlessChromeArgs(["--no-pdf-header-footer"]),
    ...(options.extraArgs ?? []),
    `--print-to-pdf=${pdfPath}`,
    `file://${absolute}`,
  ];
  let stderr = "";
  await new Promise<void>((done, reject) => {
    const chrome = spawn(binary, args);
    chrome.stderr.on("data", chunk => (stderr += chunk));
    chrome.on("error", reject);
    chrome.on("close", code => (code === 0 ? done() : reject(new Error(stderr || `chrome exited ${code}`))));
  });
  // Chrome can exit 0 yet write nothing (e.g. certain --blink-settings combinations).
  // Trust the artifact, not the exit code: a "successful" render with no output PDF is
  // a silent failure, so assert the file exists and is non-empty before claiming success.
  if (!existsSync(pdfPath) || statSync(pdfPath).size === 0) {
    throw new Error(`chrome exited 0 but produced no PDF at ${pdfPath}${stderr ? `: ${stderr}` : ""}`);
  }
}
