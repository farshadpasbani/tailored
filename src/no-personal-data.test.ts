import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { execSync, execFileSync } from "node:child_process";

// WHY THIS FILE LOOKS THE WAY IT DOES.
//
// This repository is public. Development happened against a private working set, so the
// recurring failure is a private detail leaking into a doc, a plan or a test fixture on
// the way past. This guard fails the build when that happens.
//
// It ships MECHANISM ONLY. It contains no specific term, and no comment here describes
// what any term would be. A denylist written into a tracked file publishes exactly what
// it is meant to protect, and a comment explaining each entry publishes the rest.
// So the specific terms live in `.security/denylist.local.txt`, which is gitignored and
// stays on the author's machine. Term-based checks are LOCAL-ONLY BY DESIGN.
//
// In CI, where that file is absent, the structural checks below still run. They need no
// secrets: they recognise shapes (phone numbers, email addresses, absolute home paths)
// rather than names. A leak of a shape is caught everywhere; a leak of a specific term
// is caught before it is ever committed, on the machine where the terms are known.
//
// This file scans itself. It has no self-exclusion: a guard that skips one file is a
// guard with one blind spot, and the blind spot is always the file you trust most.
//
// Both the contents AND the path of every tracked file are checked, so a filename can
// leak no more than the bytes inside it.

const SKIP_EXTENSIONS = /\.(png|jpe?g|gif|ico|pdf|woff2?|ttf|zip)$/i;

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n")
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !SKIP_EXTENSIONS.test(f))
  .filter((f) => existsSync(f));

// Catches both the domestic 07... form and the international +44... form.
// A leading \b cannot anchor +44 (both '+' and the preceding char are non-word,
// so no boundary exists there), so the +44 alternative is anchored on its own.
const ukMobile = /(?:\+44\s?\(?0?\)?\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/;

// Real inboxes. `example.com`, `example.org` and `x.com` are the reserved and
// placeholder domains the fixtures use, so they are the only ones allowed to appear.
const ALLOWED_EMAIL_DOMAINS = /^(?:example\.(?:com|org|net)|x\.com)$/i;
const anyEmail = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

// An absolute path into someone's home directory, on any of the three platforms.
const homePath = /(?:\/Users\/|\/home\/|C:\\Users\\)[A-Za-z0-9._-]+/;

/**
 * Terms are supplied locally and never committed; absent means structural checks only.
 *
 * Line format, one entry per line:
 *   `<pattern>` or `<pattern>\t<comma-separated tracked paths where it is allowed>`
 * A pattern wrapped in slashes (`/.../`) is a case-insensitive regular expression;
 * anything else is a case-insensitive substring. The optional second field exists for
 * standard authorship metadata that is deliberately published.
 */
interface LocalEntry { test: (haystack: string) => boolean; allowedIn: string[] }

/**
 * The denylist is gitignored, so a git worktree does not have one: `readFileSync` threw,
 * `localEntries` returned nothing, and the term checks passed while examining zero terms.
 * That is how the downstream vault's repo name reached a branch of this public package.
 * A worktree's `.git` is a file pointing at the main checkout, so resolve the common dir
 * and read the list from there too, and say out loud when no list was found.
 */
function denylistCandidates(): string[] {
  const here = ".security/denylist.local.txt";
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    return [here, join(dirname(common), here)];
  } catch { return [here]; }
}

function localEntries(): LocalEntry[] {
  let lines: string[] | undefined;
  for (const candidate of denylistCandidates()) {
    try { lines = readFileSync(candidate, "utf8").split("\n"); break; } catch { /* try the next */ }
  }
  if (!lines) {
    console.warn("no-personal-data: NO local denylist found — the term checks below examined zero terms");
    return [];
  }
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [pattern, allowed = ""] = line.split("\t");
      const allowedIn = allowed.split(",").map((p) => p.trim()).filter(Boolean);
      const asRegExp = pattern.trim().match(/^\/(.*)\/$/);
      return asRegExp
        ? { test: (haystack: string) => new RegExp(asRegExp[1], "i").test(haystack), allowedIn }
        : { test: (haystack: string) => haystack.toLowerCase().includes(pattern.trim().toLowerCase()), allowedIn };
    });
}

