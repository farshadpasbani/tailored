import type { LegacyJd } from "../jd/schema.js";
import { issueBaselineReceipt, prepareRequirementsBaseline, RequirementsSchema, sha256Text, type Requirement, type Requirements } from "./schema.js";

function slug(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "requirement";
}

/** Converts a legacy keyword list into a frozen v2 record without fabricating
 * evidence. Every migrated requirement starts as an explicit gap for a human to map. */
export function migrateLegacyJdToRequirements(
  jd: LegacyJd,
  options: { archivedJdText: string; frozenAt: string; baselineIssuer: string },
): Requirements {
  const used = new Map<string, number>();
  const convert = (term: string, classification: "hard" | "preferred", index: number): Requirement => {
    const candidates = [term, ...(jd.synonyms[term] ?? [])];
    let sourceMatch: { quote: string; line: number; offset: number } | undefined;
    for (const candidate of candidates) {
      const offset = options.archivedJdText.toLocaleLowerCase("en-US").indexOf(candidate.toLocaleLowerCase("en-US"));
      if (offset >= 0) {
        sourceMatch = { quote: options.archivedJdText.slice(offset, offset + candidate.length), line: options.archivedJdText.slice(0, offset).split("\n").length, offset };
        break;
      }
    }
    if (!sourceMatch) throw new Error(`Legacy term ${JSON.stringify(term)} is not present in the archived JD and cannot be frozen as a source quote`);
    const base = `req-${slug(term)}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return {
      id: count === 1 ? base : `${base}-${count}`,
      source: { quote: sourceMatch.quote, location: `archived JD line ${sourceMatch.line}; legacy jd.yaml ${classification === "hard" ? "mustHave" : "niceToHave"}[${index}]`, span: { start: sourceMatch.offset, end: sourceMatch.offset + sourceMatch.quote.length } },
      classification: { frozen: classification, current: classification },
      weight: classification === "hard" ? 3 : 1,
      eligibilityImpact: "none",
      ats: {
        literals: [{ term: sourceMatch.quote, source: { quote: sourceMatch.quote, location: `archived JD line ${sourceMatch.line}`, span: { start: sourceMatch.offset, end: sourceMatch.offset + sourceMatch.quote.length } } }],
        aliases: [term, ...(jd.synonyms[term] ?? [])].filter((alias) => alias.toLocaleLowerCase("en-US") !== sourceMatch.quote.toLocaleLowerCase("en-US")).map((alias) => ({ term: alias, forLiteral: sourceMatch.quote, reason: "Reviewed legacy jd.yaml alias; excluded from literal ATS authority by default" })),
      },
      evidence: { kind: "gap", note: "Legacy migration: map this requirement to canon fact IDs or record a dated waiver" },
    };
  };
  const requirements = [
    ...jd.mustHave.map((term, index) => convert(term, "hard", index)),
    ...jd.niceToHave.map((term, index) => convert(term, "preferred", index)),
  ];
  const prepared = prepareRequirementsBaseline(requirements);
  const receipt = issueBaselineReceipt(prepared.sha256, { frozenAt: options.frozenAt, archivedJdSha256: sha256Text(options.archivedJdText), issuer: options.baselineIssuer });
  return RequirementsSchema.parse({
    schemaVersion: 2,
    role: jd.role,
    ...(jd.company ? { company: jd.company } : {}),
    archivedJd: { sha256: sha256Text(options.archivedJdText) },
    frozenAt: options.frozenAt,
    requirements,
    baseline: { ...prepared, receiptSha256: receipt.sha256 },
    changes: [],
  });
}
