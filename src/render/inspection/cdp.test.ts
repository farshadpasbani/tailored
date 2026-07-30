import { describe, it, expect } from "vitest";
import { fetchJsonWithTimeout, fetchWithTimeout, openDevtoolsSocket } from "./cdp.js";

// A browser that never answers must not hold a gate open. Each primitive gets a stalled
// counterpart rather than a real Chrome, so these run without a browser at all.
describe("bounded DevTools handshakes", () => {
  it("aborts a stalled target-creation request", async () => {
    const stalled = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })) as typeof fetch;
    await expect(fetchWithTimeout("http://devtools.invalid/json/new", { method: "PUT" }, stalled, 20)).rejects.toThrow(/timed out opening/);
  });

  it("closes a socket that never opens", async () => {
    let closed = false;
    const socket = { addEventListener() {}, close() { closed = true; } } as unknown as WebSocket;
    await expect(openDevtoolsSocket("ws://devtools.invalid", () => socket, 20)).rejects.toThrow(/timed out connecting/);
    expect(closed).toBe(true);
  });

  it("aborts and cancels a response whose JSON body stalls after headers", async () => {
    let cancelled = false;
    const response = { ok: true, status: 200, json: () => new Promise(() => {}), body: { cancel: async () => { cancelled = true; } } } as unknown as Response;
    const headersOnly = (async () => response) as typeof fetch;
    await expect(fetchJsonWithTimeout("http://devtools.invalid/json/new", { method: "PUT" }, headersOnly, 20)).rejects.toThrow(/timed out opening/);
    expect(cancelled).toBe(true);
  });

  it("reports a refused DevTools endpoint rather than a bare HTTP status", async () => {
    const refused = (async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response) as typeof fetch;
    await expect(fetchJsonWithTimeout("http://devtools.invalid/json/new", { method: "PUT" }, refused, 20)).rejects.toThrow(/target creation failed: HTTP 500/);
  });

  it("reports a socket that errors out instead of opening", async () => {
    const listeners = new Map<string, () => void>();
    const socket = {
      addEventListener(name: string, handler: () => void) { listeners.set(name, handler); },
      close() {},
    } as unknown as WebSocket;
    const opening = openDevtoolsSocket("ws://devtools.invalid", () => socket, 1_000);
    listeners.get("error")?.();
    await expect(opening).rejects.toThrow(/could not connect to Chrome DevTools/);
  });
});
