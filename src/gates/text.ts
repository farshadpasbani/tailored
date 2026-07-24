// Shared text helpers for the gates.
import { htmlFragmentToText } from "../evidence/html.js";

/** 1-based line number of the character at `index` within `text`. */
export function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** Rendered text of an HTML document: drops tags, style/script contents, and decodes entities. */
export function htmlToText(html: string): string {
  return htmlFragmentToText(html);
}

const MAGNITUDE: Record<string, number> = { k: 1_000, m: 1_000_000, bn: 1_000_000_000 };

/**
 * Canonical numeric value of a claim, so equivalent forms compare equal:
 * "40%" and "40" are both 40; "£1.2m" and "1200000" are both 1200000.
 * Strips currency symbols, percent signs, and thousands separators, and
 * expands a trailing k/m/bn magnitude suffix. Returns null if unparsable.
 */
export function normalizeNumber(raw: string): number | null {
  const m = raw.trim().match(/^[£$€]?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|bn)?\s*%?$/i);
  if (!m) return null;
  const base = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(base)) return null;
  const mag = m[2] ? MAGNITUDE[m[2].toLowerCase()] : 1;
  return base * mag;
}

/** Count whitespace-separated words in `text`. */
export function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}
