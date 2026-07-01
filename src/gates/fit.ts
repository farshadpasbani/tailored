import type { Canon } from "../canon/schema.js";
import type { Jd } from "../jd/schema.js";
import { keywordCoverage } from "./ats.js";

export type FitVerdict = "APPLY" | "APPLY-WITH-GAPS" | "SKIP";

/** Flatten a canon's textual content (summary, skills, projects, experience,
 * education, certifications, publications, claims) into one searchable string,
 * so a keyword-coverage matcher can be run against it. */
export function canonToText(canon: Canon): string {
  const parts: string[] = [];
  if (canon.summary) parts.push(canon.summary);
  for (const s of canon.skills) parts.push(`${s.label} ${s.value}`);
  for (const p of canon.projects) parts.push([p.name, p.tagline, ...p.bullets].filter(Boolean).join(" "));
  for (const e of canon.experience) parts.push([e.title, e.org, ...e.bullets].join(" "));
  for (const e of canon.education) parts.push([e.qualification, e.institution, e.note].filter(Boolean).join(" "));
  parts.push(...canon.certifications, ...canon.publications);
  if (canon.claims?.can) parts.push(...canon.claims.can);
  return parts.join("\n");
}

/** Triage a jd against a canon's flattened text: must-have coverage against the
 * canon's full text (reusing the ats gate's synonym-aware matcher) decides the
 * verdict; nice-to-have is reported but never changes it. */
export function analyzeFit(canonText: string, jd: Jd, opts: { apply: number; floor: number }) {
  const must = keywordCoverage(canonText, jd.mustHave, jd.synonyms);
  const nice = keywordCoverage(canonText, jd.niceToHave, jd.synonyms);
  const verdict: FitVerdict = must.ratio >= opts.apply ? "APPLY" : must.ratio < opts.floor ? "SKIP" : "APPLY-WITH-GAPS";
  return { verdict, must, nice, apply: opts.apply, floor: opts.floor };
}

/** Returns an error message if `floor` exceeds `apply` (an incoherent threshold pair), else undefined. */
export function validateThresholds(apply: number, floor: number): string | undefined {
  if (floor > apply) return `--floor (${floor}) must not exceed --apply (${apply})`;
  return undefined;
}
