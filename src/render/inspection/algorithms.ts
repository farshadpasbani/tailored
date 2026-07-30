/**
 * Owns the pure decisions behind "would a reader see this text?" - colour parsing, sRGB
 * contrast, clipping through an ancestor chain, and painted geometry - as functions over
 * plain numbers and strings, so every answer is testable in Node without a browser.
 *
 * These functions are serialised verbatim into the script Chrome runs inside the page (see
 * source.ts). Keep them self-contained: no imports, no module-scope references other than
 * the constants below, and nothing a browser cannot evaluate.
 */

/** Channels are 0-255 as CSS reports them; alpha is 0-1. */
export type Rgba = readonly [number, number, number, number];
export interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface Bounds { left: number; top: number; right: number; bottom: number }

/** The computed style facts that decide whether an element hides what is under it. */
export interface AncestorStyle {
  display: string;
  visibility: string;
  opacity: string;
  hidden: boolean;
  fontSizePx: number;
  clip: string;
  clipPath: string;
  overflowX: string;
  overflowY: string;
}
/** One element on the path from a text node's parent up to the document element. */
export interface ClipStep { style: AncestorStyle; rect: Rect }

/**
 * Concealment floor, not a readability floor. WCAG AA asks for 4.5:1; this gate only asks
 * whether text was hidden, so it accepts anything a reader could make out and rejects text
 * painted in its own background.
 */
export const MINIMUM_LEGIBLE_CONTRAST = 1.1;
/** A painted fragment thinner than this in either direction leaves no visible ink. */
export const MINIMUM_PAINTED_EXTENT_PX = 0.2;
/** Below half a pixel, glyphs cannot render. */
export const MINIMUM_LEGIBLE_FONT_PX = 0.5;
/** Opacity at or under this is indistinguishable from invisible. */
export const MINIMUM_VISIBLE_OPACITY = 0.01;
/** Ink this transparent paints nothing. */
export const MINIMUM_VISIBLE_ALPHA = 0.01;
/** A backdrop must be this opaque to count as the colour behind the text. */
export const OPAQUE_ALPHA = 0.99;
/** Assumed paper colour when no ancestor paints an opaque background. */
export const ASSUMED_PAPER: Rgba = [255, 255, 255, 1];

/** Collapse every whitespace run to one space, the way rendered text compares. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Read a CSS colour as CSS itself reports one: `rgb()`/`rgba()` channels, optional
 * percentages, and the `transparent` keyword. Returns null when the value carries no
 * colour at all, which the callers treat as "cannot prove it paints".
 */
export function parseCssColor(value: string): Rgba | null {
  if (!value || value === "transparent") return [0, 0, 0, 0];
  const numbers: string[] = value.match(/[\d.]+%?/g) ?? [];
  if (numbers.length < 3) return null;
  const channel = (raw: string): number => (raw.endsWith("%") ? parseFloat(raw) * 2.55 : parseFloat(raw));
  const alpha = numbers[3] === undefined ? 1
    : numbers[3].endsWith("%") ? parseFloat(numbers[3]) / 100
    : parseFloat(numbers[3]);
  return [channel(numbers[0]), channel(numbers[1]), channel(numbers[2]), alpha];
}

/** Relative luminance per the sRGB definition WCAG cites: linearise, then weight by channel. */
export function relativeLuminance(color: Rgba): number {
  const linear = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
}

/** WCAG contrast ratio: (lighter + 0.05) / (darker + 0.05), so it runs from 1:1 to 21:1. */
export function contrastRatio(left: Rgba, right: Rgba): number {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Ink that is missing or all but transparent paints nothing. */
export function isInkPainted(ink: Rgba | null): ink is Rgba {
  return ink !== null && ink[3] >= MINIMUM_VISIBLE_ALPHA;
}

/** True when ink stands out from its backdrop enough to count as not concealed. */
export function isLegibleAgainst(ink: Rgba, backdrop: Rgba): boolean {
  return contrastRatio(ink, backdrop) >= MINIMUM_LEGIBLE_CONTRAST;
}

/**
 * The colour behind the text: the nearest ancestor background opaque enough to stop the
 * paper showing through, taking the ancestors' background colours innermost first.
 */
export function backdropBehind(colors: readonly string[]): Rgba {
  for (const color of colors) {
    const candidate = parseCssColor(color);
    if (candidate && candidate[3] >= OPAQUE_ALPHA) return candidate;
  }
  return ASSUMED_PAPER;
}

/** True when a painted rectangle has area and overlaps the visible window. */
export function rectIntersects(rect: Rect, bounds: Bounds): boolean {
  return rect.width > 0 && rect.height > 0
    && rect.right > bounds.left && rect.bottom > bounds.top
    && rect.left < bounds.right && rect.top < bounds.bottom;
}

/** The fragments of a text run that actually leave ink inside the visible window. */
export function paintedRects(rects: readonly Rect[], bounds: Bounds): Rect[] {
  return rects.filter(rect => rect.width >= MINIMUM_PAINTED_EXTENT_PX
    && rect.height >= MINIMUM_PAINTED_EXTENT_PX
    && rectIntersects(rect, bounds));
}

/** True when this element hides itself and everything inside it outright. */
export function concealsSubtree(style: AncestorStyle): boolean {
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return true;
  if (Number(style.opacity) < MINIMUM_VISIBLE_OPACITY || style.hidden) return true;
  // Written as a refused lower bound so an unreadable font size (NaN) also conceals.
  if (!(style.fontSizePx >= MINIMUM_LEGIBLE_FONT_PX)) return true;
  return (Boolean(style.clip) && style.clip !== "auto") || (Boolean(style.clipPath) && style.clipPath !== "none");
}

/**
 * Walk from a text node's own element out to the document element, narrowing the window it
 * may paint into. Returns null when the chain hides it outright or clips it to nothing -
 * which is how a field disappears with no hidden style anywhere on it.
 */
export function clipBoundsThrough(pageBounds: Bounds, chain: readonly ClipStep[]): Bounds | null {
  const bounds: Bounds = { ...pageBounds };
  for (const { style, rect } of chain) {
    if (concealsSubtree(style)) return null;
    if (!["visible", "unset"].includes(style.overflowX)) {
      bounds.left = Math.max(bounds.left, rect.left);
      bounds.right = Math.min(bounds.right, rect.right);
    }
    if (!["visible", "unset"].includes(style.overflowY)) {
      bounds.top = Math.max(bounds.top, rect.top);
      bounds.bottom = Math.min(bounds.bottom, rect.bottom);
    }
    if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) return null;
  }
  return bounds;
}
