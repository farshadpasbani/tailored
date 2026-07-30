import {
  ASSUMED_PAPER, MINIMUM_LEGIBLE_CONTRAST, MINIMUM_LEGIBLE_FONT_PX, MINIMUM_PAINTED_EXTENT_PX,
  MINIMUM_VISIBLE_ALPHA, MINIMUM_VISIBLE_OPACITY, OPAQUE_ALPHA,
  backdropBehind, clipBoundsThrough, concealsSubtree, contrastRatio, isInkPainted, isLegibleAgainst,
  normalizeWhitespace, paintedRects, parseCssColor, rectIntersects, relativeLuminance,
} from "./algorithms.js";

/**
 * Owns the one script Chrome runs inside the page: the typed algorithms above, serialised
 * verbatim, plus a shell that does nothing but read the DOM and hand plain data to them.
 * The shell holds no arithmetic, so the decisions it reports are the ones unit-tested in
 * Node - the browser only supplies styles, rectangles and text.
 */

/** Serialised into the page. Order matters only in that every callee must be bound first. */
const INJECTED_FUNCTIONS = [
  normalizeWhitespace, parseCssColor, relativeLuminance, contrastRatio, isInkPainted,
  isLegibleAgainst, backdropBehind, rectIntersects, paintedRects, concealsSubtree, clipBoundsThrough,
];

const INJECTED_CONSTANTS: Record<string, unknown> = {
  MINIMUM_LEGIBLE_CONTRAST, MINIMUM_PAINTED_EXTENT_PX, MINIMUM_LEGIBLE_FONT_PX,
  MINIMUM_VISIBLE_OPACITY, MINIMUM_VISIBLE_ALPHA, OPAQUE_ALPHA, ASSUMED_PAPER,
};

/**
 * The algorithm half of the injected script: every constant and function above, bound under
 * its own name. Exported so a Node test can evaluate this exact text and confirm the copy
 * that reaches the browser still answers like the typed originals.
 */
