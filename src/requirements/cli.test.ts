import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { findChrome } from "../render/chrome.js";
import { render } from "../render/renderer.js";
import { issueBaselineReceipt, prepareRequirementsBaseline, createChangeReceipt, type Requirement } from "./schema.js";

function freezeBaseline(requirements: Requirement[], input: { frozenAt: string; archivedJdSha256: string; issuer: string }) {
  const prepared = prepareRequirementsBaseline(requirements);
  const receipt = issueBaselineReceipt(prepared.sha256, input);
  return { baseline: { ...prepared, receiptSha256: receipt.sha256 }, receipt };
}

const canRun = existsSync("dist/cli.js");
const canRender = canRun && Boolean(findChrome()) && spawnSync("pdftotext", ["-v"]).status === 0;

function run(args: string[]) {
  const result = spawnSync("node", ["dist/cli.js", ...args], { encoding: "utf8" });
  return { code: result.status ?? 1, out: `${result.stdout}${result.stderr}` };
}

function fixture(blocker = false) {
  const dir = mkdtempSync(join(tmpdir(), "tailored-v2-cli-"));
  const jd = "Must have Python. No sponsorship is available.";
  const canon = {
    schemaVersion: 2, identity: { name: "Jane", role: "Engineer" },
    skills: [], projects: [], experience: [], education: [], certifications: [], publications: [], protectedTopics: [],
    verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {},
    facts: [{ id: "fact-python", statement: "Uses Python", kind: "skill", subject: "Python", provenance: { type: "candidate-attested", source: "candidate" }, verifiedOn: "2026-07-12", status: "candidate-attested", confidence: 1, allowedUses: ["fit"], sensitivity: "public" }],
  };
  const requirementRecords = [
      { id: "req-python", source: { quote: "Must have Python", location: "sentence 1", span: { start: 0, end: 16 } }, classification: { frozen: "hard" as const, current: "hard" as const }, weight: 100, eligibilityImpact: "none" as const, ats: { literals: [{ term: "Python", source: { quote: "Python", location: "sentence 1", span: { start: 10, end: 16 } } }], aliases: [] }, evidence: { kind: "direct" as const, factIds: ["fact-python"] } },
      { id: "req-sponsorship", source: { quote: "No sponsorship", location: "sentence 2", span: { start: 18, end: 32 } }, classification: { frozen: "hard" as const, current: "hard" as const }, weight: 1, eligibilityImpact: (blocker ? "blocker" : "uncertain") as "blocker" | "uncertain", ats: { literals: [{ term: "sponsorship", source: { quote: "sponsorship", location: "sentence 2", span: { start: 21, end: 32 } } }], aliases: [] }, evidence: { kind: "gap" as const, note: "Eligibility unresolved" } },
  ];
  const frozen = freezeBaseline(requirementRecords, { frozenAt: "2026-07-12T12:00:00.000Z", archivedJdSha256: createHash("sha256").update(jd).digest("hex"), issuer: "test" });
  const requirements = {
    schemaVersion: 2, role: "Engineer", archivedJd: { sha256: createHash("sha256").update(jd).digest("hex") }, frozenAt: "2026-07-12T12:00:00.000Z",
    requirements: requirementRecords,
    baseline: frozen.baseline,
    changes: [],
  };
  const paths = { canon: join(dir, "canon.yaml"), requirements: join(dir, "requirements.yaml"), baselineReceipt: join(dir, "baseline-receipt.yaml"), jd: join(dir, "job-description.md"), cv: join(dir, "cv.html") };
  writeFileSync(paths.canon, yaml.dump(canon));
  writeFileSync(paths.requirements, yaml.dump(requirements));
  writeFileSync(paths.baselineReceipt, yaml.dump(frozen.receipt));
  writeFileSync(paths.jd, jd);
  writeFileSync(paths.cv, `<html><body><h1>Jane</h1><p>jane@example.com</p><h2>Summary</h2><p>Python sponsorship ${"reliable systems ".repeat(20)}</p><h2>Experience</h2><p>${"production engineering ".repeat(20)}</p><h2>Education</h2><p>BSc Engineering</p><h2>Skills</h2><p>Python</p></body></html>`);
  return paths;
}

