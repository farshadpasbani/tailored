import { describe, it, expect } from "vitest";
import {
  MINIMUM_LEGIBLE_CONTRAST,
  backdropBehind,
  clipBoundsThrough,
  concealsSubtree,
  contrastRatio,
  isInkPainted,
  isLegibleAgainst,
  normalizeWhitespace,
  paintedRects,
  parseCssColor,
  rectIntersects,
  relativeLuminance,
  type AncestorStyle,
  type Bounds,
  type ClipStep,
  type Rect,
  type Rgba,
} from "./algorithms.js";

const rgb = (red: number, green: number, blue: number, alpha = 1): Rgba => [red, green, blue, alpha];
const WHITE = rgb(255, 255, 255);
const BLACK = rgb(0, 0, 0);
const rect = (left: number, top: number, right: number, bottom: number): Rect =>
  ({ left, top, right, bottom, width: right - left, height: bottom - top });
const page = (width: number, height: number): Bounds => ({ left: 0, top: 0, right: width, bottom: height });
const painting = (overrides: Partial<AncestorStyle> = {}): AncestorStyle => ({
  display: "block", visibility: "visible", opacity: "1", hidden: false, fontSizePx: 12,
  clip: "auto", clipPath: "none", overflowX: "visible", overflowY: "visible", ...overrides,
});
const step = (rectangle: Rect, overrides: Partial<AncestorStyle> = {}): ClipStep => ({ style: painting(overrides), rect: rectangle });

// The published WCAG 2.x contrast ratios for these pairs. They come from the standard's own
// formula and worked examples, not from this implementation, so they catch a wrong constant
// or a linearisation mistake that self-consistent output would hide.
describe("contrast ratio against published WCAG values", () => {
  it.each([
    ["black text on white paper is the maximum the standard allows", BLACK, WHITE, 21],
    ["white on white is the minimum", WHITE, WHITE, 1],
    ["#767676 is the darkest grey that still clears WCAG AA on white", rgb(0x76, 0x76, 0x76), WHITE, 4.54],
    ["#949494 grey on white sits on the AA large-text boundary", rgb(0x94, 0x94, 0x94), WHITE, 3.03],
    ["mid grey #808080 on white", rgb(0x80, 0x80, 0x80), WHITE, 3.95],
    ["pure blue on white", rgb(0, 0, 255), WHITE, 8.59],
    ["pure red on white", rgb(255, 0, 0), WHITE, 4.0],
  ])("%s", (_case, ink, backdrop, expected) => {
    expect(contrastRatio(ink, backdrop)).toBeCloseTo(expected, 2);
  });

  it("does not care which colour is named first", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(contrastRatio(WHITE, BLACK), 10);
  });

  it("weights green the most and blue the least, as the sRGB standard specifies", () => {
    expect(relativeLuminance(rgb(0, 255, 0))).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance(rgb(255, 0, 0))).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance(rgb(0, 0, 255))).toBeCloseTo(0.0722, 4);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 10);
  });

  it("uses the standard's linear ramp for very dark channels", () => {
    // Below the 0.04045 kink the transfer function is a straight division by 12.92.
    expect(relativeLuminance(rgb(8, 8, 8))).toBeCloseTo(8 / 255 / 12.92, 10);
  });
});

// The inspector asks "has this text been concealed?", not "is it comfortable to read". Its
// floor is therefore far below WCAG AA: a field only counts as hidden when it is nearly
// invisible against its backdrop.
describe("legibility floor", () => {
  it("calls a white field on white paper concealed", () => {
    expect(isLegibleAgainst(WHITE, WHITE)).toBe(false);
  });

  it("calls a near-white grey field on white paper concealed", () => {
    expect(contrastRatio(rgb(0xfe, 0xfe, 0xfe), WHITE)).toBeLessThan(MINIMUM_LEGIBLE_CONTRAST);
    expect(isLegibleAgainst(rgb(0xfe, 0xfe, 0xfe), WHITE)).toBe(false);
  });

  it("does not call a light grey field concealed just because it fails WCAG AA", () => {
    const lightGrey = rgb(0xcc, 0xcc, 0xcc);
    expect(contrastRatio(lightGrey, WHITE)).toBeLessThan(4.5);
    expect(isLegibleAgainst(lightGrey, WHITE)).toBe(true);
  });

  it("calls black text on a black background concealed", () => {
    expect(isLegibleAgainst(BLACK, BLACK)).toBe(false);
  });
});

