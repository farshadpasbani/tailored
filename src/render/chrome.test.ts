import { describe, it, expect } from "vitest";
import { findChrome } from "./chrome.js";
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