describe.skipIf(!canRun)("requirements v2 CLI", () => {
  it("reports fit from evidence and sponsorship uncertainty separately", () => {
    const paths = fixture();
    const result = run(["fit", "--requirements", paths.requirements, "--jd-text", paths.jd, "--canon", paths.canon, "--baseline-receipt", paths.baselineReceipt, "--allow-candidate-attested"]);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/direct evidence: req-python/);
    expect(result.out).toMatch(/eligibility uncertain: req-sponsorship/);
    expect(result.out).toMatch(/verified requirement-evidence fit/);
    expect(run(["fit", "--requirements", paths.requirements, "--jd-text", paths.jd, "--canon", paths.canon, "--baseline-receipt", paths.baselineReceipt, "--allow-candidate-attested"])).toEqual(result);
  });

  it("issues the trusted baseline as a separate non-overwriting artifact", () => {
    const paths = fixture();
    const issued = join(paths.requirements, "..", "issued-baseline.yaml");
    const first = run(["issue-baseline-receipt", paths.requirements, issued, "--jd-text", paths.jd, "--issuer", "test"]);
    expect(first.code).toBe(0);
    expect(yaml.load(readFileSync(issued, "utf8"))).toEqual(yaml.load(readFileSync(paths.baselineReceipt, "utf8")));
    const second = run(["issue-baseline-receipt", paths.requirements, issued, "--jd-text", paths.jd, "--issuer", "test"]);
    expect(second.code).toBe(1);
    expect(second.out).toMatch(/could not write baseline receipt/);
  });

  it("rejects malformed issuance input without persisting an anchor", () => {
    const paths = fixture();
    const issued = join(paths.requirements, "..", "invalid-baseline.yaml");
    const result = run(["issue-baseline-receipt", paths.requirements, issued, "--jd-text", paths.jd, "--issuer", ""]);
    expect(result.code).toBe(1);
    expect(existsSync(issued)).toBe(false);
  });

  it("rejects a malformed receipt policy even when there are no changes", () => {
    const paths = fixture();
    const result = run(["fit", "--requirements", paths.requirements, "--jd-text", paths.jd, "--canon", paths.canon, "--baseline-receipt", paths.baselineReceipt, "--allow-candidate-attested", "--as-of", "2026-02-30"]);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/asOfDate: expected a real YYYY-MM-DD date/);
  });

  it("does not let a near-perfect aggregate hide a hard eligibility blocker", () => {
    const paths = fixture(true);
    const result = run(["fit", "--requirements", paths.requirements, "--jd-text", paths.jd, "--canon", paths.canon, "--baseline-receipt", paths.baselineReceipt, "--allow-candidate-attested"]);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/HARD BLOCKER: req-sponsorship/);
    expect(result.out).toMatch(/BLOCKED/);
  });

  it("resolves and validates a receipt-bound reclassification", () => {
    const paths = fixture();
    const raw: any = yaml.load(readFileSync(paths.requirements, "utf8"));
    const before = raw.requirements[0].classification;
    const after = { frozen: "hard", current: "preferred" };
    const waiver = { id: "waiver-1", approvedBy: "Jane", reason: "Employer clarification" };
    const receipt = createChangeReceipt({ action: "reclassify", issuedOn: "2026-07-12", baselineReceiptSha256: raw.baseline.receiptSha256, archivedJdSha256: raw.archivedJd.sha256, requirementId: "req-python", before, after, waiver });
    raw.changes.push({ id: "change-1", action: "reclassify", requirementId: "req-python", changedOn: "2026-07-12", before, after, waiver, receiptSha256: receipt.sha256 });
    const receiptPath = join(paths.requirements, "..", "receipt.yaml");
    writeFileSync(paths.requirements, yaml.dump(raw));
    writeFileSync(receiptPath, yaml.dump(receipt));
    const result = run(["fit", "--requirements", paths.requirements, "--jd-text", paths.jd, "--canon", paths.canon, "--baseline-receipt", paths.baselineReceipt, "--allow-candidate-attested", "--receipt", receiptPath, "--as-of", "2026-07-12"]);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/reclassified by validated prior receipt: req-python/);
  });

  it.skipIf(!canRender)("reports literal ATS vocabulary from the rendered PDF without claiming verified fit", async () => {
    const paths = fixture();
    const pdf = join(tmpdir(), `tailored-requirements-ats-${process.pid}.pdf`);
    await render(paths.cv, pdf);
    const result = run(["requirements-ats", pdf, "--requirements", paths.requirements, "--jd-text", paths.jd, "--canon", paths.canon, "--baseline-receipt", paths.baselineReceipt]);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/ATS literal vocabulary 100%/);
    expect(result.out).toMatch(/verified fit is not inferred/);
  }, 15_000);
});
