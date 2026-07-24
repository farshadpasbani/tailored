import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { migrateCanon } from "../canon/migrate.js";
import type { Canon } from "../canon/schema.js";
import { analyzeRequirementAts } from "../gates/ats.js";
import { analyzeRequirementFit } from "../gates/fit.js";
import { extractPdfText } from "../gates/run.js";
import { renderToPdf } from "../render/chrome.js";
import { issueBaselineReceipt, loadRequirements, prepareRequirementsBaseline, type Requirement, type Requirements } from "./schema.js";

function freezeBaseline(requirements: Requirement[], input: { frozenAt: string; archivedJdSha256: string; issuer: string }) { const prepared = prepareRequirementsBaseline(requirements); const receipt = issueBaselineReceipt(prepared.sha256, input); return { ...prepared, receiptSha256: receipt.sha256 }; }
import { parseLegacyJd } from "../jd/load.js";
import type { LegacyJd } from "../jd/schema.js";

// This file ships in a public repository. Every real company, application path, canon
// fact and audited number lives in the private vault, never here: the fixture table is
// read from `TAILORED_PRIVATE_FIELD_FIXTURES` (default `<vault>/field-fixtures.json`)
// and the whole suite skips when the vault is not configured.
const vault = process.env.TAILORED_PRIVATE_VAULT;
const fixturesPath = process.env.TAILORED_PRIVATE_FIELD_FIXTURES ?? (vault ? join(vault, "field-fixtures.json") : undefined);
const policy = { allowCandidateAttested: true, minConfidence: 0.5, allowedUses: ["fit"], allowedSensitivities: ["public", "private"], allowedProvenanceTypes: ["candidate-attested", "artifact", "external"] } as const;

/** One private application pack plus the audited outcome it must still reproduce. */
interface FieldFixture {
  /** Employer name as it should be recorded on the frozen requirements. */
  company: string;
  /** Role title as it should be recorded on the frozen requirements. */
  role: string;
  /** Application pack directory, relative to the vault root. */
  path: string;
  /** Verbatim posting-location text used as the sponsorship-uncertainty requirement. */
  locationQuote: string;
  /** Lowercased bullet substrings mapped to the canon fact that evidences them. */
  evidenceRules: Array<{ match: string[]; kind: "direct" | "transferable"; factText: string; note?: string }>;
  expected: {
    requirements: number;
    reviewedTerms: number;
    fit: number;
    ats: number;
    direct: number;
    transferable: number;
    ineligibleEvidence: number;
    materialGaps: number;
    literals: number;
    aliases: number;
    rejected: string[];
    /** Terms that must NOT survive into the ATS inventory, lowercased. */
    absentLiterals?: string[];
    /** True when at least one frozen requirement quote must span multiple lines. */
    multilineQuote?: boolean;
  };
}

const fixtures: FieldFixture[] = vault && fixturesPath && existsSync(fixturesPath)
  ? JSON.parse(readFileSync(fixturesPath, "utf8"))
  : [];

async function withPrivateTemp<T>(prefix: string, operation: (path: string) => Promise<T>): Promise<T> {
  const path = mkdtempSync(join(tmpdir(), prefix));
  try { return await operation(path); }
  finally { rmSync(path, { recursive: true, force: true }); }
}

function migratedCanon(root: string): Canon {
  const migrated = migrateCanon(yaml.load(readFileSync(join(root, "canon.yaml"), "utf8")));
  if (!migrated.ok) throw new Error(migrated.errors.join("\n"));
  return migrated.data;
}

function factId(canon: Canon, text: string): string {
  const fact = canon.facts.find((candidate) => candidate.statement.includes(text));
  if (!fact) throw new Error(`Field fixture canon has no fact containing ${JSON.stringify(text)}`);
  return fact.id;
}

