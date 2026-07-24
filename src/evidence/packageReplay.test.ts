import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("published private replay", () => {
  it("is included and runnable after installing the packed package", () => {
    const directory = mkdtempSync(join(tmpdir(), "tailored-package-replay-"));
    const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", directory], { cwd: resolve("."), encoding: "utf8" });
    expect(packed.status, packed.stderr).toBe(0);
    const filename = JSON.parse(packed.stdout)[0].filename as string;
    const consumer = join(directory, "consumer"); mkdirSync(consumer);
    writeFileSync(join(consumer, "package.json"), '{"name":"consumer","private":true,"version":"1.0.0"}\n');
    const installed = spawnSync("npm", ["install", join(directory, filename), "--no-audit", "--no-fund"], { cwd: consumer, encoding: "utf8" });
    expect(installed.status, installed.stderr).toBe(0);
    const script = join(consumer, "node_modules", "tailored", "scripts", "replay-claim-integrity.mjs");
    expect(existsSync(script)).toBe(true);
    expect(existsSync(join(consumer, "node_modules", "tailored", "dist", "verify", "pack.testing.js"))).toBe(false);
    const deepImport = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('tailored/verify/pack.js')"], { cwd: consumer, encoding: "utf8" });
    expect(deepImport.status).not.toBe(0);
    expect(`${deepImport.stdout}${deepImport.stderr}`).toMatch(/ERR_PACKAGE_PATH_NOT_EXPORTED/);
    const publicSurface = spawnSync(process.execPath, ["--input-type=module", "-e", "const api=await import('tailored'); if ('verifyPackForTest' in api) process.exit(1)"], { cwd: consumer, encoding: "utf8" });
    expect(publicSurface.status, publicSurface.stderr).toBe(0);
    const emptyVault = join(directory, "empty-vault"); mkdirSync(emptyVault);
    const replay = spawnSync(process.execPath, [script, emptyVault], { cwd: consumer, encoding: "utf8" });
    expect(replay.status, replay.stderr).toBe(1);
    expect(JSON.parse(replay.stdout)).toMatchObject({ attempted: 0, failed: 1 });
  }, 60_000);
});
