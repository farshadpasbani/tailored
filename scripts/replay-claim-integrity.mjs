#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { migrateCanon } from "../dist/canon/migrate.js";

const argv = process.argv.slice(2);
const option = name => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; };
const positional = argv.find(value => !value.startsWith("--") && ![option("--manifest"), option("--output")].includes(value));
const vault = resolve(positional ?? "");
const manifestPath = option("--manifest");
const outputPath = option("--output");
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = resolve(process.env.TAILORED_REPLAY_CLI ?? join(packageRoot, "dist", "cli.js"));
if (!process.argv[2] || !statSync(vault, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("usage: npm run replay:private -- /absolute/path/to/private-vault");
  process.exit(2);
}

const ignored = new Set([".git", "node_modules", ".venv", "venv", "dist"]);
const listVaultFiles = directory => {
  const files = [];
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk(directory);
  return files;
};
const vaultFilesBefore = listVaultFiles(vault);
const evidenceFiles = vaultFilesBefore.filter(path => basename(path) === "evidence.yaml");
const insideVault = path => {
  const fromVault = relative(vault, path);
  return fromVault === "" || (!fromVault.startsWith("..") && !isAbsolute(fromVault));
};

const nearestCanon = start => {
  for (let directory = start; insideVault(directory); directory = dirname(directory)) {
    for (const name of ["canon.yaml", "canon.yml"]) {
      const candidate = join(directory, name);
      if (statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate;
    }
    if (directory === vault) break;
  }
};
const hashBytes = bytes => createHash("sha256").update(bytes).digest("hex");
const manifest = paths => new Map([...paths].sort().map(path => [path,
  statSync(path, { throwIfNoEntry: false })?.isFile() ? hashBytes(readFileSync(path)) : "missing"]));
const mutationCount = (before, after) => [...before].filter(([path, digest]) => after.get(path) !== digest).length
  + [...after.keys()].filter(path => !before.has(path)).length;

const bundles = [], consumed = new Set();
let failed = 0;
for (const evidencePath of evidenceFiles.sort()) {
  let evidence;
  try { evidence = yaml.load(readFileSync(evidencePath, "utf8")); }
  catch { failed++; continue; }
  const canonPath = nearestCanon(dirname(evidencePath));
  const artifacts = Array.isArray(evidence?.artifacts) ? evidence.artifacts : [];
  const archives = Array.isArray(evidence?.employerSources) ? evidence.employerSources : [];
  const paths = [evidencePath, canonPath,
    ...artifacts.map(artifact => typeof artifact?.path === "string" ? resolve(dirname(evidencePath), artifact.path) : undefined),
    ...archives.map(source => typeof source?.archivePath === "string" ? resolve(dirname(evidencePath), source.archivePath) : undefined),
  ].filter(Boolean);
  if (!canonPath || paths.some(path => !insideVault(path) || !statSync(path, { throwIfNoEntry: false })?.isFile())) { failed++; continue; }
  paths.forEach(path => consumed.add(path));
  bundles.push({ evidencePath, canonPath, evidence, artifacts, paths });
}

const actualBefore = manifest(vaultFilesBefore);
const temporary = mkdtempSync(join(tmpdir(), "tailored-private-replay-"));
let attempted = 0, passed = 0, inputMutations = 0;
const outcomeDigest = createHash("sha256");
try {
  for (const bundle of bundles) {
    for (const original of bundle.paths) {
      const target = join(temporary, relative(vault, original));
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(original, target);
    }
    const copiedEvidence = join(temporary, relative(vault, bundle.evidencePath));
    const copiedCanon = join(temporary, relative(vault, bundle.canonPath));
    const migrated = migrateCanon(yaml.load(readFileSync(copiedCanon, "utf8")));
    if (!migrated.ok) { failed++; outcomeDigest.update("migration-failed\0"); continue; }
    const migratedCanon = `${copiedCanon}.migrated.yaml`;
    writeFileSync(migratedCanon, yaml.dump(migrated.data, { noRefs: true, lineWidth: 100, sortKeys: false }));
    const tempInputs = new Set(bundle.paths.map(path => join(temporary, relative(vault, path))));
    tempInputs.add(migratedCanon);
    const before = manifest(tempInputs);
    for (const artifact of bundle.artifacts) {
      const html = typeof artifact?.path === "string" ? resolve(dirname(copiedEvidence), artifact.path) : "";
      if (!html || !statSync(html, { throwIfNoEntry: false })?.isFile()) { failed++; continue; }
      attempted++;
      const result = spawnSync(process.execPath, [cli, "claim-integrity", html, "--artifact", String(artifact.id ?? ""), "--canon", migratedCanon, "--evidence", copiedEvidence], { encoding: "utf8", stdio: "ignore", env: process.env });
      if (result.status === 0) { passed++; outcomeDigest.update("pass\0"); }
      else { failed++; outcomeDigest.update("fail\0"); }
    }
    inputMutations += mutationCount(before, manifest(tempInputs));
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const vaultMutations = mutationCount(actualBefore, manifest(listVaultFiles(vault)));
failed += inputMutations + vaultMutations;
const attemptedGroups = new Set();
let requiredGroups = [];
if (manifestPath) {
  let audit;
  try { audit = yaml.load(readFileSync(resolve(manifestPath), "utf8")); }
  catch { console.error("private audit manifest is unreadable"); process.exit(2); }
  requiredGroups = Array.isArray(audit?.requiredGroups) ? audit.requiredGroups.filter(value => typeof value === "string" && value) : [];
  for (const entry of Array.isArray(audit?.cases) ? audit.cases : []) {
    if (!entry || typeof entry.group !== "string" || typeof entry.artifact !== "string" || typeof entry.canon !== "string" || typeof entry.evidence !== "string" || typeof entry.artifactId !== "string") {
      failed++; outcomeDigest.update("invalid-manifest-case\0"); continue;
    }
    const html = resolve(entry.artifact), canon = resolve(entry.canon), evidence = resolve(entry.evidence);
    if (![html, canon, evidence].every(path => statSync(path, { throwIfNoEntry: false })?.isFile())) {
      failed++; outcomeDigest.update("missing-manifest-input\0"); continue;
    }
    attempted++; attemptedGroups.add(entry.group);
    const result = spawnSync(process.execPath, [cli, "claim-integrity", html, "--artifact", entry.artifactId, "--canon", canon, "--evidence", evidence], { encoding: "utf8", env: process.env });
    const expected = entry.expect === "fail" ? "fail" : "pass";
    const actual = result.status === 0 ? "pass" : "fail";
    const issueKinds = [...String(result.stderr ?? "").matchAll(/\[([a-z][a-z-]+)\]/g)].map(match => match[1]);
    const expectedIssueKinds = Array.isArray(entry.expectedIssueKinds) ? entry.expectedIssueKinds.filter(value => typeof value === "string" && value) : [];
    const exercisedExpectedGate = expected === "pass" || (expectedIssueKinds.length > 0 && expectedIssueKinds.every(kind => issueKinds.includes(kind)));
    if (actual === expected && exercisedExpectedGate) { passed++; outcomeDigest.update(`${entry.group}\0${expected}\0`); }
    else { failed++; outcomeDigest.update(`${entry.group}\0unexpected-${actual}\0`); }
  }
}
for (const group of requiredGroups) if (!attemptedGroups.has(group)) { failed++; outcomeDigest.update("missing-required-group\0"); }
if (attempted === 0) { failed++; outcomeDigest.update("vacuous-replay\0"); }
if (manifestPath && requiredGroups.length === 0) { failed++; outcomeDigest.update("vacuous-field-run\0"); }
const report = {
  schemaVersion: 2,
  evidenceFiles: evidenceFiles.length,
  consumedInputs: consumed.size,
  artifacts: bundles.reduce((sum, bundle) => sum + bundle.artifacts.length, 0),
  requiredGroups: requiredGroups.length, attemptedGroups: attemptedGroups.size,
  attempted, passed, failed, inputMutations, vaultMutations,
  digest: outcomeDigest.digest("hex"),
};
if (outputPath) {
  const destination = resolve(outputPath), temporaryOutput = `${destination}.${process.pid}.tmp`;
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(temporaryOutput, `${JSON.stringify(report)}\n`, { mode: 0o600 });
  renameSync(temporaryOutput, destination);
}
console.log(JSON.stringify(report));
process.exitCode = failed ? 1 : 0;
