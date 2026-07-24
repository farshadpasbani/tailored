import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

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
const DOCUMENT_RENDER_ARGS = ["--window-size=1240,1754", "--run-all-compositor-stages-before-draw"];
// CI runners and containers cannot initialise Chrome's setuid sandbox; it aborts in
// ZygoteHostImpl::Init(). We disable the sandbox ONLY there, keeping it on for normal
// local use where the input is trusted local HTML anyway.
export function buildChromeArgs(absHtmlPath: string, pdfPath: string, opts: ChromeArgsOpts = {}): string[] {
  const args = ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", ...DOCUMENT_RENDER_ARGS];
  if (opts.ci) args.push("--no-sandbox", "--disable-dev-shm-usage");
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);
  args.push(`--print-to-pdf=${pdfPath}`, `file://${absHtmlPath}`);
  return args;
}

export interface RenderOpts extends FindChromeOpts, ChromeArgsOpts {
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => WebSocket;
  handshakeTimeoutMs?: number;
}
export async function renderToPdf(htmlPath: string, pdfPath: string, opts: RenderOpts = {}): Promise<void> {
  const bin = findChrome(opts);
  if (!bin) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  const abs = resolvePath(htmlPath);
  const ci = opts.ci ?? Boolean((opts.env ?? process.env).CI);
  const args = buildChromeArgs(abs, pdfPath, { ci, extraArgs: opts.extraArgs });
  let err = "";
  await new Promise<void>((done, reject) => {
    const p = spawn(bin, args);
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject); p.on("close", (c) => (c === 0 ? done() : reject(new Error(err || `chrome exited ${c}`))));
  });
  // Chrome can exit 0 yet write nothing (e.g. certain --blink-settings combinations).
  // Trust the artifact, not the exit code: a "successful" render with no output PDF is
  // a silent failure, so assert the file exists and is non-empty before claiming success.
  if (!existsSync(pdfPath) || statSync(pdfPath).size === 0) {
    throw new Error(`chrome exited 0 but produced no PDF at ${pdfPath}${err ? `: ${err}` : ""}`);
  }
}

export interface RenderedSourceMarker {
  path: string;
  tag: string;
  classes: string[];
  text: string;
  visible: boolean;
  textBefore: string;
  offset: number;
  entryPath?: string;
  entryVisible?: boolean;
  entryCount?: number;
  metaGroup?: string;
  metaText?: string;
  contextGroup?: string;
}

export interface RenderedOwnerMarker {
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
  parentGroup?: string;
  contextClasses?: string[];
  contextGroup?: string;
}

export interface RenderedClaimMarker {
  id: string;
  subject: string;
  authority: string;
  text: string;
  visible: boolean;
}

export interface RenderedTextUnit {
  path: string;
  tag: string;
  text: string;
  visible: boolean;
  claimIds: string[];
  structuralReasons: string[];
}

export interface RenderedGeneratedContent {
  path: string;
  pseudo: "::before" | "::after";
  text: string;
  visible: boolean;
}

export interface RenderedDocumentEvidence {
  text: string;
  /** Text extracted from the actual print-to-PDF artifact. */
  printText?: string;
  markers: RenderedSourceMarker[];
  owners: RenderedOwnerMarker[];
  claims: RenderedClaimMarker[];
  textUnits: RenderedTextUnit[];
  generatedContent: RenderedGeneratedContent[];
}

