import { readFileSync } from "node:fs";
import { GateInputError, type Gate } from "./gate.js";
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

export const aiTellGate: Gate = {
  id: "ai-tell",
  severity: "advisory",
  run: async input => {
    const issues = input.artifacts.flatMap(artifact => lintAiTells(artifact.html));
    return { id: "ai-tell", ok: issues.length === 0, messages: issues.map(issue => `${issue.rule} at line ${issue.line}`) };
  },
  command: {
    name: "lint",
    description: "scan files for AI tells (em dashes, -- connectors, &mdash; entities)",
    arguments: [{ name: "<files...>", description: "files to lint" }],
    options: [],
    run: async args => {
      const files = args[0] as string[];
      const messages: string[] = [];
      for (const file of files) {
        let content: string;
        try { content = readFileSync(file, "utf8"); }
        catch (error) { throw new GateInputError(`cannot read ${file}: ${(error as Error).message}`, messages); }
        for (const issue of lintAiTells(content)) messages.push(`${file}:${issue.line}: ${issue.rule} (${JSON.stringify(issue.match)})`);
      }
      const ok = messages.length === 0;
      return {
        id: "ai-tell", ok, messages,
        summary: ok ? `${files.length} file(s) clean of AI tells` : `${messages.length} AI tell(s) found across ${files.length} file(s)`,
      };
    },
  },
};
