import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";
const MATH_NS = "http://www.w3.org/1998/Math/MathML";

const HTML_ELEMENTS = new Set([
  "html", "head", "body", "title", "meta", "style", "link",
  "address", "article", "aside", "blockquote", "br", "caption", "code", "col", "colgroup",
  "dd", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "i", "b", "img", "li", "main", "nav", "ol", "p", "picture", "pre", "section", "small",
  "source", "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "a",
]);
const SVG_ELEMENTS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc"]);
const MATH_ELEMENTS = new Set(["math", "mi", "mn", "mo", "mrow", "mtext", "msup", "msub", "mfrac"]);
const ACTIVE_ELEMENTS = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "portal", "base", "foreignObject", "annotation-xml"]);
const COMMON_ATTRIBUTES = new Set(["id", "class", "style", "title", "lang", "dir", "role", "hidden"]);
const ELEMENT_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  source: new Set(["src", "srcset", "type", "media"]),
  link: new Set(["href", "rel", "media", "type"]),
  meta: new Set(["charset", "name", "content", "http-equiv"]),
  td: new Set(["colspan", "rowspan"]), th: new Set(["colspan", "rowspan", "scope"]),
  col: new Set(["span"]), colgroup: new Set(["span"]),
  svg: new Set(["viewbox", "width", "height", "xmlns"]),
  path: new Set(["d", "fill", "stroke", "stroke-width"]),
};
const URL_ATTRIBUTES = new Set(["href", "src", "srcset", "action", "formaction", "poster", "data", "xlink:href"]);
const BLOCK_ELEMENTS = new Set(["address", "article", "aside", "blockquote", "br", "caption", "dd", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul"]);

const isElement = (node: Node): node is Element => "tagName" in node;
const children = (node: Node): Node[] => "childNodes" in node ? node.childNodes : [];
const location = (element: Element): string => element.sourceCodeLocation?.startLine ? `line ${element.sourceCodeLocation.startLine}` : "unknown line";

function activeUrl(value: string, element: Element, name: string): boolean {
  const compact = value.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  if (/^(?:javascript|vbscript):/.test(compact)) return true;
  if (!compact.startsWith("data:")) return false;
  return !(element.tagName === "img" && name === "src" && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(compact));
}

function validateElement(element: Element, errors: string[]): void {
  const tag = element.tagName;
  if (ACTIVE_ELEMENTS.has(tag)) errors.push(`${location(element)}: active element <${tag}> is not allowed in declarative CV/cover HTML`);
  else if (element.namespaceURI === HTML_NS && !HTML_ELEMENTS.has(tag)) errors.push(`${location(element)}: HTML element <${tag}> is not in the declarative allowlist`);
  else if (element.namespaceURI === SVG_NS && !SVG_ELEMENTS.has(tag)) errors.push(`${location(element)}: SVG element <${tag}> is not in the declarative allowlist`);
  else if (element.namespaceURI === MATH_NS && !MATH_ELEMENTS.has(tag)) errors.push(`${location(element)}: MathML element <${tag}> is not in the declarative allowlist`);

  for (const attribute of element.attrs) {
    const name = attribute.name.toLowerCase();
    const allowed = COMMON_ATTRIBUTES.has(name) || name.startsWith("data-") || name.startsWith("aria-") || ELEMENT_ATTRIBUTES[tag]?.has(name);
    if (/^on/i.test(name) || name === "srcdoc") errors.push(`${location(element)}: active attribute ${JSON.stringify(name)} is not allowed`);
    else if (!allowed) errors.push(`${location(element)}: attribute ${JSON.stringify(name)} is not in the <${tag}> allowlist`);
    if (URL_ATTRIBUTES.has(name) && activeUrl(attribute.value, element, name)) errors.push(`${location(element)}: executable URL in ${JSON.stringify(name)} is not allowed`);
  }
  if (tag === "meta" && element.attrs.some(attribute => attribute.name.toLowerCase() === "http-equiv"))
    errors.push(`${location(element)}: active meta http-equiv is not allowed`);
  if (tag === "link") {
    const rel = element.attrs.find(attribute => attribute.name === "rel")?.value.toLowerCase();
    if (rel !== "stylesheet") errors.push(`${location(element)}: only stylesheet <link> elements are allowed`);
  }
}

function walk(node: Node, visit: (element: Element) => void): void {
  if (isElement(node)) visit(node);
  for (const child of children(node)) walk(child, visit);
}

function findElement(node: Node, tag: string): Element | undefined {
  if (isElement(node) && node.tagName === tag) return node;
  for (const child of children(node)) {
    const found = findElement(child, tag);
    if (found) return found;
  }
}

export type DeclarativeHtmlResult = { ok: true; snapshotHtml: string } | { ok: false; errors: string[] };
export interface SourceClaimMarker { start: number; tag: string; id: string; subject?: string; authority?: string; text: string; }

export function parseDeclarativeHtml(html: string): DeclarativeHtmlResult {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const errors: string[] = [];
  walk(document, element => validateElement(element, errors));
  if (errors.length) return { ok: false, errors };

  const head = findElement(document, "head");
  if (!head) return { ok: false, errors: ["declarative HTML parser could not establish a <head>"] };
  const csp = parseFragment('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\' \'self\'; img-src \'self\' data:; font-src \'self\' data:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">').childNodes[0];
  if (!csp) return { ok: false, errors: ["could not create trusted Content-Security-Policy"] };
  (csp as { parentNode: ParentNode | null }).parentNode = head;
  head.childNodes.unshift(csp);
  return { ok: true, snapshotHtml: serialize(document) };
}

function nodesToText(nodes: Node[]): string {
  const parts: string[] = [];
  const emit = (node: Node): void => {
    if ("value" in node) { parts.push(node.value); return; }
    if (isElement(node) && ["style", "script", "template", "noscript"].includes(node.tagName)) return;
    const authoredDisplay = isElement(node) ? node.attrs.find(attribute => attribute.name === "style")?.value.match(/(?:^|;)\s*display\s*:\s*([a-z-]+)/i)?.[1] : undefined;
    const block = isElement(node) && (BLOCK_ELEMENTS.has(node.tagName)
      || ["block", "flex", "grid", "list-item", "table", "table-row", "table-cell"].includes(authoredDisplay ?? ""));
    if (block) parts.push(" ");
    for (const child of children(node)) emit(child);
    if (block) parts.push(" ");
  };
  for (const child of nodes) emit(child);
  return parts.join("").replace(/\s+/gu, " ").trim();
}

export function htmlFragmentToText(html: string): string {
  return nodesToText(parseFragment(html).childNodes);
}

export function extractSourceClaimMarkers(html: string): SourceClaimMarker[] {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const markers: SourceClaimMarker[] = [];
  walk(document, element => {
    const id = element.attrs.find(attribute => attribute.name === "data-claim-id")?.value;
    if (id === undefined) return;
    markers.push({
      start: element.sourceCodeLocation?.startOffset ?? 0,
      tag: element.tagName,
      id,
      subject: element.attrs.find(attribute => attribute.name === "data-claim-subject")?.value,
      authority: element.attrs.find(attribute => attribute.name === "data-claim-authority")?.value,
      text: nodesToText(element.childNodes),
    });
  });
  return markers;
}