const INSPECTION_SOURCE = String.raw`
window.addEventListener("load", () => {
  document.fonts.ready.then(() => setTimeout(() => {
  const normalized = value => value.replace(/\s+/g, " ").trim();
  const rgba = value => {
    if (!value || value === "transparent") return [0, 0, 0, 0];
    const numbers = value.match(/[\d.]+%?/g) ?? [];
    if (numbers.length < 3) return null;
    const channel = raw => raw.endsWith("%") ? parseFloat(raw) * 2.55 : parseFloat(raw);
    const alpha = numbers[3] === undefined ? 1 : numbers[3].endsWith("%") ? parseFloat(numbers[3]) / 100 : parseFloat(numbers[3]);
    return [channel(numbers[0]), channel(numbers[1]), channel(numbers[2]), alpha];
  };
  const luminance = color => {
    const linear = value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    return .2126 * linear(color[0]) + .7152 * linear(color[1]) + .0722 * linear(color[2]);
  };
  const contrast = (left, right) => { const a = luminance(left), b = luminance(right); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
  const intersects = (rect, bounds) => rect.width > 0 && rect.height > 0
    && rect.right > bounds.left && rect.bottom > bounds.top
    && rect.left < bounds.right && rect.top < bounds.bottom;
  const textNodes = element => {
    const nodes = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (normalized(walker.currentNode.textContent ?? "")) nodes.push(walker.currentNode);
    return nodes;
  };
  const clippedBounds = element => {
    const root = document.documentElement;
    let bounds = { left: 0, top: 0, right: root.clientWidth, bottom: Math.max(root.clientHeight, root.scrollHeight) };
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse"
          || Number(style.opacity) < .01 || node.hasAttribute("hidden")) return null;
      if (!(parseFloat(style.fontSize) >= .5)) return null;
      if ((style.clip && style.clip !== "auto") || (style.clipPath && style.clipPath !== "none")) return null;
      const rect = node.getBoundingClientRect();
      const clipsX = !["visible", "unset"].includes(style.overflowX);
      const clipsY = !["visible", "unset"].includes(style.overflowY);
      if (clipsX) { bounds.left = Math.max(bounds.left, rect.left); bounds.right = Math.min(bounds.right, rect.right); }
      if (clipsY) { bounds.top = Math.max(bounds.top, rect.top); bounds.bottom = Math.min(bounds.bottom, rect.bottom); }
      if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) return null;
    }
    return bounds;
  };
  const paintedText = node => {
    const element = node.parentElement;
    if (!element || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const bounds = clippedBounds(element);
    if (!bounds) return false;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(rect => rect.width >= .2 && rect.height >= .2 && intersects(rect, bounds));
    if (!rects.length) return false;
    const style = getComputedStyle(element);
    const fill = style.webkitTextFillColor || style.color;
    const foreground = rgba(fill);
    if (!foreground || foreground[3] < .01) return false;
    let background = [255, 255, 255, 1];
    for (let current = element; current; current = current.parentElement) {
      const candidate = rgba(getComputedStyle(current).backgroundColor);
      if (candidate && candidate[3] >= .99) { background = candidate; break; }
    }
    return contrast(foreground, background) >= 1.1;
  };
  const visible = element => {
    const nodes = textNodes(element);
    if (nodes.length) return nodes.every(paintedText);
    const bounds = clippedBounds(element);
    return Boolean(bounds && [...element.getClientRects()].some(rect => rect.width >= .2 && rect.height >= .2 && intersects(rect, bounds)));
  };
  const allText = normalized(document.body.innerText);
  const marked = [...document.querySelectorAll("[data-canon-source]")];
  const markers = marked.map((element, index) => {
    const entry = element.closest("[data-canon-entry]");
    const meta = element.closest(".meta");
    const context = element.closest(".eh, .two");
    const sentinel = "TAILOREDSOURCE" + String.fromCharCode(65 + index) + "MARKER";
    const node = document.createTextNode(sentinel);
    element.before(node);
    const renderedWithSentinel = normalized(document.body.innerText);
    const sentinelIndex = renderedWithSentinel.indexOf(sentinel);
    node.remove();
    const before = sentinelIndex < 0 ? "" : renderedWithSentinel.slice(0, sentinelIndex);
    return {
      path: element.dataset.canonSource,
      tag: element.tagName.toLowerCase(),
      classes: [...element.classList],
      text: normalized(element.innerText),
      visible: visible(element),
      textBefore: before,
      offset: before.length,
      entryPath: entry?.dataset.canonEntry,
      entryVisible: entry ? visible(entry) : undefined,
      entryCount: entry ? [...document.querySelectorAll("[data-canon-entry]")].filter(candidate => candidate.dataset.canonEntry === entry.dataset.canonEntry).length : undefined,
      metaGroup: meta ? String([...document.querySelectorAll(".meta")].indexOf(meta)) : undefined,
      metaText: meta ? normalized(meta.innerText) : undefined,
      contextGroup: context ? String([...document.querySelectorAll("*")].indexOf(context)) : undefined,
    };
  });
  const owners = [...document.querySelectorAll("[data-canon-owner]")].map(element => {
    const entry = element.closest("[data-canon-entry]");
    const parent = element.parentElement;
    const context = parent?.closest(".eh, .two");
    return {
      path: element.dataset.canonOwner,
      tag: element.tagName.toLowerCase(),
      classes: [...element.classList],
      text: normalized(element.innerText),
      visible: visible(element),
      entryPath: entry?.dataset.canonEntry,
      entryVisible: entry ? visible(entry) : undefined,
      entryCount: entry ? [...document.querySelectorAll("[data-canon-entry]")].filter(candidate => candidate.dataset.canonEntry === entry.dataset.canonEntry).length : undefined,
      parentTag: parent?.tagName.toLowerCase(),
      parentClasses: parent ? [...parent.classList] : undefined,
      parentGroup: parent ? String([...document.querySelectorAll("*")].indexOf(parent)) : undefined,
      contextClasses: context ? [...context.classList] : undefined,
      contextGroup: context ? String([...document.querySelectorAll("*")].indexOf(context)) : undefined,
    };
  });
  const claims = [...document.querySelectorAll("[data-claim-id]")].map(element => ({
    id: element.dataset.claimId ?? "",
    subject: element.dataset.claimSubject ?? "",
    authority: element.dataset.claimAuthority ?? "",
    text: normalized(element.innerText),
    visible: visible(element),
  }));
  const nodePath = node => {
    const parts = [];
    for (let element = node.parentElement; element; element = element.parentElement) {
      const siblings = element.parentElement ? [...element.parentElement.children].filter(candidate => candidate.tagName === element.tagName) : [];
      parts.unshift(element.tagName.toLowerCase() + (siblings.length > 1 ? ":nth-of-type(" + (siblings.indexOf(element) + 1) + ")" : ""));
    }
    return parts.join(" > ");
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textUnits = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = normalized(node.textContent ?? "");
    const parent = node.parentElement;
    if (!text || !parent || ["script", "style", "template", "noscript"].includes(parent.tagName.toLowerCase())) continue;
    const claimsForNode = [...parent.closest("body").querySelectorAll("[data-claim-id]")]
      .filter(element => element.contains(node)).map(element => element.dataset.claimId ?? "");
    const structuresForNode = [...parent.closest("body").querySelectorAll("[data-nonfactual-reason]")]
      .filter(element => element.contains(node)).map(element => element.dataset.nonfactualReason ?? "");
    textUnits.push({ path: nodePath(node), tag: parent.tagName.toLowerCase(), text, visible: paintedText(node), claimIds: claimsForNode, structuralReasons: structuresForNode });
  }
  const generatedContent = [];
  for (const element of document.body.querySelectorAll("*")) {
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      const raw = style.content;
      if (!raw || raw === "none" || raw === "normal" || style.display === "none") continue;
      const text = normalized(raw.replace(/^(["'])(.*)\1$/, "$2"));
      if (text) generatedContent.push({ path: nodePath({ parentElement: element }), pseudo, text, visible: visible(element) });
    }
  }
  const evidence = { text: allText, markers, owners, claims, textUnits, generatedContent };
  if (window.__TAILORED_CDP__) { window.__TAILORED_EVIDENCE__ = evidence; return; }
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(evidence))));
  document.documentElement.innerHTML = "<body><pre id=tailored-inspection>" + payload + "</pre></body>";
  }, 0));
}, { once: true });
`;
const INSPECTION_SCRIPT = `<script>${INSPECTION_SOURCE}</script>`;