export function injectedAlgorithmSource(): string {
  const constants = Object.entries(INJECTED_CONSTANTS).map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`);
  const functions = INJECTED_FUNCTIONS.map(fn => `const ${fn.name} = ${fn.toString()};`);
  return [...constants, ...functions].join("\n");
}

/** The names the shell below is entitled to call. A drift here would only show up in a browser. */
export const INJECTED_ALGORITHM_NAMES: readonly string[] = [
  ...Object.keys(INJECTED_CONSTANTS),
  ...INJECTED_FUNCTIONS.map(fn => fn.name),
];

/**
 * Reads the DOM and reports it. Every judgement is delegated: this shell decides only which
 * elements and text nodes to ask about, never whether one is visible.
 */
const DOM_WALK_SHELL = String.raw`
window.addEventListener("load", () => {
  document.fonts.ready.then(() => setTimeout(() => {
    const pageBounds = () => {
      const root = document.documentElement;
      return { left: 0, top: 0, right: root.clientWidth, bottom: Math.max(root.clientHeight, root.scrollHeight) };
    };
    // The element itself, then every ancestor up to the document element: what each one
    // paints like, and the box it would clip to.
    const clipChain = element => {
      const chain = [];
      for (let node = element; node instanceof Element; node = node.parentElement) {
        const style = getComputedStyle(node);
        chain.push({
          style: {
            display: style.display, visibility: style.visibility, opacity: style.opacity,
            hidden: node.hasAttribute("hidden"), fontSizePx: parseFloat(style.fontSize),
            clip: style.clip, clipPath: style.clipPath,
            overflowX: style.overflowX, overflowY: style.overflowY,
          },
          rect: node.getBoundingClientRect(),
        });
      }
      return chain;
    };
    const paintingBounds = element => clipBoundsThrough(pageBounds(), clipChain(element));
    const backgroundColors = element => {
      const colors = [];
      for (let node = element; node; node = node.parentElement) colors.push(getComputedStyle(node).backgroundColor);
      return colors;
    };
    const textNodesIn = element => {
      const nodes = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) if (normalizeWhitespace(walker.currentNode.textContent ?? "")) nodes.push(walker.currentNode);
      return nodes;
    };
    const paintsText = node => {
      const element = node.parentElement;
      if (!element || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const bounds = paintingBounds(element);
      if (!bounds) return false;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (!paintedRects([...range.getClientRects()], bounds).length) return false;
      const style = getComputedStyle(element);
      const ink = parseCssColor(style.webkitTextFillColor || style.color);
      if (!isInkPainted(ink)) return false;
      return isLegibleAgainst(ink, backdropBehind(backgroundColors(element)));
    };
    // An element is painted when all of its text is; an element with no text of its own
    // counts if its own box leaves ink.
    const paints = element => {
      const nodes = textNodesIn(element);
      if (nodes.length) return nodes.every(paintsText);
      const bounds = paintingBounds(element);
      return Boolean(bounds && paintedRects([...element.getClientRects()], bounds).length);
    };
    // An opaque debug locator: enough for a human reading a gate message to find the field,
    // never a contract. Callers must not parse it.
    const locatorFor = element => {
      const parts = [];
      for (let node = element; node; node = node.parentElement) {
        const siblings = node.parentElement ? [...node.parentElement.children].filter(candidate => candidate.tagName === node.tagName) : [];
        parts.unshift(node.tagName.toLowerCase() + (siblings.length > 1 ? ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")" : ""));
      }
      return parts.join(" > ");
    };
    const groupToken = element => String([...document.querySelectorAll("*")].indexOf(element));

    const allText = normalizeWhitespace(document.body.innerText);
    const entries = () => [...document.querySelectorAll("[data-canon-entry]")];
    const entryFacts = element => {
      const entry = element.closest("[data-canon-entry]");
      if (!entry) return {};
      return {
        entryPath: entry.dataset.canonEntry,
        entryVisible: paints(entry),
        entryCount: entries().filter(candidate => candidate.dataset.canonEntry === entry.dataset.canonEntry).length,
      };
    };

    const markers = [...document.querySelectorAll("[data-canon-source]")].map((element, index) => {
      const meta = element.closest(".meta");
      const context = element.closest(".eh, .two");
      // Where the marker's text sits in the reading order, measured by planting a sentinel
      // in the rendered text and reading back how much text precedes it.
      const sentinel = "TAILOREDSOURCE" + String.fromCharCode(65 + index) + "MARKER";
      const node = document.createTextNode(sentinel);
      element.before(node);
      const withSentinel = normalizeWhitespace(document.body.innerText);
      const at = withSentinel.indexOf(sentinel);
      node.remove();
      const before = at < 0 ? "" : withSentinel.slice(0, at);
      return {
        path: element.dataset.canonSource,
        tag: element.tagName.toLowerCase(),
        classes: [...element.classList],
        text: normalizeWhitespace(element.innerText),
        visible: paints(element),
        textBefore: before,
        offset: before.length,
        ...entryFacts(element),
        metaGroup: meta ? String([...document.querySelectorAll(".meta")].indexOf(meta)) : undefined,
        metaText: meta ? normalizeWhitespace(meta.innerText) : undefined,
        contextGroup: context ? groupToken(context) : undefined,
      };
    });

    const owners = [...document.querySelectorAll("[data-canon-owner]")].map(element => {
      const parent = element.parentElement;
      const context = parent ? parent.closest(".eh, .two") : null;
      return {
        path: element.dataset.canonOwner,
        tag: element.tagName.toLowerCase(),
        classes: [...element.classList],
        text: normalizeWhitespace(element.innerText),
        visible: paints(element),
        ...entryFacts(element),
        parentTag: parent ? parent.tagName.toLowerCase() : undefined,
        parentClasses: parent ? [...parent.classList] : undefined,
        parentGroup: parent ? groupToken(parent) : undefined,
        contextClasses: context ? [...context.classList] : undefined,
        contextGroup: context ? groupToken(context) : undefined,
      };
    });

    const claims = [...document.querySelectorAll("[data-claim-id]")].map(element => ({
      id: element.dataset.claimId ?? "",
      subject: element.dataset.claimSubject ?? "",
      authority: element.dataset.claimAuthority ?? "",
      text: normalizeWhitespace(element.innerText),
      visible: paints(element),
    }));

    const textUnits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = normalizeWhitespace(node.textContent ?? "");
      const parent = node.parentElement;
      if (!text || !parent || ["script", "style", "template", "noscript"].includes(parent.tagName.toLowerCase())) continue;
      const owning = attribute => [...parent.closest("body").querySelectorAll("[" + attribute + "]")]
        .filter(element => element.contains(node));
      textUnits.push({
        locator: locatorFor(parent),
        tag: parent.tagName.toLowerCase(),
        text,
        visible: paintsText(node),
        claimIds: owning("data-claim-id").map(element => element.dataset.claimId ?? ""),
        structuralReasons: owning("data-nonfactual-reason").map(element => element.dataset.nonfactualReason ?? ""),
      });
    }

    const generatedContent = [];
    for (const element of document.body.querySelectorAll("*")) {
      for (const pseudo of ["::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        const raw = style.content;
        if (!raw || raw === "none" || raw === "normal" || style.display === "none") continue;
        const text = normalizeWhitespace(raw.replace(/^(["'])(.*)\1$/, "$2"));
        if (text) generatedContent.push({ locator: locatorFor(element) + pseudo, text, visible: paints(element) });
      }
    }

    window.__TAILORED_EVIDENCE__ = { text: allText, markers, owners, claims, textUnits, generatedContent };
  }, 0));
}, { once: true });
`;

/**
 * The complete script Chrome evaluates on the inspected document. Wrapped so the algorithm
 * bindings stay private to it and the page sees only `window.__TAILORED_EVIDENCE__`.
 */
export function buildInspectionSource(): string {
  return `(() => {\n${injectedAlgorithmSource()}\n${DOM_WALK_SHELL}\n})();`;
}

/** The DOM-reading half on its own. Exported so a test can prove it holds no arithmetic. */
export const DOM_SHELL_SOURCE = DOM_WALK_SHELL;
