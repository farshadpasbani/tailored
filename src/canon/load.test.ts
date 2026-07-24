import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { loadCanon, parseCanon } from "./load.js";

const minimal = { identity: { name: "Alex Rivers", role: "AI Engineer" } };

describe("parseCanon", () => {
  it("accepts a minimal valid canon and applies array defaults", () => {
    const r = parseCanon(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.identity.name).toBe("Alex Rivers"); expect(r.data.projects).toEqual([]); }
  });
  it("loads schemaVersion 2 through the strict parser", () => {
    const dir = mkdtempSync(join(tmpdir(), "tailored-load-v2-"));
    const path = join(dir, "canon.yaml");
    try {
      writeFileSync(path, "schemaVersion: 2\nidentity:\n  name: Alex Rivers\n  role: AI Engineer\nfacts: []\n");
      const result = loadCanon(path);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.schemaVersion).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("labels an unversioned canon as legacy v1", () => {
    const result = parseCanon(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.schemaVersion).toBe(1);
  });
  it("does not fall back to v1 when a malformed v2 canon is supplied", () => {
    const result = parseCanon({
      schemaVersion: 2,
      identity: { name: "Alex Rivers", role: "AI Engineer", locaton: "Manchester" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.stringMatching(/^identity\.locaton:/));
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
