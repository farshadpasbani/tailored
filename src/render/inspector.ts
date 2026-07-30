import { statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findChrome } from "./chrome.js";
import { withCdpPage } from "./inspection/cdp.js";
import { buildInspectionSource } from "./inspection/source.js";

/**
 * Owns the answer to "what did the browser actually paint?": it loads a document in Chrome
 * and reports the evidence the gates reason about. Static HTML parsing cannot prove that CSS
 * has not concealed a claim, so this is the only witness the authoritative verifier accepts.
 *
 * Media is print, not screen. What the reader receives is the printed page, so a field the
 * print stylesheet hides is hidden however well the screen shows it.
 */

/**
 * A debug locator: enough for a human reading a gate message to find the field in the
 * document. Its shape is Chrome's business and may change - it is never parsed, matched or
 * branched on, and nothing about a document may be inferred from it.
 */
export type DebugLocator = string;

/** A field bound to a canon path by `data-canon-source`, and where it landed in the text. */
export interface SourceMarker {
  /** The canon path this field renders, such as `experience[0].start`. */
  path: string;
  tag: string;
  classes: string[];
  text: string;
  visible: boolean;
  /** The rendered text that precedes this field, and its length - how far into the document it reads. */
  textBefore: string;
  offset: number;
  /** The canon entry this field sits inside, whether that entry is painted, and how many entries claim the same path. */
  entryPath?: string;
  entryVisible?: boolean;
  entryCount?: number;
  /** Opaque group tokens: compare two for equality to ask "same header, same meta line". Never parse one. */
  metaGroup?: string;
  metaText?: string;
  contextGroup?: string;
}

/** A field bound to a canon path by `data-canon-owner`: the title or org that names an entry. */
export interface OwnerMarker {
  path: string;
  tag: string;
  classes: string[];
  text: string;
  visible: boolean;
  entryPath?: string;
  entryVisible?: boolean;
  entryCount?: number;
  parentTag?: string;
  parentClasses?: string[];
  /** Opaque group tokens; see SourceMarker. */
  parentGroup?: string;
  contextClasses?: string[];
  contextGroup?: string;
}

/** A claim the document declares, as the browser rendered it. */
export interface ClaimMarker {
  id: string;
  subject: string;
  authority: string;
  text: string;
  visible: boolean;
}

/** One run of text the document paints, and who owns it. */
export interface TextUnit {
  locator: DebugLocator;
  tag: string;
  text: string;
  visible: boolean;
  claimIds: string[];
  structuralReasons: string[];
}

/** Text no author wrote: content a stylesheet generated through ::before or ::after. */
export interface GeneratedContent {
  locator: DebugLocator;
  text: string;
  visible: boolean;
}

/** Everything one loaded document tells us. */
export interface DocumentEvidence {
  text: string;
  /** Text extracted from the actual print-to-PDF artifact. Filled in by the verifier, not by Chrome. */
  printText?: string;
  markers: SourceMarker[];
  owners: OwnerMarker[];
  claims: ClaimMarker[];
  textUnits: TextUnit[];
  generatedContent: GeneratedContent[];
}

/**
 * The injected script publishes its evidence asynchronously, after fonts settle and one turn
 * of the event loop. Poll for it rather than guess a delay.
 */
const AWAIT_EVIDENCE = `new Promise((resolve, reject) => {
  const started = Date.now();
  const check = () => {
    if (window.__TAILORED_EVIDENCE__) resolve(window.__TAILORED_EVIDENCE__);
    else if (Date.now() - started > 10000) reject(new Error("inspection readiness timeout"));
    else setTimeout(check, 10);
  };
  check();
})`;

async function inspectDocument(htmlPath: string, pdfPath?: string): Promise<DocumentEvidence> {
  const binary = findChrome();
  if (!binary) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  return withCdpPage(binary, async page => {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setEmulatedMedia", { media: "print" });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: buildInspectionSource() });
    const loaded = page.waitFor("Page.loadEventFired");
    await page.send("Page.navigate", { url: pathToFileURL(resolve(htmlPath)).href });
    await loaded;
    const evaluated = await page.send<{ result?: { value?: DocumentEvidence }; exceptionDetails?: unknown }>("Runtime.evaluate", {
      expression: AWAIT_EVIDENCE,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluated.exceptionDetails || !evaluated.result?.value) throw new Error("Chrome could not establish rendered document evidence");
    if (pdfPath !== undefined) {
      const printed = await page.send<{ data?: string }>("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, transferMode: "ReturnAsBase64" });
      if (!printed.data) throw new Error("Chrome Page.printToPDF returned no PDF bytes");
      writeFileSync(pdfPath, Buffer.from(printed.data, "base64"));
      if (!statSync(pdfPath).size) throw new Error(`Chrome produced an empty PDF at ${pdfPath}`);
    }
    return evaluated.result.value;
  });
}

/** What the browser paints for this document. */
export async function inspect(htmlPath: string): Promise<DocumentEvidence> {
  return inspectDocument(htmlPath);
}

/**
 * The same evidence, plus the PDF of that exact loaded revision. One page prints what it
 * reported, so the verifier's evidence and the artifact a human receives cannot diverge.
 */
export async function inspectAndPrint(htmlPath: string, pdfPath: string): Promise<DocumentEvidence> {
  return inspectDocument(htmlPath, pdfPath);
}
