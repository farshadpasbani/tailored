import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { loadCanon } from "./canon/load.js";
import { lintAiTells } from "./gates/aiTell.js";
import { scanProtected } from "./gates/ipGuard.js";

describe("alex-rivers example", () => {
  it("has a valid canon", () => { expect(loadCanon("examples/alex-rivers/canon.yaml").ok).toBe(true); });
  it("ships HTML with zero AI tells", () => {
    for (const f of ["cv.html", "cover.html"]) expect(lintAiTells(readFileSync(`examples/alex-rivers/${f}`, "utf8"))).toEqual([]);
  });
  it("leaks none of its own protected topics into the rendered HTML", () => {
    const r = loadCanon("examples/alex-rivers/canon.yaml"); expect(r.ok).toBe(true);
    if (r.ok) for (const f of ["cv.html", "cover.html"]) expect(scanProtected(readFileSync(`examples/alex-rivers/${f}`, "utf8"), r.data.protectedTopics)).toEqual([]);
  });
});
