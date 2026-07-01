import { describe, it, expect } from "vitest";
import { parseCanon } from "./load.js";

const minimal = { identity: { name: "Alex Rivers", role: "AI Engineer" } };

describe("parseCanon", () => {
  it("accepts a minimal valid canon and applies array defaults", () => {
    const r = parseCanon(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.identity.name).toBe("Alex Rivers"); expect(r.data.projects).toEqual([]); }
  });
  it("rejects a canon missing identity.name with a readable error", () => {
    const r = parseCanon({ identity: { role: "AI Engineer" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/identity.*name/i);
  });
  it("rejects a non-object", () => { expect(parseCanon(42).ok).toBe(false); });
  it("accepts an optional year on a project", () => {
    const r = parseCanon({ ...minimal, projects: [{ name: "Gatehouse", year: "2024", bullets: ["Did a thing."] }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.projects[0].year).toBe("2024");
  });
});
