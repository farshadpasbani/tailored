import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { sha256Bytes } from "./hash.js";

export interface EngineIdentity { version: string; revision: string; revisionSha256: string; }

export function deriveEngineIdentity(moduleUrl = import.meta.url): EngineIdentity {
  const modulePath = fileURLToPath(moduleUrl);
  const packageRoot = dirname(dirname(dirname(modulePath)));
  const require = createRequire(moduleUrl);
  const version = (require(join(packageRoot, "package.json")) as { version: string }).version;
  let revision: string | undefined;
  if (existsSync(join(packageRoot, ".git"))) {
    try { revision = execFileSync("git", ["-C", packageRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
    catch { /* fall through to an installed-build digest */ }
  }
  if (!revision) {
    const digest = createHash("sha256");
    for (const relative of ["verify/pack.js", "verify/receipt.js", "verify/trust.js", "policy/verify.js", "gates/claimIntegrity.js", "requirements/schema.js"]) {
      const path = join(dirname(modulePath), "..", relative);
      digest.update(relative).update("\0").update(readFileSync(path)).update("\0");
    }
    revision = `build:${digest.digest("hex")}`;
  }
  return { version, revision, revisionSha256: sha256Bytes(revision) };
}
