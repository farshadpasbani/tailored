import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n")
  .filter((f) => /\.(ts|md|html|yaml|yml|json)$/.test(f) && f !== "LICENSE");
const ukMobile = /\b(?:\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}\b/;

describe("no personal data committed", () => {
  it("contains no UK mobile numbers", () => {
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(ukMobile);
  });
  it("honours an optional local denylist (.security/denylist.local.txt, gitignored)", () => {
    let terms: string[] = [];
    try { terms = readFileSync(".security/denylist.local.txt", "utf8").split("\n").map((s) => s.trim()).filter(Boolean); } catch { /* none locally */ }
    for (const f of files) for (const t of terms) expect(readFileSync(f, "utf8").toLowerCase()).not.toContain(t.toLowerCase());
  });
});