function bulletSpans(jdText: string): Array<{ quote: string; span: { start: number; end: number }; line: number; preferred: boolean }> {
  const lines = jdText.split("\n");
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length + 1; }
  let preferred = false;
  const bullets: Array<{ quote: string; span: { start: number; end: number }; line: number; preferred: boolean }> = [];
  for (let index = 0; index < lines.length; index++) {
    if (/^Nice to Have$/i.test(lines[index].trim())) preferred = true;
    if (!lines[index].startsWith("- ")) continue;
    const start = offsets[index] + 2;
    let end = offsets[index] + lines[index].length;
    for (let next = index + 1; next < lines.length; next++) {
      const candidate = lines[next];
      if (!candidate.trim() || candidate.startsWith("- ") || /^#+\s/.test(candidate) || /^(Qualifications|Required|Nice to Have|Responsibilities)$/i.test(candidate.trim())) break;
      end = offsets[next] + candidate.length;
    }
    bullets.push({ quote: jdText.slice(start, end), span: { start, end }, line: index + 1, preferred });
  }
  return bullets;
}

function commonPrefix(a: string, b: string): number { let index = 0; while (index < a.length && index < b.length && a[index] === b[index]) index++; return index; }

function assignReviewedAtsInventory(requirements: Requirement[], jd: LegacyJd): string[] {
  const reviewed = [...jd.mustHave, ...jd.niceToHave];
  const rejected: string[] = [];
  for (const reviewedTerm of reviewed) {
    const candidates = [reviewedTerm, ...(jd.synonyms[reviewedTerm] ?? [])];
    let match: { requirement: Requirement; quote: string; start: number } | undefined;
    for (const candidate of candidates) {
      for (const requirement of requirements) {
        const local = requirement.source.quote.toLocaleLowerCase("en-US").indexOf(candidate.toLocaleLowerCase("en-US"));
        if (local >= 0) { match = { requirement, quote: requirement.source.quote.slice(local, local + candidate.length), start: requirement.source.span.start + local }; break; }
      }
      if (match) break;
    }
    if (!match) {
      const termTokens = reviewedTerm.toLocaleLowerCase("en-US").split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
      let best: typeof match;
      let bestScore = 0;
      for (const requirement of requirements) {
        for (const wordMatch of requirement.source.quote.matchAll(/[A-Za-z0-9]+/g)) {
          const word = wordMatch[0].toLocaleLowerCase("en-US");
          const score = Math.max(0, ...termTokens.map((token) => token === word ? 100 : commonPrefix(token, word)));
          if (score >= 4 && score > bestScore) { bestScore = score; best = { requirement, quote: wordMatch[0], start: requirement.source.span.start + (wordMatch.index ?? 0) }; }
        }
      }
      match = best;
    }
    if (!match) { rejected.push(reviewedTerm); continue; }
    const normalizedLiteral = match.quote.toLocaleLowerCase("en-US");
    let literal = match.requirement.ats.literals.find((item) => item.term.toLocaleLowerCase("en-US") === normalizedLiteral);
    if (!literal) {
      literal = { term: match.quote, source: { quote: match.quote, location: match.requirement.source.location, span: { start: match.start, end: match.start + match.quote.length } } };
      match.requirement.ats.literals.push(literal);
    }
    if (reviewedTerm.toLocaleLowerCase("en-US") !== normalizedLiteral) match.requirement.ats.aliases.push({ term: reviewedTerm, forLiteral: literal.term, reason: "Reviewed legacy inventory paraphrase; literal source term remains ATS authority" });
  }
  return rejected;
}

