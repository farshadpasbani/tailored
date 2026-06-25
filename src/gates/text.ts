// Shared text helpers for the gates.

/** 1-based line number of the character at `index` within `text`. */
export function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}
