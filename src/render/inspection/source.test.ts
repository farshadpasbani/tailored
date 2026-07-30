import { describe, it, expect } from "vitest";
import * as algorithms from "./algorithms.js";
import { DOM_SHELL_SOURCE, INJECTED_ALGORITHM_NAMES, buildInspectionSource, injectedAlgorithmSource } from "./source.js";

/** The algorithm half of the injected script, evaluated exactly as the browser would. */
const inPage = new Function(`${injectedAlgorithmSource()}\nreturn { ${INJECTED_ALGORITHM_NAMES.join(", ")} };`)() as Record<string, any>;

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({ left, top, right, bottom, width: right - left, height: bottom - top });
const painting = (overrides: Record<string, unknown> = {}) => ({
  display: "block", visibility: "visible", opacity: "1", hidden: false, fontSizePx: 12,
  clip: "auto", clipPath: "none", overflowX: "visible", overflowY: "visible", ...overrides,
});
const PAGE = { left: 0, top: 0, right: 1240, bottom: 1754 };

describe("the copy of the algorithms that reaches the browser", () => {
  it("binds every constant to the same value the typed module declares", () => {
    for (const name of ["MINIMUM_LEGIBLE_CONTRAST", "MINIMUM_PAINTED_EXTENT_PX", "MINIMUM_LEGIBLE_FONT_PX", "MINIMUM_VISIBLE_OPACITY", "MINIMUM_VISIBLE_ALPHA", "OPAQUE_ALPHA", "ASSUMED_PAPER"])
      expect(inPage[name], name).toEqual((algorithms as Record<string, any>)[name]);
  });

  it.each([
    ["black on white", "rgb(0, 0, 0)", "rgb(255, 255, 255)"],
    ["white on white", "rgb(255, 255, 255)", "rgb(255, 255, 255)"],
    ["grey on white", "rgb(118, 118, 118)", "rgb(255, 255, 255)"],
    ["transparent ink", "rgba(0, 0, 0, 0)", "rgb(255, 255, 255)"],
    ["percentage channels", "rgb(100%, 20%, 0%)", "rgb(0, 0, 0)"],
  ])("agrees on contrast and legibility for %s", (_case, ink, backdrop) => {
    const parsedInk = algorithms.parseCssColor(ink)!;
    const parsedBackdrop = algorithms.parseCssColor(backdrop)!;
    expect(inPage.parseCssColor(ink)).toEqual(parsedInk);
    expect(inPage.contrastRatio(parsedInk, parsedBackdrop)).toBe(algorithms.contrastRatio(parsedInk, parsedBackdrop));
    expect(inPage.isLegibleAgainst(parsedInk, parsedBackdrop)).toBe(algorithms.isLegibleAgainst(parsedInk, parsedBackdrop));
    expect(inPage.isInkPainted(parsedInk)).toBe(algorithms.isInkPainted(parsedInk));
  });

  it.each([
    ["a plainly painted field", [{ style: painting(), rect: rect(0, 0, 100, 20) }]],
    ["a field hidden by its own style", [{ style: painting({ display: "none" }), rect: rect(0, 0, 100, 20) }]],
    ["a field clipped away by nested overflow", [
      { style: painting(), rect: rect(500, 500, 600, 520) },
      { style: painting({ overflowX: "hidden", overflowY: "hidden" }), rect: rect(0, 0, 300, 300) },
    ]],
    ["a field at the page edge", [{ style: painting(), rect: rect(0, 0, 4, 4) }]],
  ])("agrees on the clipped window for %s", (_case, chain) => {
    expect(inPage.clipBoundsThrough(PAGE, chain)).toEqual(algorithms.clipBoundsThrough(PAGE, chain as any));
    expect(inPage.concealsSubtree(chain[0].style)).toBe(algorithms.concealsSubtree(chain[0].style as any));
  });

  it("agrees on painted geometry and the assumed backdrop", () => {
    const rects = [rect(0, 0, 100, 14), rect(0, 40, 100, 54), rect(10, 10, 10.05, 10.05)];
    expect(inPage.paintedRects(rects, PAGE)).toEqual(algorithms.paintedRects(rects, PAGE));
    expect(inPage.rectIntersects(rects[0], PAGE)).toBe(algorithms.rectIntersects(rects[0], PAGE));
    const colors = ["rgba(0, 0, 0, 0)", "rgb(20, 20, 20)"];
    expect(inPage.backdropBehind(colors)).toEqual(algorithms.backdropBehind(colors));
    expect(inPage.backdropBehind([])).toEqual(algorithms.backdropBehind([]));
    expect(inPage.normalizeWhitespace("  a  b \n")).toBe(algorithms.normalizeWhitespace("  a  b \n"));
  });
});

describe("the DOM-reading shell", () => {
  it("carries no arithmetic of its own: the sRGB and contrast constants live only in the algorithms", () => {
    for (const constant of ["0.2126", ".2126", "0.7152", ".7152", "0.0722", ".0722", "0.04045", ".04045", "12.92", "1.055", "2.4", "0.05"])
      expect(DOM_SHELL_SOURCE, constant).not.toContain(constant);
    expect(DOM_SHELL_SOURCE).not.toContain("**");
    // The visibility thresholds are named constants in the algorithms, so no bare floor
    // survives in the shell either.
    for (const threshold of ["1.1", "0.2", ".2 ", "0.99", "0.01"]) expect(DOM_SHELL_SOURCE, threshold).not.toContain(threshold);
  });

  it("calls only algorithms that were serialised alongside it", () => {
    const bound = new Set(INJECTED_ALGORITHM_NAMES);
    for (const name of Object.keys(algorithms)) {
      if (bound.has(name)) continue;
      expect(DOM_SHELL_SOURCE, `${name} is used but not injected`).not.toMatch(new RegExp(`\\b${name}\\s*\\(`));
    }
    for (const name of INJECTED_ALGORITHM_NAMES) expect(injectedAlgorithmSource()).toContain(`const ${name} =`);
  });

  it("keeps the binding names the shell was written against", () => {
    // A toolchain that renamed these would leave the shell calling names nothing defines,
    // and the only symptom would be a browser that never reports evidence.
    expect([...INJECTED_ALGORITHM_NAMES].sort()).toEqual([
      "ASSUMED_PAPER", "MINIMUM_LEGIBLE_CONTRAST", "MINIMUM_LEGIBLE_FONT_PX", "MINIMUM_PAINTED_EXTENT_PX",
      "MINIMUM_VISIBLE_ALPHA", "MINIMUM_VISIBLE_OPACITY", "OPAQUE_ALPHA",
      "backdropBehind", "clipBoundsThrough", "concealsSubtree", "contrastRatio", "isInkPainted",
      "isLegibleAgainst", "normalizeWhitespace", "paintedRects", "parseCssColor", "rectIntersects", "relativeLuminance",
    ]);
  });

  it("produces one parseable script that publishes exactly one global", () => {
    const source = buildInspectionSource();
    expect(() => new Function(source)).not.toThrow();
    expect(source.match(/window\.__TAILORED_[A-Z_]+/g)).toEqual(["window.__TAILORED_EVIDENCE__"]);
  });
});