function fieldRequirements(fixture: FieldFixture, jdText: string, canon: Canon, jd: LegacyJd): { data: Requirements; rejected: string[] } {
  const requirements: Requirement[] = bulletSpans(jdText).map((bullet, index) => {
    const lower = bullet.quote.toLocaleLowerCase("en-US").replace(/\s+/g, " ");
    let evidence: Requirement["evidence"] = { kind: "gap", note: "No matching verified canon fact ID" };
    const rule = fixture.evidenceRules.find((candidate) => candidate.match.some((needle) => lower.includes(needle)));
    if (rule) evidence = rule.note === undefined
      ? { kind: rule.kind, factIds: [factId(canon, rule.factText)] }
      : { kind: rule.kind, factIds: [factId(canon, rule.factText)], note: rule.note };
    return { id: `req-${String(index + 1).padStart(3, "0")}`, source: { quote: bullet.quote, location: `archived JD line ${bullet.line}`, span: bullet.span }, classification: { frozen: bullet.preferred ? "preferred" : "hard", current: bullet.preferred ? "preferred" : "hard" }, weight: bullet.preferred ? 1 : 3, eligibilityImpact: "none", ats: { literals: [], aliases: [] }, evidence };
  });
  const locationQuote = fixture.locationQuote;
  const locationStart = jdText.indexOf(locationQuote);
  requirements.push({ id: "req-sponsorship-status", source: { quote: locationQuote, location: "posting location", span: { start: locationStart, end: locationStart + locationQuote.length } }, classification: { frozen: "hard", current: "hard" }, weight: 3, eligibilityImpact: "uncertain", ats: { literals: [], aliases: [] }, evidence: { kind: "gap", note: "The posting location does not resolve sponsorship or right-to-work eligibility" } });
  const rejected = assignReviewedAtsInventory(requirements, jd);
  const archivedJdSha256 = createHash("sha256").update(jdText).digest("hex");
  const frozenAt = "2026-07-12T12:00:00.000Z";
  return { data: { schemaVersion: 2, role: fixture.role, company: fixture.company, archivedJd: { sha256: archivedJdSha256 }, frozenAt, requirements, baseline: freezeBaseline(requirements, { frozenAt, archivedJdSha256, issuer: "field-review" }), changes: [] }, rejected };
}

function reviewFitUses(canon: Canon, requirements: Requirements): Canon {
  const reviewedIds = new Set(requirements.requirements.flatMap((requirement) => requirement.evidence.kind === "direct" || requirement.evidence.kind === "transferable" ? requirement.evidence.factIds : []));
  const amended = structuredClone(canon);
  amended.facts.forEach((fact) => { if (reviewedIds.has(fact.id) && !fact.allowedUses.includes("fit")) fact.allowedUses.push("fit"); });
  return amended;
}

