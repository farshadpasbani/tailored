export interface AiTellIssue { rule: string; line: number; index: number; match: string; }
const RULES: { rule: string; re: RegExp }[] = [
  { rule: "em-dash", re: /—/g },
  { rule: "mdash-entity", re: /&mdash;/gi },
  { rule: "double-hyphen-connector", re: / -- /g },
];
export function lintAiTells(text: string): AiTellIssue[] {
  const issues: AiTellIssue[] = [];
  for (const { rule, re } of RULES) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const line = text.slice(0, m.index).split("\n").length;
      issues.push({ rule, line, index: m.index, match: m[0] });
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}
