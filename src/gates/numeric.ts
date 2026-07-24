import { normalizeNumber } from "./text.js";

export type NumericOccurrenceKind = "number" | "phone" | "date" | "version" | "reference";

export interface NumericOccurrence {
  raw: string;
  index: number;
  end: number;
  kind: NumericOccurrenceKind;
  value?: number;
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").replace(/^440/, "44");
}

export function tokenizeNumericOccurrences(text: string): NumericOccurrence[] {
  const occurrences: NumericOccurrence[] = [];
  const occupied: Array<[number, number]> = [];
  const add = (pattern: RegExp, kind: NumericOccurrenceKind, valueOf?: (raw: string) => number | undefined) => {
    for (const match of text.matchAll(pattern)) {
      const index = match.index;
      const end = index + match[0].length;
      if (occupied.some(([start, stop]) => index < stop && end > start)) continue;
      occupied.push([index, end]);
      const value = valueOf?.(match[0]);
      occurrences.push({ raw: match[0], index, end, kind, ...(value === undefined ? {} : { value }) });
    }
  };
  add(/\b(?:19|20)\d{2}\s*[–—-]\s*(?:Present|(?:19|20)\d{2})\b/gi, "date");
  add(/\b\d{4}-\d{2}-\d{2}\b/g, "date");
  add(/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, "date");
  add(/\+44\s?\(?0?\)?\s?7\d{3}\s?\d{3}\s?\d{3}\b|\+1\s?\d{3}\s?\d{3}\s?\d{4}\b/g, "phone", (raw) => Number(normalizePhone(raw)));
  add(/\b(?:v\d+(?:\.\d+){1,3}|(?:version|release)\s+\d+(?:\.\d+){1,3})\b/gi, "version");
  add(/\b(?:issue|pr|pull request|reference|ref)\s*#?[a-z]*-?\d+\b/gi, "reference");
  add(/[£$€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|bn))?\b|\d+(?:\.\d+)?%|\b\d[\d,]*(?:\.\d+)?[a-z]*\b/gi, "number", (raw) => {
    const direct = normalizeNumber(raw);
    return direct ?? normalizeNumber(raw.replace(/[a-z]+$/i, "")) ?? undefined;
  });
  return occurrences.sort((a, b) => a.index - b.index);
}