/**
 * Ask Chrome for the computed, rendered DOM facts needed by canon marker validation.
 * Static HTML parsing cannot prove that CSS has not hidden a marker or its owner entry.
 */
export async function inspectRenderedDocument(htmlPath: string, opts: RenderOpts = {}): Promise<RenderedDocumentEvidence> {
  const bin = findChrome(opts);
  if (!bin) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  const abs = resolvePath(htmlPath);
  const temporary = mkdtempSync(join(tmpdir(), "tailored-inspect-"));
  const instrumented = join(temporary, "document.html");
  const base = `<base href="${pathToFileURL(`${dirname(abs)}/`).href}">`;
  const original = readFileSync(abs, "utf8");
  const source = original
    .replace(/<head(\s[^>]*)?>/i, match => `${match}${base}`)
    .replace(/<\/body>/i, `${INSPECTION_SCRIPT}</body>`);
  writeFileSync(instrumented, source.includes(INSPECTION_SCRIPT)
    ? source
    : /<body\b/i.test(source) ? `${source}${INSPECTION_SCRIPT}` : `<html><head>${base}</head><body>${source}${INSPECTION_SCRIPT}</body></html>`);
  const ci = opts.ci ?? Boolean((opts.env ?? process.env).CI);
  const args = ["--headless=new", "--disable-gpu", "--dump-dom", "--virtual-time-budget=1000", ...DOCUMENT_RENDER_ARGS];
  if (ci) args.push("--no-sandbox", "--disable-dev-shm-usage");
  args.push(`file://${instrumented}`);
  let stdout = "", stderr = "";
  try {
    await new Promise<void>((done, reject) => {
      const process = spawn(bin, args);
      process.stdout.on("data", chunk => (stdout += chunk));
      process.stderr.on("data", chunk => (stderr += chunk));
      process.on("error", reject);
      process.on("close", code => code === 0 ? done() : reject(new Error(stderr || `chrome exited ${code}`)));
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const encoded = stdout.match(/<pre id="?tailored-inspection"?>([^<]+)<\/pre>/i)?.[1];
  if (!encoded) throw new Error(`Chrome could not establish rendered canon-marker visibility${stderr ? `: ${stderr}` : ""}`);
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as RenderedDocumentEvidence;
  } catch (error) {
    throw new Error(`Chrome returned invalid rendered canon-marker evidence: ${(error as Error).message}`);
  }
}

interface CdpResponse { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string }; }

class CdpPage {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private events = new Map<string, Array<(value: any) => void>>();
  private constructor(private socket: WebSocket) {
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(`CDP: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }
      if (message.method) for (const resolve of this.events.get(message.method) ?? []) resolve(message.params);
      if (message.method) this.events.delete(message.method);
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error("Chrome DevTools page closed")); }
      this.pending.clear();
    });
  }
  static async connect(url: string, factory: (url: string) => WebSocket = value => new WebSocket(value), timeoutMs = 10_000): Promise<CdpPage> {
    const socket = await openDevtoolsSocket(url, factory, timeoutMs);
    return new CdpPage(socket);
  }
  send<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`timed out waiting for CDP ${method}`)); }, 15_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  waitFor<T = any>(method: string, timeoutMs = 10_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for CDP ${method}`)), timeoutMs);
      const listeners = this.events.get(method) ?? [];
      listeners.push(value => { clearTimeout(timer); resolve(value); });
      this.events.set(method, listeners);
    });
  }
  close(): void { this.socket.close(); }
}

