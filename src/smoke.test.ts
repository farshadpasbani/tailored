import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { version } from "./index.js";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

describe("package", () => {
  it("exposes the version from package.json", () => { expect(version).toBe(pkg.version); });
});