describe.skipIf(fixtures.length === 0)("real private-vault field fixtures", () => {
  for (const [index, fixture] of fixtures.entries()) {
    const expected = fixture.expected;
    it(`private field fixture ${index + 1} freezes complete bullets and reviewed ATS inventory`, async () => {
      const root = vault!;
      const canon = migratedCanon(root);
      const application = join(root, fixture.path);
      const jdPath = join(application, "job-description.md");
      const jdText = readFileSync(jdPath, "utf8");
      const legacy = parseLegacyJd(yaml.load(readFileSync(join(application, "jd.yaml"), "utf8")));
      if (!legacy.ok) throw new Error(legacy.errors.join("\n"));
      const reviewedTerms = [...legacy.data.mustHave, ...legacy.data.niceToHave];
      expect(reviewedTerms).toHaveLength(expected.reviewedTerms);
      const field = fieldRequirements(fixture, jdText, canon, legacy.data);
      const requirements = field.data;
      expect(canon.facts.some((fact) => fact.allowedUses.includes("fit"))).toBe(false);
      const reviewedCanon = reviewFitUses(canon, requirements);
      expect(reviewedCanon.facts.filter((fact) => fact.allowedUses.includes("fit")).length).toBeGreaterThan(0);
      expect(reviewedCanon.facts.map((fact) => fact.status)).toEqual(canon.facts.map((fact) => fact.status));
      let temp = "";
      await withPrivateTemp(`tailored-field-${index + 1}-`, async (path) => {
        temp = path;
        const out = join(temp, "requirements.yaml");
        const baselineReceiptPath = join(temp, "baseline-receipt.yaml");
        const pdf = join(temp, "cv.pdf");
        writeFileSync(out, yaml.dump(requirements, { noRefs: true, lineWidth: 120 }), "utf8");
        const trustedBaselineReceipt = issueBaselineReceipt(requirements.baseline.sha256, { frozenAt: requirements.frozenAt, archivedJdSha256: requirements.archivedJd.sha256, issuer: "field-review" });
        writeFileSync(baselineReceiptPath, yaml.dump(trustedBaselineReceipt), "utf8");
        const storedBaselineReceipt: any = yaml.load(readFileSync(baselineReceiptPath, "utf8"));
        const reloaded = loadRequirements(out, { archivedJdPath: jdPath, canon: reviewedCanon, baselineReceiptResolver: (hash) => hash === storedBaselineReceipt.sha256 ? storedBaselineReceipt : undefined });
        expect(reloaded.ok).toBe(true);
        if (!reloaded.ok) throw new Error(reloaded.errors.join("\n"));
        expect(reloaded.data.requirements).toHaveLength(expected.requirements);
        const represented = reloaded.data.requirements.flatMap((item) => [...item.ats.literals.map((literal) => literal.term), ...item.ats.aliases.map((alias) => alias.term)]);
        expect(reviewedTerms.every((term) => field.rejected.includes(term) || represented.some((representedTerm) => representedTerm.toLocaleLowerCase("en-US") === term.toLocaleLowerCase("en-US")))).toBe(true);
        for (const absent of expected.absentLiterals ?? []) expect(represented.map((term) => term.toLocaleLowerCase("en-US"))).not.toContain(absent);
        expect(reloaded.data.requirements.flatMap((item) => item.ats.literals).every((literal) => jdText.slice(literal.source.span.start, literal.source.span.end) === literal.source.quote)).toBe(true);
        expect(reloaded.data.requirements.every((item) => jdText.slice(item.source.span.start, item.source.span.end) === item.source.quote)).toBe(true);
        if (expected.multilineQuote) expect(reloaded.data.requirements.some((item) => item.source.quote.includes("\n"))).toBe(true);
        const fit = analyzeRequirementFit(reloaded.data, reviewedCanon, policy);
        await renderToPdf(join(application, "cv.html"), pdf);
        const ats = analyzeRequirementAts(await extractPdfText(pdf), reloaded.data, 0.8);
        expect(ats.min).toBe(0.8);
        expect(Number(fit.score.toFixed(3))).toBe(expected.fit);
        expect(Number(ats.ratio.toFixed(3))).toBe(expected.ats);
        expect(fit.direct).toHaveLength(expected.direct);
        expect(fit.transferable).toHaveLength(expected.transferable);
        expect(fit.ineligibleEvidence).toHaveLength(expected.ineligibleEvidence);
        expect(fit.materialGaps).toHaveLength(expected.materialGaps);
        expect(reloaded.data.requirements.flatMap((item) => item.ats.literals)).toHaveLength(expected.literals);
        expect(reloaded.data.requirements.flatMap((item) => item.ats.aliases)).toHaveLength(expected.aliases);
        expect(field.rejected).toEqual(expected.rejected);
        expect(fit.verdict).toBe("WEAK");
        expect(fit.eligibilityUncertainties.map((item) => item.id)).toEqual(["req-sponsorship-status"]);
        expect(ats.ok).toBe(false);
        console.log(`FIELD fixture ${index + 1} (${basename(application)}): ${JSON.stringify({ requirements: reloaded.data.requirements.length, reviewedTerms: reviewedTerms.length, literals: reloaded.data.requirements.flatMap((item) => item.ats.literals).length, aliases: reloaded.data.requirements.flatMap((item) => item.ats.aliases).length, rejectedUntraceable: field.rejected, direct: fit.direct.length, transferable: fit.transferable.length, ineligibleEvidence: fit.ineligibleEvidence.length, gaps: fit.materialGaps.length, sponsorshipUncertain: fit.eligibilityUncertainties.length, fit: Number(fit.score.toFixed(3)), fitVerdict: fit.verdict, ats: Number(ats.ratio.toFixed(3)), atsPassAt80: ats.ok })}`);
      });
      expect(existsSync(temp)).toBe(false);
    }, 20_000);
  }

  it("cleans private artifacts when the field body throws", async () => {
    let temp = "";
    await expect(withPrivateTemp("tailored-field-failure-", async (path) => {
      temp = path;
      writeFileSync(join(path, "requirements.yaml"), "private");
      throw new Error("injected failure");
    })).rejects.toThrow("injected failure");
    expect(existsSync(temp)).toBe(false);
  });
});