export async function fetchWithTimeout(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timed out opening Chrome DevTools HTTP endpoint`)), timeoutMs);
  try { return await fetchImpl(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  let response: Response | undefined;
  let rejectTimeout!: (error: Error) => void;
  const timeout = new Promise<never>((_resolve, reject) => { rejectTimeout = reject; });
  const timer = setTimeout(() => {
    const error = new Error("timed out opening Chrome DevTools HTTP endpoint");
    controller.abort(error); rejectTimeout(error);
  }, timeoutMs);
  try {
    return await Promise.race([
      (async () => {
        response = await fetchImpl(url, { ...init, signal: controller.signal });
        if (!response.ok) throw new Error(`Chrome DevTools target creation failed: HTTP ${response.status}`);
        return await response.json() as T;
      })(),
      timeout,
    ]);
  } catch (error) {
    if (controller.signal.aborted) await response?.body?.cancel().catch(() => undefined);
    throw error;
  } finally { clearTimeout(timer); }
}

export async function openDevtoolsSocket(url: string, factory: (url: string) => WebSocket = value => new WebSocket(value), timeoutMs = 10_000): Promise<WebSocket> {
  const socket = factory(url);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out connecting to Chrome DevTools WebSocket")), timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("could not connect to Chrome DevTools")); }, { once: true });
    });
    return socket;
  } catch (error) { socket.close(); throw error; }
}

/** Inspect the print DOM and print that exact loaded revision through one CDP page. */
export async function inspectAndPrintDocument(htmlPath: string, pdfPath: string, opts: RenderOpts = {}): Promise<RenderedDocumentEvidence> {
  const bin = findChrome(opts);
  if (!bin) throw new Error("No Chrome/Chromium found. Set CHROME_BIN or install Google Chrome.");
  const profile = mkdtempSync(join(tmpdir(), "tailored-cdp-"));
  const ci = opts.ci ?? Boolean((opts.env ?? process.env).CI);
  const args = ["--headless=new", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, ...DOCUMENT_RENDER_ARGS];
  if (ci) args.push("--no-sandbox", "--disable-dev-shm-usage");
  args.push("about:blank");
  const chrome = spawn(bin, args);
  let stderr = "";
  let page: CdpPage | undefined;
  let targetId: string | undefined, devtoolsHost: string | undefined;
  try {
    const browserSocket = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Chrome DevTools did not start${stderr ? `: ${stderr}` : ""}`)), 10_000);
      chrome.stderr.on("data", chunk => {
        stderr += chunk;
        const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      chrome.on("error", error => { clearTimeout(timer); reject(error); });
      chrome.on("close", code => { if (code !== null && code !== 0) { clearTimeout(timer); reject(new Error(stderr || `chrome exited ${code}`)); } });
    });
    const endpoint = new URL(browserSocket);
    devtoolsHost = endpoint.host;
    const handshakeTimeoutMs = opts.handshakeTimeoutMs ?? 10_000;
    const targetInfo = await fetchJsonWithTimeout<{ id?: string; webSocketDebuggerUrl?: string }>(`http://${endpoint.host}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }, opts.fetchImpl, handshakeTimeoutMs);
    targetId = targetInfo.id;
    if (!targetInfo.webSocketDebuggerUrl) throw new Error("Chrome DevTools target has no page socket");
    page = await CdpPage.connect(targetInfo.webSocketDebuggerUrl, opts.webSocketFactory, handshakeTimeoutMs);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setEmulatedMedia", { media: "print" });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__TAILORED_CDP__ = true;\n${INSPECTION_SOURCE}` });
    const loaded = page.waitFor("Page.loadEventFired");
    await page.send("Page.navigate", { url: pathToFileURL(resolvePath(htmlPath)).href });
    await loaded;
    const evaluated = await page.send<{ result?: { value?: RenderedDocumentEvidence }; exceptionDetails?: unknown }>("Runtime.evaluate", {
      expression: `new Promise((resolve, reject) => { const started = Date.now(); const check = () => { if (window.__TAILORED_EVIDENCE__) resolve(window.__TAILORED_EVIDENCE__); else if (Date.now() - started > 10000) reject(new Error("inspection readiness timeout")); else setTimeout(check, 10); }; check(); })`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluated.exceptionDetails || !evaluated.result?.value) throw new Error("Chrome could not establish print-DOM claim evidence");
    const printed = await page.send<{ data?: string }>("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, transferMode: "ReturnAsBase64" });
    if (!printed.data) throw new Error("Chrome Page.printToPDF returned no PDF bytes");
    writeFileSync(pdfPath, Buffer.from(printed.data, "base64"));
    if (!statSync(pdfPath).size) throw new Error(`Chrome produced an empty PDF at ${pdfPath}`);
    return evaluated.result.value;
  } finally {
    page?.close();
    if (targetId && devtoolsHost) await fetchWithTimeout(`http://${devtoolsHost}/json/close/${encodeURIComponent(targetId)}`, { method: "PUT" }, opts.fetchImpl, Math.min(opts.handshakeTimeoutMs ?? 10_000, 1_000)).catch(() => undefined);
    if (chrome.exitCode === null) await new Promise<void>(resolve => {
      const timer = setTimeout(() => { chrome.kill("SIGKILL"); resolve(); }, 2_000);
      chrome.once("close", () => { clearTimeout(timer); resolve(); });
      chrome.kill("SIGTERM");
    });
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}