describe("ink and backdrop", () => {
  it.each([
    ["a plain rgb triple", "rgb(17, 34, 51)", rgb(17, 34, 51)],
    ["an explicit alpha", "rgba(17, 34, 51, 0.5)", rgb(17, 34, 51, 0.5)],
    ["the transparent keyword", "transparent", rgb(0, 0, 0, 0)],
    ["an unset colour, which paints nothing either", "", rgb(0, 0, 0, 0)],
    ["percentage channels", "rgb(100%, 0%, 50%)", rgb(255, 0, 127.5)],
    ["a percentage alpha", "rgba(0, 0, 0, 50%)", rgb(0, 0, 0, 0.5)],
  ])("reads %s", (_case, value, expected) => {
    const parsed = parseCssColor(value)!;
    expect(parsed).not.toBeNull();
    // Percentage channels scale by 2.55, so compare numerically rather than bit-exactly.
    for (const index of [0, 1, 2, 3]) expect(parsed[index]).toBeCloseTo(expected[index], 6);
  });

  it("cannot read a keyword that carries no channels", () => {
    expect(parseCssColor("none")).toBeNull();
  });

  it("treats fully transparent ink as unpainted, whatever its colour", () => {
    expect(isInkPainted(parseCssColor("rgba(0, 0, 0, 0)"))).toBe(false);
    expect(isInkPainted(parseCssColor("rgb(0, 0, 0)"))).toBe(true);
    expect(isInkPainted(null)).toBe(false);
  });

  it("takes the backdrop from the nearest opaque ancestor", () => {
    expect(backdropBehind(["rgba(0, 0, 0, 0)", "rgb(20, 20, 20)", "rgb(255, 0, 0)"])).toEqual(rgb(20, 20, 20));
  });

  it("assumes white paper when every ancestor is see-through", () => {
    expect(backdropBehind(["rgba(0, 0, 0, 0)", "transparent"])).toEqual(WHITE);
    expect(backdropBehind([])).toEqual(WHITE);
  });

  it("ignores a nearly-transparent tint, because the paper still shows through it", () => {
    expect(backdropBehind(["rgba(0, 0, 0, 0.5)"])).toEqual(WHITE);
  });
});

describe("painted geometry", () => {
  it("counts a field at the very edge of the page as painted", () => {
    const edge = rect(0, 0, 10, 10);
    expect(rectIntersects(edge, page(1240, 1754))).toBe(true);
    expect(paintedRects([edge], page(1240, 1754))).toHaveLength(1);
  });

  it("does not count a field that has been scaled away to nothing", () => {
    expect(paintedRects([rect(10, 10, 10.05, 10.05)], page(1240, 1754))).toHaveLength(0);
  });

  it("does not count a field pushed off the page by a negative indent", () => {
    expect(rectIntersects(rect(-10_000, 10, -9_900, 24), page(1240, 1754))).toBe(false);
  });

  it("does not count a field that only touches the clip edge without crossing it", () => {
    expect(rectIntersects(rect(100, 10, 200, 24), { left: 200, top: 0, right: 400, bottom: 100 })).toBe(false);
  });

  it("keeps only the fragments of a multi-line field that fall inside the clip", () => {
    const bounds = { left: 0, top: 0, right: 400, bottom: 30 };
    const lines = [rect(0, 0, 100, 14), rect(0, 40, 100, 54)];
    expect(paintedRects(lines, bounds)).toEqual([lines[0]]);
  });
});

