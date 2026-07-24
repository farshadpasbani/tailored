import { lineAt } from "./text.js";
export interface AiTellIssue { rule: string; line: number; index: number; match: string; }
const RULES: { rule: string; re: RegExp }[] = [
  { rule: "em-dash", re: /—/g },
  { rule: "mdash-entity", re: /&mdash;/gi },
  { rule: "double-hyphen-connector", re: / -- /g },
];
export function lintAiTells(text: string): AiTellIssue[] {
  const issues: AiTellIssue[] = [];
  // Commands and identifiers are prescribed syntax, not prose style. Mask
  // Markdown code while preserving every index and newline for diagnostics.
  const scanned = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, code => code.replace(/[^\n]/g, " "));
  for (const { rule, re } of RULES) {
    re.lastIndex = 0;
    for (let m = re.exec(scanned); m; m = re.exec(scanned)) {
      issues.push({ rule, line: lineAt(text, m.index), index: m.index, match: m[0] });
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}
