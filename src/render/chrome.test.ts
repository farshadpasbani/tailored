import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, buildChromeArgs, fetchJsonWithTimeout, fetchWithTimeout, inspectRenderedDocument, openDevtoolsSocket, renderToPdf } from "./chrome.js";
describe("buildChromeArgs", () => {
  it("keeps the sandbox on by default (local use)", () => {
    const a = buildChromeArgs("/abs/cv.html", "/out/cv.pdf");
    expect(a).not.toContain("--no-sandbox");
    expect(a).toContain("--headless=new");
    expect(a[a.length - 2]).toBe("--print-to-pdf=/out/cv.pdf");
    expect(a[a.length - 1]).toBe("file:///abs/cv.html");
  });
  it("disables the sandbox under CI (the runner cannot init it)", () => {
    const a = buildChromeArgs("/abs/cv.html", "/out/cv.pdf", { ci: true });
    expect(a).toContain("--no-sandbox");
    expect(a).toContain("--disable-dev-shm-usage");
  });
  it("appends extraArgs before the print/file flags", () => {
    const a = buildChromeArgs("/a.html", "/o.pdf", { extraArgs: ["--window-size=1200,800"] });
    expect(a).toContain("--window-size=1200,800");
    expect(a[a.length - 1]).toBe("file:///a.html");
  });
});
describe("findChrome", () => {
  it("prefers CHROME_BIN when it exists", () => {
    expect(findChrome({ env: { CHROME_BIN: "/custom/chrome" }, exists: (p) => p === "/custom/chrome" })).toBe("/custom/chrome");
  });
  it("falls back to a known macOS path", () => {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    expect(findChrome({ env: {}, platform: "darwin", exists: (p) => p === mac })).toBe(mac);
  });
  it("finds chromium on linux", () => { expect(findChrome({ env: {}, platform: "linux", exists: (p) => p === "/usr/bin/chromium" })).toBe("/usr/bin/chromium"); });
  it("finds the snap chromium shim on linux", () => { expect(findChrome({ env: {}, platform: "linux", exists: (p) => p === "/snap/bin/chromium" })).toBe("/snap/bin/chromium"); });
  it("returns null when nothing is found", () => { expect(findChrome({ env: {}, platform: "linux", exists: () => false })).toBeNull(); });
});
describe("renderToPdf artifact check", () => {
  const dir = mkdtempSync(join(tmpdir(), "tailored-render-"));
  const html = join(dir, "in.html");
  writeFileSync(html, "<!doctype html><p>hi</p>");
  const fakeChrome = (body: string) => {
    const p = join(dir, `chrome-${Math.abs(body.length)}-${body.includes("touch") ? "ok" : "noop"}.sh`);
    writeFileSync(p, `#!/bin/sh\n${body}\nexit 0\n`);
    chmodSync(p, 0o755);
    return p;
  };
  it("throws when Chrome exits 0 but writes no PDF (silent failure)", async () => {
    const bin = fakeChrome(":"); // no-op: exits 0, produces nothing
    await expect(renderToPdf(html, join(dir, "out-noop.pdf"), { env: { CHROME_BIN: bin } }))
      .rejects.toThrow(/produced no PDF/);
  });
  it("resolves when the PDF is written and non-empty", async () => {
    const out = join(dir, "out-ok.pdf");
    const bin = fakeChrome(`printf '%%PDF-1.4 stub' > "${out}" # touch`);
    await expect(renderToPdf(html, out, { env: { CHROME_BIN: bin } })).resolves.toBeUndefined();
  });
});

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
});

describe.skipIf(!findChrome())("rendered text-unit inspection", () => {
  it("enumerates headings, inline/table text, root residue, and DOM injection", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tailored-text-units-"));
    const html = join(dir, "coverage.html");
    writeFileSync(html, `<html><head><style>.generated::before { content: "generated" }</style></head><body>root text<h6>heading</h6><span class="generated">inline</span><table><caption>caption</caption><tr><th>header</th><td>cell</td></tr></table><blockquote>quote</blockquote><script>setTimeout(() => document.body.insertAdjacentText("beforeend", "injected"), 0)</script></body></html>`);
    const result = await inspectRenderedDocument(html);
    const texts = result.textUnits?.filter(unit => unit.visible).map(unit => unit.text) ?? [];
    expect(texts).toEqual(expect.arrayContaining(["root text", "heading", "inline", "caption", "header", "cell", "quote", "injected"]));
    expect(result.textUnits?.find(unit => unit.text === "injected")?.claimIds).toEqual([]);
    expect(result.generatedContent).toContainEqual(expect.objectContaining({ pseudo: "::before", text: "generated", visible: true }));
  }, 30_000);

  it("uses painted descendant text geometry for concealment", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tailored-painted-text-"));
    const html = join(dir, "concealed.html");
    writeFileSync(html, `<body>
      <p data-claim-id="indent" style="text-indent:-10000px">indented</p>
      <p data-claim-id="scaled" style="transform:scale(0.00001)">scaled</p>
      <p data-claim-id="contrast" style="color:white;background:white">white on white</p>
      <p data-claim-id="child">visible <span style="opacity:0">hidden child</span></p>
    </body>`);
    const result = await inspectRenderedDocument(html);
    for (const id of ["indent", "scaled", "contrast", "child"])
      expect(result.claims.find(claim => claim.id === id)?.visible, id).toBe(false);
  }, 30_000);
});