describe("what an ancestor chain can hide", () => {
  it.each([
    ["display: none", { display: "none" }],
    ["visibility: hidden", { visibility: "hidden" }],
    ["visibility: collapse", { visibility: "collapse" }],
    ["a transparent opacity", { opacity: "0" }],
    ["the hidden attribute", { hidden: true }],
    ["a font too small to leave ink", { fontSizePx: 0.4 }],
    ["an unreadable font size", { fontSizePx: Number.NaN }],
    ["a legacy clip rectangle", { clip: "rect(0px, 0px, 0px, 0px)" }],
    ["a clip-path", { clipPath: "inset(100%)" }],
  ])("conceals everything below it when it has %s", (_case, overrides) => {
    expect(concealsSubtree(painting(overrides))).toBe(true);
    expect(clipBoundsThrough(page(1240, 1754), [step(rect(0, 0, 100, 20), overrides)])).toBeNull();
  });

  it("hides nothing when it simply paints normally", () => {
    expect(concealsSubtree(painting())).toBe(false);
    expect(clipBoundsThrough(page(1240, 1754), [step(rect(0, 0, 100, 20))])).toEqual(page(1240, 1754));
  });

  it("narrows the visible window to a scrolling ancestor's box", () => {
    const chain = [step(rect(20, 20, 120, 40)), step(rect(0, 0, 200, 100), { overflowX: "hidden", overflowY: "hidden" })];
    expect(clipBoundsThrough(page(1240, 1754), chain)).toEqual({ left: 0, top: 0, right: 200, bottom: 100 });
  });

  it("only narrows the axis the ancestor actually clips", () => {
    const chain = [step(rect(0, 0, 50, 50)), step(rect(10, 10, 60, 60), { overflowY: "hidden" })];
    expect(clipBoundsThrough(page(1240, 1754), chain)).toEqual({ left: 0, top: 10, right: 1240, bottom: 60 });
  });

  it("calls a field clipped away by nested overflow boxes invisible", () => {
    // The inner box scrolls its content out of the outer box's window, and the two windows
    // no longer overlap - which is how a field is hidden without any hidden style on it.
    const chain = [
      step(rect(500, 500, 600, 520)),
      step(rect(400, 400, 700, 700), { overflowX: "hidden", overflowY: "hidden" }),
      step(rect(0, 0, 300, 300), { overflowX: "hidden", overflowY: "hidden" }),
    ];
    expect(clipBoundsThrough(page(1240, 1754), chain)).toBeNull();
  });

  it("keeps a field visible when the nested boxes still overlap", () => {
    const chain = [
      step(rect(120, 120, 200, 140)),
      step(rect(100, 100, 400, 400), { overflowX: "hidden", overflowY: "hidden" }),
      step(rect(0, 0, 300, 300), { overflowX: "hidden", overflowY: "hidden" }),
    ];
    expect(clipBoundsThrough(page(1240, 1754), chain)).toEqual({ left: 100, top: 100, right: 300, bottom: 300 });
  });

  it("never widens the window beyond the page, even for an oversized ancestor", () => {
    const chain = [step(rect(0, 0, 10, 10)), step(rect(-500, -500, 5000, 5000), { overflowX: "hidden", overflowY: "hidden" })];
    expect(clipBoundsThrough(page(1240, 1754), chain)).toEqual(page(1240, 1754));
  });

  it("treats unset overflow as no clip at all", () => {
    const chain = [step(rect(0, 0, 10, 10)), step(rect(0, 0, 5, 5), { overflowX: "unset", overflowY: "unset" })];
    expect(clipBoundsThrough(page(1240, 1754), chain)).toEqual(page(1240, 1754));
  });
});

describe("text normalisation", () => {
  it.each([
    ["collapses runs of whitespace", "  two   words \n more ", "two words more"],
    ["leaves single-spaced text alone", "already tidy", "already tidy"],
    ["reduces whitespace-only text to nothing", " \n\t ", ""],
  ])("%s", (_case, value, expected) => {
    expect(normalizeWhitespace(value)).toBe(expected);
  });
});
