import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { headlessChromeArgs } from "../chrome.js";

/**
 * Owns the only transport to a browser: one Chrome DevTools Protocol page, from launching
 * the browser to tearing it down. Every wait is bounded, because a hung handshake would
 * otherwise stall a gate forever.
 */

/** How long any single DevTools handshake or request may take before it is abandoned. */
const DEVTOOLS_TIMEOUT_MS = 10_000;
/** How long a CDP command may take. Printing a long document is slower than a handshake. */
const COMMAND_TIMEOUT_MS = 15_000;

interface CdpResponse { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string }; }

/**
 * What a caller inside `withCdpPage` may do with the page. Closing it is deliberately absent:
 * the lifecycle belongs to `withCdpPage`, which must be able to tear down what it opened.
 */
interface CdpCommands {
  send<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  waitFor<T = any>(method: string, timeoutMs?: number): Promise<T>;
}

/** A live page: send commands, await one event, and nothing else. */
class CdpPage implements CdpCommands {
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
  static async connect(url: string): Promise<CdpPage> {
    return new CdpPage(await openDevtoolsSocket(url));
  }
  send<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`timed out waiting for CDP ${method}`)); }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  waitFor<T = any>(method: string, timeoutMs = DEVTOOLS_TIMEOUT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for CDP ${method}`)), timeoutMs);
      const listeners = this.events.get(method) ?? [];
      listeners.push(value => { clearTimeout(timer); resolve(value); });
      this.events.set(method, listeners);
    });
  }
  close(): void { this.socket.close(); }
}

export async function fetchWithTimeout(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch, timeoutMs = DEVTOOLS_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timed out opening Chrome DevTools HTTP endpoint`)), timeoutMs);
  try { return await fetchImpl(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch, timeoutMs = DEVTOOLS_TIMEOUT_MS): Promise<T> {
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

export async function openDevtoolsSocket(url: string, factory: (url: string) => WebSocket = value => new WebSocket(value), timeoutMs = DEVTOOLS_TIMEOUT_MS): Promise<WebSocket> {
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

/**
 * Launch Chrome, open one page over the DevTools protocol, and hand it to `use`. The browser,
 * its throwaway profile and the page are all closed before this returns, whether `use`
 * returned or threw.
 */
export async function withCdpPage<T>(binary: string, use: (page: CdpCommands) => Promise<T>): Promise<T> {
  const profile = mkdtempSync(join(tmpdir(), "tailored-cdp-"));
  const chrome = spawn(binary, [...headlessChromeArgs(["--remote-debugging-port=0", `--user-data-dir=${profile}`]), "about:blank"]);
  let stderr = "";
  let page: CdpPage | undefined;
  let targetId: string | undefined, devtoolsHost: string | undefined;
  try {
    const browserSocket = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Chrome DevTools did not start${stderr ? `: ${stderr}` : ""}`)), DEVTOOLS_TIMEOUT_MS);
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
    const targetInfo = await fetchJsonWithTimeout<{ id?: string; webSocketDebuggerUrl?: string }>(`http://${endpoint.host}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    targetId = targetInfo.id;
    if (!targetInfo.webSocketDebuggerUrl) throw new Error("Chrome DevTools target has no page socket");
    page = await CdpPage.connect(targetInfo.webSocketDebuggerUrl);
    return await use(page);
  } finally {
    page?.close();
    if (targetId && devtoolsHost) await fetchWithTimeout(`http://${devtoolsHost}/json/close/${encodeURIComponent(targetId)}`, { method: "PUT" }, fetch, 1_000).catch(() => undefined);
    if (chrome.exitCode === null) await new Promise<void>(resolve => {
      const timer = setTimeout(() => { chrome.kill("SIGKILL"); resolve(); }, 2_000);
      chrome.once("close", () => { clearTimeout(timer); resolve(); });
      chrome.kill("SIGTERM");
    });
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}
