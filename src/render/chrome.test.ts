import { describe, it, expect } from "vitest";
import { findChrome, buildChromeArgs } from "./chrome.js";
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
