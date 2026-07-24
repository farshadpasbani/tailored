import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import {
  isTokenAtKeyword,
  isTokenCloseParen,
  isTokenComment,
  isTokenFunction,
  isTokenOpenCurly,
  isTokenOpenParen,
  isTokenSemicolon,
  isTokenString,
  isTokenURL,
  isTokenWhitespace,
  tokenize,
} from "@csstools/css-tokenizer";
import type { EvidenceFile } from "./schema.js";

type Node = DefaultTreeAdapterMap["node"];
interface ResourceReference { path: string; css: boolean; }
export interface ResourceManifestEntry { path: string; sha256: string; }
export interface ResourceManifest { resources: ResourceManifestEntry[]; resourceManifestSha256: string; }
export interface VerifiedResource { path: string; absolutePath: string; bytes: Buffer; }

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const normalizedPath = (path: string): string => path.normalize("NFC");
const comparePaths = (left: string, right: string): number => Buffer.compare(Buffer.from(normalizedPath(left), "utf8"), Buffer.from(normalizedPath(right), "utf8"));
const canonical = (resources: ResourceManifestEntry[]): string => JSON.stringify(
  resources.map(({ path, sha256 }) => ({ path: normalizedPath(path), sha256 })).sort((a, b) => comparePaths(a.path, b.path)),
);
export const computeResourceManifestHash = (resources: ResourceManifestEntry[]): string => sha256(canonical(resources));

function children(node: Node): Node[] { return "childNodes" in node ? node.childNodes as Node[] : []; }
function attribute(node: Node, name: string): string | undefined {
  return "attrs" in node ? node.attrs.find(item => item.name.toLowerCase() === name)?.value : undefined;
}
function localReference(raw: string): string | undefined {
  const value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!value || value.startsWith("#") || /^data:/i.test(value)) return undefined;
  if (/^(?:https?:)?\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) throw new Error(`remote resource is forbidden: ${JSON.stringify(value)}`);
  return value.split(/[?#]/, 1)[0];
}
function cssReferences(source: string): ResourceReference[] {
  const references: ResourceReference[] = [];
  const tokens = tokenize({ css: source });
  const dynamicFunctions = new Set(["var", "env", "attr"]);
  for (const token of tokens) if (isTokenFunction(token) && dynamicFunctions.has(token[4].value.toLowerCase())) {
    throw new Error(`dynamic CSS substitution ${token[4].value}() is unsupported in verified resource CSS`);
  }
  const functions: Array<string | undefined> = [];
  const stringImageFunctions = new Set(["image", "image-set", "-webkit-image-set"]);
  let importTargetPending = false;
  for (const token of tokens) {
    if (isTokenAtKeyword(token)) { importTargetPending = token[4].value.toLowerCase() === "import"; continue; }
    if (isTokenWhitespace(token) || isTokenComment(token)) continue;
    if (isTokenSemicolon(token) || isTokenOpenCurly(token)) { importTargetPending = false; continue; }
    if (isTokenFunction(token)) {
      const name = token[4].value.toLowerCase(); functions.push(name);
      if (importTargetPending && name !== "url") importTargetPending = false;
      continue;
    }
    if (isTokenOpenParen(token)) { functions.push(undefined); importTargetPending = false; continue; }
    if (isTokenCloseParen(token)) { functions.pop(); continue; }
    if (isTokenURL(token)) {
      const path = localReference(token[4].value); if (path) references.push({ path, css: importTargetPending });
      importTargetPending = false;
      continue;
    }
    if (isTokenString(token)) {
      const parent = functions.at(-1);
      if (importTargetPending || parent === "url" || (parent !== undefined && stringImageFunctions.has(parent))) {
        const path = localReference(token[4].value); if (path) references.push({ path, css: importTargetPending });
      }
      importTargetPending = false;
      continue;
    }
    if (importTargetPending) importTargetPending = false;
  }
  return references;
}
function htmlReferences(html: string): ResourceReference[] {
  const references: ResourceReference[] = [];
  const walk = (node: Node): void => {
    if ("tagName" in node) {
      const tag = node.tagName.toLowerCase();
      const rel = attribute(node, "rel")?.toLowerCase().split(/\s+/) ?? [];
      const href = attribute(node, "href"), src = attribute(node, "src"), srcset = attribute(node, "srcset");
      if (tag === "link" && rel.includes("stylesheet") && href) { const path = localReference(href); if (path) references.push({ path, css: true }); }
      if (["img", "source"].includes(tag) && src) { const path = localReference(src); if (path) references.push({ path, css: false }); }
      if (["img", "source"].includes(tag) && srcset) for (const candidate of srcset.split(",")) { const path = localReference(candidate.trim().split(/\s+/, 1)[0]); if (path) references.push({ path, css: false }); }
      const style = attribute(node, "style"); if (style) references.push(...cssReferences(`x{${style}}`));
      if (tag === "style") references.push(...cssReferences(children(node).map(child => "value" in child ? String(child.value) : "").join("")));
    }
    children(node).forEach(walk);
  };
  walk(parse(html) as Node);
  return references;
}
function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate); return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}
function physicalResourceRoot(evidenceDirectory: string, resourceRoot: string): string {
  if (isAbsolute(resourceRoot)) throw new Error("resource root must be relative to the evidence file");
  const evidenceRoot = realpathSync(evidenceDirectory), declaredRoot = resolve(evidenceRoot, resourceRoot);
  if (!inside(evidenceRoot, declaredRoot)) throw new Error("resource root escapes the evidence directory");
  const physicalRoot = realpathSync(declaredRoot);
  if (!inside(evidenceRoot, physicalRoot)) throw new Error("physical resource root escapes the physical evidence root");
  return physicalRoot;
}
function discoverResources(html: string, htmlPath: string, evidenceDirectory: string, resourceRoot: string): VerifiedResource[] {
  const root = physicalResourceRoot(evidenceDirectory, resourceRoot);
  if (!inside(root, realpathSync(htmlPath))) throw new Error("artifact HTML is outside its declared resource root");
  const found = new Map<string, VerifiedResource>();
  const visit = (reference: ResourceReference, fromDirectory: string): void => {
    const absolutePath = resolve(realpathSync(fromDirectory), reference.path);
    if (!inside(root, absolutePath)) throw new Error(`resource escapes declared root: ${JSON.stringify(reference.path)}`);
    const path = normalizedPath(relative(root, absolutePath).split(sep).join("/"));
    if (found.has(path)) return;
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) throw new Error(`resource is missing: ${JSON.stringify(path)}`);
    if (!inside(root, realpathSync(absolutePath))) throw new Error(`resource escapes declared root through a symbolic link: ${JSON.stringify(reference.path)}`);
    const bytes = readFileSync(absolutePath);
    found.set(path, { path, absolutePath, bytes });
    if (reference.css) for (const nested of cssReferences(bytes.toString("utf8"))) visit(nested, dirname(absolutePath));
  };
  for (const reference of htmlReferences(html)) visit(reference, dirname(realpathSync(htmlPath)));
  return [...found.values()].sort((a, b) => comparePaths(a.path, b.path));
}

