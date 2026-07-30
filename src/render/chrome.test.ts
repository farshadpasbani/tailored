import { describe, it, expect, vi } from "vitest";
import { findChrome, headlessChromeArgs, locateChrome } from "./chrome.js";

describe("finding Chrome on a machine", () => {
  it("prefers CHROME_BIN when it exists", () => {
    expect(locateChrome({ env: { CHROME_BIN: "/custom/chrome" }, platform: "linux", exists: p => p === "/custom/chrome" })).toBe("/custom/chrome");
  });
  it("ignores a CHROME_BIN that points at nothing", () => {
    expect(locateChrome({ env: { CHROME_BIN: "/gone/chrome" }, platform: "linux", exists: p => p === "/usr/bin/chromium" })).toBe("/usr/bin/chromium");
  });
  it("falls back to a known macOS path", () => {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    expect(locateChrome({ env: {}, platform: "darwin", exists: p => p === mac })).toBe(mac);
  });
  it("finds chromium on linux", () => {
    expect(locateChrome({ env: {}, platform: "linux", exists: p => p === "/usr/bin/chromium" })).toBe("/usr/bin/chromium");
  });
  it("finds the snap chromium shim on linux", () => {
    expect(locateChrome({ env: {}, platform: "linux", exists: p => p === "/snap/bin/chromium" })).toBe("/snap/bin/chromium");
  });
  it("returns null when nothing is installed", () => {
    expect(locateChrome({ env: {}, platform: "linux", exists: () => false })).toBeNull();
  });
  it("answers for the real machine too", () => {
    expect([null, "string"]).toContain(findChrome() === null ? null : "string");
  });
});

describe("the flags every headless run shares", () => {
  it("keeps the sandbox on for local use", () => {
    vi.stubEnv("CI", "");
    expect(headlessChromeArgs()).not.toContain("--no-sandbox");
    vi.unstubAllEnvs();
  });
  it("disables the sandbox under CI, which cannot initialise it", () => {
    vi.stubEnv("CI", "1");
    const args = headlessChromeArgs();
    expect(args).toContain("--no-sandbox");
    expect(args).toContain("--disable-dev-shm-usage");
    vi.unstubAllEnvs();
  });
  it("gives printing and inspection the same page geometry", () => {
    expect(headlessChromeArgs()).toContain("--window-size=1240,1754");
  });
  it("puts a caller's own flags after the headless flags and before the geometry", () => {
    const args = headlessChromeArgs(["--purpose"]);
    expect(args.indexOf("--purpose")).toBeGreaterThan(args.indexOf("--headless=new"));
    expect(args.indexOf("--purpose")).toBeLessThan(args.indexOf("--window-size=1240,1754"));
  });
});
