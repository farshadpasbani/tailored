import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("verified requirement public API", () => {
  it("does not compile when raw Requirements are passed to verified fit", () => {
    const dir = mkdtempSync(join(tmpdir(), "tailored-fit-types-"));
    try {
      const source = join(dir, "bypass.ts");
      const entry = new URL("../index.js", import.meta.url).pathname;
      writeFileSync(source, [
        `import { analyzeRequirementFit, type Requirements } from ${JSON.stringify(entry)};`,
        `declare const raw: Requirements;`,
        `analyzeRequirementFit(raw, {} as Parameters<typeof analyzeRequirementFit>[1], {} as Parameters<typeof analyzeRequirementFit>[2]);`,
      ].join("\n"));
      const result = spawnSync(join(process.cwd(), "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", source], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/VerifiedRequirements|verifiedRequirementsBrand/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
