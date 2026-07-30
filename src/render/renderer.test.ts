import { describe, it, expect, vi, afterEach } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "./renderer.js";

// A stand-in for Chrome that records the command line it was given. The argument policy is
// implementation, so it is checked where it lands - on the process - not through an exported
// builder.
const dir = mkdtempSync(join(tmpdir(), "tailored-render-"));
const html = join(dir, "in.html");
writeFileSync(html, "<!doctype html><p>hi</p>");
let scripts = 0;
const fakeChrome = (body: string): { bin: string; argv: () => string[] } => {
  const argvPath = join(dir, `argv-${scripts}.txt`);
  const bin = join(dir, `chrome-${scripts++}.sh`);
  writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argvPath}"\n${body}\nexit 0\n`);
  chmodSync(bin, 0o755);
  return { bin, argv: () => readFileSync(argvPath, "utf8").split("\n").filter(Boolean) };
};

describe("render", () => {
  // Restored even when an assertion throws: a leaked CHROME_BIN would point every later
  // test in the file at the previous case's fake Chrome.
  afterEach(() => vi.unstubAllEnvs());

  it("throws when Chrome exits 0 but writes no PDF (a silent failure)", async () => {
    const chrome = fakeChrome(":");
    vi.stubEnv("CHROME_BIN", chrome.bin);
    await expect(render(html, join(dir, "out-noop.pdf"))).rejects.toThrow(/produced no PDF/);
  });

  it("throws when Chrome writes an empty PDF", async () => {
    const out = join(dir, "out-empty.pdf");
    const chrome = fakeChrome(`: > "${out}"`);
    vi.stubEnv("CHROME_BIN", chrome.bin);
    await expect(render(html, out)).rejects.toThrow(/produced no PDF/);
  });

  it("resolves when the PDF is written and non-empty", async () => {
    const out = join(dir, "out-ok.pdf");
    const chrome = fakeChrome(`printf '%%PDF-1.4 stub' > "${out}"`);
    vi.stubEnv("CHROME_BIN", chrome.bin);
    await expect(render(html, out)).resolves.toBeUndefined();
  });

  it("asks Chrome to print this document to that path, headless and without a header", async () => {
    const out = join(dir, "out-argv.pdf");
    const chrome = fakeChrome(`printf '%%PDF-1.4 stub' > "${out}"`);
    vi.stubEnv("CHROME_BIN", chrome.bin);
    await render(html, out);
    const argv = chrome.argv();
    expect(argv).toContain("--headless=new");
    expect(argv).toContain("--no-pdf-header-footer");
    expect(argv[argv.length - 2]).toBe(`--print-to-pdf=${out}`);
    expect(argv[argv.length - 1]).toBe(`file://${html}`);
  });

  it("passes a caller's own flags through before the print flags", async () => {
    const out = join(dir, "out-extra.pdf");
    const chrome = fakeChrome(`printf '%%PDF-1.4 stub' > "${out}"`);
    vi.stubEnv("CHROME_BIN", chrome.bin);
    await render(html, out, { extraArgs: ["--disable-javascript"] });
    const argv = chrome.argv();
    expect(argv).toContain("--disable-javascript");
    expect(argv.indexOf("--disable-javascript")).toBeLessThan(argv.indexOf(`--print-to-pdf=${out}`));
  });

  it("reports Chrome's own complaint when it fails", async () => {
    const bin = join(dir, "chrome-fail.sh");
    writeFileSync(bin, `#!/bin/sh\necho "chrome is unhappy" 1>&2\nexit 3\n`);
    chmodSync(bin, 0o755);
    vi.stubEnv("CHROME_BIN", bin);
    await expect(render(html, join(dir, "out-fail.pdf"))).rejects.toThrow(/chrome is unhappy/);
  });
});
