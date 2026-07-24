import { describe, expect, it } from "vitest";
import { deriveEngineIdentity } from "./engine.js";

describe("engine identity", () => {
  it("derives a self-consistent identity from the executing checkout/build", () => {
    const first = deriveEngineIdentity(), second = deriveEngineIdentity();
    expect(first).toEqual(second);
    expect(first.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(first.revision).toMatch(/^(?:[a-f0-9]{40}|build:[a-f0-9]{64})$/);
    expect(first.revisionSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
