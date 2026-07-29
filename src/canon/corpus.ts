// The one canon-to-text projection. Three gates used to flatten a canon their own way
// (fit's canonToText, trace's canonCorpus, distinct composing the first with extra identity
// fields), so the same fact was evidence to one gate and invisible to another. This module
// is the union of what those readers took, and the only flattening the gate layer has.

import type { Canon } from "./schema.js";

/**
 * Exactly the canon fields the projection carries, as dotted paths. It is documentation with
 * a test behind it: widening the corpus widens what a numeric claim may trace to, so the set
 * is declared here rather than left to be reverse-engineered from the code below.
 *
 * Deliberately absent: `facts`, `numbersThatStand`, `talkingPoints`, `positioning`,
 * `protectedTopics`, `ipBoundaries`, `discretion`, `draftingGuidance`, `verifiedFacts`, and
 * `projects[].year` - no previous reader took them. `facts` and `numbersThatStand` are the
 * load-bearing exclusions: they carry approved figures, and admitting them would let the
 * trace gate declare a number grounded because the canon aspires to it somewhere, which is
 * the claim-integrity gate's job, against an evidence file, not a keyword sweep's.
 * Rendered link URLs and per-entry locations are absent for the same reason - a digit inside
 * a URL is not evidence for a claim. The distinct gate adds those two back for its own
 * exemption corpus (see gates/distinct.ts) where nothing is being proved true.
 */
export const CANON_CORPUS_FIELDS: readonly string[] = [
  "identity.name", "identity.role", "identity.location", "identity.email", "identity.phone",
  "summary",
  "skills.label", "skills.value",
  "projects.name", "projects.tagline", "projects.bullets",
  "experience.title", "experience.org", "experience.start", "experience.end", "experience.bullets",
  "education.qualification", "education.institution", "education.year", "education.result", "education.note",
  "certifications", "publications",
  "claims.can",
];

/**
 * Every fact-bearing text field of a canon, one entry per line: what a keyword matcher
 * searches, what a numeric claim traces to, and what an anti-template exemption is measured
 * against. Callers normalise whitespace before matching, so the line breaks are for reading,
 * not tokenisation - what matters is that no two fields are glued into one word.
 */
export function canonCorpus(canon: Canon): string {
  const parts: string[] = [
    canon.identity.name, canon.identity.role,
    canon.identity.location ?? "", canon.identity.email ?? "", canon.identity.phone ?? "",
  ];
  if (canon.summary) parts.push(canon.summary);
  for (const skill of canon.skills) parts.push(`${skill.label} ${skill.value}`);
  for (const project of canon.projects) parts.push([project.name, project.tagline, ...project.bullets].filter(Boolean).join(" "));
  for (const job of canon.experience) parts.push([job.title, job.org, job.start, job.end, ...job.bullets].filter(Boolean).join(" "));
  for (const course of canon.education) parts.push([course.qualification, course.institution, course.year, course.result, course.note].filter(Boolean).join(" "));
  parts.push(...canon.certifications, ...canon.publications);
  if (canon.claims?.can) parts.push(...canon.claims.can);
  return parts.filter(Boolean).join("\n");
}