// Every fixture below is assembled from two fragments on purpose. This file is scanned
// by its own checks, so a contiguous literal example would correctly fail them. Splitting
// the literal is the honest fix; excusing this file from the scan is not.
// (The numbers are the reserved ranges Ofcom sets aside for fiction, not anyone's.)
describe("UK mobile regex", () => {
  it("catches the domestic 07... form", () => {
    expect("07700 90" + "0123").toMatch(ukMobile);
    expect("0770090" + "0123").toMatch(ukMobile);
  });
  it("catches the international +44 form", () => {
    expect("+44 7700 90" + "0123").toMatch(ukMobile);
    expect("+4477009" + "00123").toMatch(ukMobile);
    expect("+44 (0)7700 90" + "0123").toMatch(ukMobile);
  });
  it("does not flag arbitrary digit runs", () => {
    expect("version 1.2.3 build 900123").not.toMatch(ukMobile);
  });
});

describe("home-path regex", () => {
  it("catches an absolute home directory on each platform", () => {
    expect("/Users" + "/someone/projects").toMatch(homePath);
    expect("/home" + "/someone/projects").toMatch(homePath);
    expect("C:\\Users" + "\\someone\\projects").toMatch(homePath);
  });
  it("does not flag a repository-relative path", () => {
    expect("src/gates/run.ts").not.toMatch(homePath);
    expect("examples/alex-rivers/cv.html").not.toMatch(homePath);
  });
});

describe("no personal data committed", () => {
  it("scans a non-trivial number of tracked files, including itself", () => {
    // A broken `git ls-files` read would make every check below pass vacuously.
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("src/no-personal-data.test.ts");
  });

  it("contains no UK mobile numbers", () => {
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(ukMobile);
  });

  it("contains no email address outside the placeholder domains", () => {
    const hits: string[] = [];
    for (const f of files) {
      for (const match of readFileSync(f, "utf8").matchAll(anyEmail)) {
        if (!ALLOWED_EMAIL_DOMAINS.test(match[1])) hits.push(`${f}: ${match[0]}`);
      }
    }
    expect(hits, `non-placeholder email addresses:\n${hits.join("\n")}`).toEqual([]);
  });

  it("contains no absolute home-directory path", () => {
    const hits = files.filter((f) => homePath.test(readFileSync(f, "utf8")) || homePath.test(f));
    expect(hits, `absolute home paths in:\n${hits.join("\n")}`).toEqual([]);
  });

  it("honours the local denylist (.security/denylist.local.txt, gitignored, local-only by design)", () => {
    const entries = localEntries();
    const hits: string[] = [];
    for (const f of files) {
      // the path is checked alongside the bytes, so `examples/<term>-jd.yaml` cannot pass
      const haystack = `${f}\n${readFileSync(f, "utf8")}`;
      entries.forEach((entry, index) => {
        if (entry.allowedIn.includes(f)) return;
        // report the entry number, never the term: this message can reach a public log
        if (entry.test(haystack)) hits.push(`${f}: matched local denylist entry ${index + 1}`);
      });
    }
    expect(hits, `local denylist matches (entry numbers only; read the local file to resolve):\n${hits.join("\n")}`).toEqual([]);
  });

  /**
   * The list above is gitignored, so CI has never had one and its check there examines
   * nothing. This one is committed, so it runs everywhere — and it stores sha256 digests
   * rather than the terms, because a committed plaintext list of things that must not be
   * published is itself a publication of them. Add a term with:
   *   printf '%s' "the-term" | shasum -a 256
   */
  it("honours the committed hashed denylist (.security/denylist.hashed.txt, runs in CI)", () => {
    const digests = new Set(
      readFileSync(".security/denylist.hashed.txt", "utf8")
        .split("\n").map(line => line.trim().split("#")[0].trim())
        .filter(line => /^[a-f0-9]{64}$/.test(line)),
    );
    expect(digests.size, "the committed hashed denylist is empty").toBeGreaterThan(0);
    const hits: string[] = [];
    for (const f of files) {
      const haystack = `${f}\n${readFileSync(f, "utf8")}`.toLowerCase();
      // Tokens keep internal hyphens so a hyphenated repository name stays one token.
      const tokens = haystack.split(/[^a-z0-9-]+/).filter(Boolean);
      for (const token of new Set(tokens)) {
        if (digests.has(createHash("sha256").update(token).digest("hex"))) {
          // report the file, never the token: this message can reach a public log
          hits.push(`${f}: matched a hashed denylist entry`);
          break;
        }
      }
    }
    expect(hits, `hashed denylist matches (files only; hash a suspect term to identify it):\n${hits.join("\n")}`).toEqual([]);
  });

  it("keeps public implementation notes free of raw private audit tables", () => {
    const notes = readFileSync("implementation-notes.md", "utf8");
    expect(notes).not.toMatch(/\b\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+/);
  });
});
