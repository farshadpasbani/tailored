import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n")
  .filter((f) => /\.(ts|md|html|yaml|yml|json)$/.test(f) && f !== "LICENSE")
  // this very file carries fake numbers as regex fixtures; do not scan itself
  .filter((f) => f !== "src/no-personal-data.test.ts");
// Catches both the domestic 07... form and the international +44... form.
// A leading \b cannot anchor +44 (both '+' and the preceding char are non-word,
// so no boundary exists there), so the +44 alternative is anchored on its own.
const ukMobile = /(?:\+44\s?\(?0?\)?\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/;
// Ofcom's reserved-for-drama mobile block, 07700 900000–900999 (+44 7700 900xxx),
// which can never be a real subscriber. A mobile-shaped string is allowed only if
// it falls in this block; everything else is treated as real personal data.
const dramaMobile = /(?:\+44\s?\(?0?\)?\s?7700|\b07700)\s?900\s?\d{3}\b/;

/** Every mobile-shaped string in `text` that is NOT in the reserved-for-drama range. */
function nonDramaMobiles(text: string): string[] {
  return [...text.matchAll(new RegExp(ukMobile.source, "g"))].map((m) => m[0]).filter((s) => !dramaMobile.test(s));
}

describe("UK mobile regex", () => {
  it("catches the domestic 07... form", () => {
    expect("07700 900123").toMatch(ukMobile);
    expect("07700900123").toMatch(ukMobile);
  });
  it("catches the international +44 form", () => {
    expect("+44 7700 900123").toMatch(ukMobile);
    expect("+447700900123").toMatch(ukMobile);
    expect("+44 (0)7700 900123").toMatch(ukMobile);
  });
  it("does not flag arbitrary digit runs", () => {
    expect("version 1.2.3 build 900123").not.toMatch(ukMobile);
  });
});

describe("nonDramaMobiles", () => {
  it("allows Ofcom's reserved-for-drama range (07700 900000–900999) in every form", () => {
    expect(nonDramaMobiles("call +44 7700 900123 today")).toEqual([]);
    expect(nonDramaMobiles("07700 900999 / 07700900000 / +447700900500")).toEqual([]);
    expect(nonDramaMobiles("+44 (0)7700 900123")).toEqual([]);
  });
  it("flags a real-looking UK mobile outside the drama range", () => {
    expect(nonDramaMobiles("ring 07911 123456")).toEqual(["07911 123456"]);
    expect(nonDramaMobiles("07700 901000")).toEqual(["07700 901000"]);
  });
});

describe("no personal data committed", () => {
  it("contains no UK mobile numbers outside the reserved-for-drama range", () => {
    for (const f of files) expect(nonDramaMobiles(readFileSync(f, "utf8"))).toEqual([]);
  });
  it("honours an optional local denylist (.security/denylist.local.txt, gitignored)", () => {
    let terms: string[] = [];
    try { terms = readFileSync(".security/denylist.local.txt", "utf8").split("\n").map((s) => s.trim()).filter(Boolean); } catch { /* none locally */ }
    for (const f of files) for (const t of terms) expect(readFileSync(f, "utf8").toLowerCase()).not.toContain(t.toLowerCase());
  });
});
