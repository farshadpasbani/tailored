export const PROHIBITION_CONCEPTS = [
  "openai-api",
  "aws-production",
  "ansys-hands-on",
  "engineering-sign-off",
  "chartership",
  "database-production",
  "langchain-delivery",
  "audio-video-experience",
  "ai-tenure",
  "internal-ip",
] as const;

export type ProhibitionConcept = typeof PROHIBITION_CONCEPTS[number];

const POLICY_PATTERNS: Array<[ProhibitionConcept, RegExp]> = [
  ["openai-api", /\b(?:open ?ai|azure open ?ai|xai)\b[\s\S]*\b(?:apis?|sdks?|integrations?)\b|\b(?:apis?|sdks?)\b[\s\S]*\bopen ?ai\b/i],
  ["aws-production", /\b(?:aws|amazon web services)\b/i],
  ["ansys-hands-on", /\bansys\b/i],
  ["engineering-sign-off", /\b(?:sign[ -]?off|approve|certif(?:y|ied)|authority)\b/i],
  ["chartership", /\b(?:chartership|chartered engineer|ceng|ieng|engtech)\b/i],
  ["database-production", /\b(?:postgres(?:ql)?|mysql|database|relational[- ]db)\b/i],
  ["langchain-delivery", /\b(?:langchain|langgraph)\b/i],
  ["audio-video-experience", /\b(?:audio|video|speech[- ]to[- ]text|multimodal)\b/i],
  ["ai-tenure", /\b(?:total years|years of experience|career length|nine years|seven years)\b/i],
  ["internal-ip", /\b(?:internal|proprietary|employer ip|client names?|employer tool)\b/i],
];

export function classifyProhibition(statement: string): ProhibitionConcept[] {
  return POLICY_PATTERNS
    .filter(([, pattern]) => pattern.test(statement))
    .map(([concept]) => concept);
}