/** Discover and hash the exact local dependency closure for an artifact. */
export function buildResourceManifest(html: string, htmlPath: string, evidenceDirectory: string, resourceRoot: string): ResourceManifest {
  const resources = discoverResources(html, htmlPath, evidenceDirectory, resourceRoot).map(resource => ({ path: resource.path, sha256: sha256(resource.bytes) }));
  return { resources, resourceManifestSha256: computeResourceManifestHash(resources) };
}

/** Resolve and verify the complete local dependency closure before rendering. */
export function verifyArtifactResources(html: string, htmlPath: string, evidenceDirectory: string, artifact: EvidenceFile["artifacts"][number]): VerifiedResource[] {
  const normalizedDeclared = artifact.resources.map(resource => ({ ...resource, path: normalizedPath(resource.path) })).sort((a, b) => comparePaths(a.path, b.path));
  if (new Set(normalizedDeclared.map(resource => resource.path)).size !== artifact.resources.length) throw new Error("resource manifest contains duplicate or normalization-colliding paths");
  if (computeResourceManifestHash(artifact.resources) !== artifact.resourceManifestSha256) throw new Error("resource manifest hash is stale");
  const found = discoverResources(html, htmlPath, evidenceDirectory, artifact.resourceRoot);
  const actual = found.map(resource => ({ path: resource.path, sha256: sha256(resource.bytes) }));
  for (let index = 0; index < Math.max(actual.length, normalizedDeclared.length); index += 1) {
    const observed = actual[index], expected = normalizedDeclared[index];
    if (!observed) throw new Error(`declared resource is unused: ${JSON.stringify(expected.path)}`);
    if (!expected) throw new Error(`resource is not declared: ${JSON.stringify(observed.path)}`);
    if (observed.path !== expected.path) throw new Error(`resource manifest path mismatch: expected ${JSON.stringify(expected.path)}, found ${JSON.stringify(observed.path)}`);
    if (observed.sha256 !== expected.sha256) throw new Error(`resource is stale: ${JSON.stringify(observed.path)}`);
  }
  return found;
}
