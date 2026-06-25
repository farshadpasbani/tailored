import { describe, it, expect } from "vitest";
import { scanProtected } from "./ipGuard.js";
describe("scanProtected", () => {
  it("finds a protected term case-insensitively", () => { const r = scanProtected("the SFC engine", ["sfc"]); expect(r).toHaveLength(1); expect(r[0].term).toBe("sfc"); });
  it("returns nothing when clean or no terms", () => { expect(scanProtected("clean text", ["Titan"])).toEqual([]); expect(scanProtected("anything", [])).toEqual([]); });
  it("escapes regex metacharacters in terms", () => { expect(scanProtected("a.b.c", ["a.b"])).toHaveLength(1); expect(scanProtected("axbxc", ["a.b"])).toEqual([]); });
});
