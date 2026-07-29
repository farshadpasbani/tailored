import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteFileSync } from "./atomicWrite.js";

describe("atomicWriteFileSync", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "atomic-write-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const target = () => join(dir, "out.yaml");
  const leftovers = () => readdirSync(dir).filter(name => name !== "out.yaml");

  it("writes a new file and leaves no temporary behind", () => {
    atomicWriteFileSync(target(), "first: true\n");
    expect(readFileSync(target(), "utf8")).toBe("first: true\n");
    expect(leftovers()).toEqual([]);
  });

  it("replaces an existing file by default, as the migrate commands do", () => {
    writeFileSync(target(), "old\n");
    atomicWriteFileSync(target(), "new\n");
    expect(readFileSync(target(), "utf8")).toBe("new\n");
    expect(leftovers()).toEqual([]);
  });

  it("refuses to replace an existing file when exclusive, as the receipt path must", () => {
    writeFileSync(target(), "issued receipt\n");
    expect(() => atomicWriteFileSync(target(), "second receipt\n", { exclusive: true })).toThrow(/EEXIST/);
    expect(readFileSync(target(), "utf8")).toBe("issued receipt\n");
  });

  it("cleans up its temporary after a refused exclusive write", () => {
    writeFileSync(target(), "issued receipt\n");
    expect(() => atomicWriteFileSync(target(), "second receipt\n", { exclusive: true })).toThrow();
    expect(leftovers()).toEqual([]);
  });

  it("writes a new file when exclusive and nothing is there", () => {
    atomicWriteFileSync(target(), "issued receipt\n", { exclusive: true });
    expect(readFileSync(target(), "utf8")).toBe("issued receipt\n");
    expect(leftovers()).toEqual([]);
  });

  it("reports the reason and leaves nothing behind when the target directory is unwritable", () => {
    const path = join(dir, "missing-parent", "out.yaml");
    expect(() => atomicWriteFileSync(path, "x")).toThrow(/ENOENT/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("refuses when the target is a directory, rather than writing into it", () => {
    mkdirSync(target());
    expect(() => atomicWriteFileSync(target(), "x")).toThrow();
    expect(leftovers()).toEqual([]);
  });

  it("writes the exact bytes given, with no trailing newline of its own", () => {
    atomicWriteFileSync(target(), "no-trailing-newline");
    expect(readFileSync(target(), "utf8")).toBe("no-trailing-newline");
  });
});
