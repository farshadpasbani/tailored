import { analyzeImpact, defaultImpactOptions } from "./impact.js";

export interface EditorialResult { ok: false; messages: string[]; }

export function analyzeEditorial(html: string): EditorialResult {
  const impact = analyzeImpact(html, { ...defaultImpactOptions, checkMinFont: false, checkMinMargin: false, checkMinLineHeight: false });
  const messages = ["natural-language: human editorial review required"];
  if (impact.summary && !impact.summary.ok) messages.push(`density: summary has ${impact.summary.words} words (maximum ${defaultImpactOptions.summaryMaxWords})`);
  const longBullets = impact.bullets?.violations.filter(value => value.reason === "over-bound").length ?? 0;
  if (longBullets) messages.push(`density: ${longBullets} bullet${longBullets === 1 ? "" : "s"} exceeds ${defaultImpactOptions.bulletMaxWords} words`);
  const weakBullets = impact.bullets?.violations.filter(value => value.reason === "weak-phrase").length ?? 0;
  if (weakBullets) messages.push(`natural-language: ${weakBullets} bullet${weakBullets === 1 ? "" : "s"} opens with a weak phrase`);
  const skillRows = impact.skills?.violations.length ?? 0;
  if (skillRows) messages.push(`skills/project selection: ${skillRows} skill row${skillRows === 1 ? "" : "s"} exceeds ${defaultImpactOptions.skillMaxWords} words`);
  const undated = impact.dated?.undated.length ?? 0;
  if (undated) messages.push(`skills/project selection: ${undated} project/experience entr${undated === 1 ? "y lacks" : "ies lack"} a year`);
  const repeated = impact.duplicates?.duplicates.length ?? 0;
  if (repeated) messages.push(`natural-language: ${repeated} sentence${repeated === 1 ? " is" : "s are"} repeated`);
  if (impact.contrast && !impact.contrast.ok) messages.push(`natural-language: ${impact.contrast.count} rhetorical contrasts exceed 1`);
  if (impact.person && !impact.person.ok) messages.push("self-reference: first- and third-person candidate voice are mixed");
  return { ok: false, messages: messages.sort() };
}
