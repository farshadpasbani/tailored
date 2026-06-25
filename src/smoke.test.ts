import { describe, it, expect } from "vitest";
import { version } from "./index.js";
describe("package", () => { it("exposes a version", () => { expect(version).toBe("0.1.0"); }); });
