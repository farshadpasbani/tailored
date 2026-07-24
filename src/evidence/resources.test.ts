import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EvidenceFile } from "./schema.js";
import { buildResourceManifest, computeResourceManifestHash, verifyArtifactResources } from "./resources.js";
import { findChrome, inspectRenderedDocument } from "../render/chrome.js";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function setup(html: string, files: Record<string, string | Buffer>) {
  const base = mkdtempSync(join(tmpdir(), "tailored-resources-")); roots.push(base);
  const root = join(base, "pack"); mkdirSync(root);
  writeFileSync(join(root, "cv.html"), html);
  for (const [path, bytes] of Object.entries(files)) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), bytes); }
  const resources = Object.entries(files).map(([path, bytes]) => ({ path, sha256: hash(bytes) }));
  const artifact = { id: "cv", path: "pack/cv.html", sha256: hash(html), resourceRoot: "pack", resources, resourceManifestSha256: computeResourceManifestHash(resources) } as EvidenceFile["artifacts"][number];
  return { base, root, htmlPath: join(root, "cv.html"), artifact };
}

describe("artifact resource contract", () => {
  it("resolves recursive CSS imports and url dependencies exactly", () => {
    const item = setup('<link rel="stylesheet" href="css/main.css"><img src="img/logo.png">', {
      "css/main.css": '@import "nested.css"; .hero{background:url("../img/bg.png")}',
      "css/nested.css": '@font-face{src:url("../fonts/body.woff2")}',
      "img/logo.png": "logo", "img/bg.png": "bg", "fonts/body.woff2": "font",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual([
      "css/main.css", "css/nested.css", "fonts/body.woff2", "img/bg.png", "img/logo.png",
    ]);
  });
  it.each([
    ["parent-relative escape", '<img src="../secret.png">', { "unused.png": "x" }, /escapes declared root/],
    ["remote dependency", '<link rel="stylesheet" href="https://example.test/x.css">', {}, /remote resource is forbidden/],
    ["missing dependency", '<img src="missing.png">', {}, /resource is missing/],
  ])("rejects %s", (_name, html, files, message) => {
    const item = setup(html, files); expect(() => verifyArtifactResources(html, item.htmlPath, item.base, item.artifact)).toThrow(message);
  });
  it("rejects resource mutation after the manifest was sealed", () => {
    const item = setup('<img src="logo.png">', { "logo.png": "original" });
    writeFileSync(join(item.root, "logo.png"), "mutated");
    expect(() => verifyArtifactResources('<img src="logo.png">', item.htmlPath, item.base, item.artifact)).toThrow(/resource is stale/);
  });
  it("rejects a stale manifest hash", () => {
    const item = setup("plain", {}); item.artifact.resourceManifestSha256 = "0".repeat(64);
    expect(() => verifyArtifactResources("plain", item.htmlPath, item.base, item.artifact)).toThrow(/manifest hash is stale/);
  });

  it("rejects a resource root symlinked outside the physical evidence root", () => {
    const base = mkdtempSync(join(tmpdir(), "tailored-root-link-")), outside = mkdtempSync(join(tmpdir(), "tailored-outside-")); roots.push(base, outside);
    writeFileSync(join(outside, "cv.html"), "plain"); symlinkSync(outside, join(base, "pack"));
    const artifact = { id: "cv", path: "pack/cv.html", sha256: hash("plain"), resourceRoot: "pack", resources: [], resourceManifestSha256: computeResourceManifestHash([]) } as EvidenceFile["artifacts"][number];
    expect(() => verifyArtifactResources("plain", join(base, "pack/cv.html"), base, artifact)).toThrow(/physical resource root escapes/);
  });

  it("treats uppercase, extensionless and query-bearing imports as CSS through multiple levels", () => {
    const item = setup('<link rel="stylesheet" href="main">', {
      main: '@IMPORT url("theme?rev=2#screen");',
      theme: '@import "nested/third";',
      "nested/third": '.hero{background:url("../image.bin?cache=1#hero")}',
      "image.bin": "image",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual(["image.bin", "main", "nested/third", "theme"]);
  });

  it.each([
    ["remote import", '@IMPORT "theme";', '@import "https://example.test/private.css";', /remote resource is forbidden/],
    ["missing nested import", '@import "theme";', '@import "missing";', /resource is missing/],
    ["missing nested url", '@import "theme";', '.x{background:url("missing.bin")}', /resource is missing/],
  ])("rejects a nested %s", (_name, first, second, message) => {
    const item = setup('<link rel="stylesheet" href="main">', { main: first, theme: second });
    expect(() => verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact)).toThrow(message);
  });

  it("does not parse a normal url() target as CSS", () => {
    const item = setup('<link rel="stylesheet" href="main">', { main: '.x{background:url("payload")}', payload: '@import "https://example.test/not-css";' });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact)).toHaveLength(2);
  });

  it("builds the supported deterministic manifest from discovered bytes", () => {
    const item = setup('<link rel="stylesheet" href="main.css">', { "main.css": '.x{background:url("image.png")}', "image.png": "image" });
    const built = buildResourceManifest(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, "pack");
    expect(built).toEqual({ resources: item.artifact.resources.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))), resourceManifestSha256: computeResourceManifestHash(item.artifact.resources) });
  });

  it("decodes escaped import and url identifiers before classification", () => {
    const item = setup('<link rel="stylesheet" href="main.css">', {
      "main.css": String.raw`@\69mport u\72l("theme"); .x{background:u\72l("image.bin")}`,
      theme: ".x{display:block}", "image.bin": "image",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual(["image.bin", "main.css", "theme"]);
  });

  it("inventories string URLs in standard, prefixed, escaped, and nested image functions", () => {
    const item = setup('<link rel="stylesheet" href="main.css">', {
      "main.css": String.raw`.a{background:image-set("one.png" 1x, u\72l("two.png") 2x)} .b{background:-webkit-image-set("three.png" 1x)} .c{background:cross-fade(image\2d set("four.png" 1x), url("five.png"), 50%)}`,
      "one.png": "1", "two.png": "2", "three.png": "3", "four.png": "4", "five.png": "5",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual(["five.png", "four.png", "main.css", "one.png", "three.png", "two.png"]);
  });

  it("does not treat nested image descriptors as resource paths", () => {
    const item = setup('<link rel="stylesheet" href="main.css">', {
      "main.css": `.a{background:image-set("one.png" 1x type("image/png"), url("two.png") 2x type("image/webp"))}`,
      "one.png": "1", "two.png": "2",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual(["main.css", "one.png", "two.png"]);
  });

  it("lets nested image functions classify their own direct candidates only", () => {
    const item = setup('<link rel="stylesheet" href="main.css">', {
      "main.css": `.a{background:image-set(custom("not-a-resource", image("nested.png")), "direct.png" 2x)}`,
      "nested.png": "nested", "direct.png": "direct",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual(["direct.png", "main.css", "nested.png"]);
  });

  it("classifies only the first @import string/url as the stylesheet target", () => {
    const item = setup('<link rel="stylesheet" href="main.css">', {
      "main.css": `@import "theme.css" layer("presentation") supports(font-format("woff2")) screen;`,
      "theme.css": ".x{display:block}",
    });
    expect(verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact).map(value => value.path)).toEqual(["main.css", "theme.css"]);
  });

  it.each([
    ["local", `:root{--candidate:url("local.png") 1x}.x{background:image-set(var(--candidate))}`, { "local.png": "local" }],
    ["missing", `:root{--candidate:url("missing.png") 1x}.x{background:image-set(var(--candidate))}`, {}],
    ["remote", `:root{--candidate:url("https://example.test/remote.png") 1x}.x{background:image-set(var(--candidate))}`, {}],
    ["escaped var", String.raw`:root{--candidate:url("local.png") 1x}.x{background:image-set(v\61r(--candidate))}`, { "local.png": "local" }],
    ["environment", `.x{background:image-set(env(candidate))}`, {}],
    ["attribute", `.x{background:image-set(attr(data-candidate))}`, {}],
  ])("rejects dynamic resource substitution before snapshot: %s", (_name, css, resources) => {
    const item = setup('<link rel="stylesheet" href="main.css">', { "main.css": css, ...resources });
    expect(() => verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact)).toThrow(/dynamic CSS substitution/);
  });

  it.each([
    ["remote image-set string", String.raw`.x{background:image-set("https://example.test/x.png" 1x)}`, /remote resource/],
    ["missing image-set string", String.raw`.x{background:image-set("missing.png" 1x)}`, /resource is missing/],
    ["out-of-root image-set string", `.x{background:image-set("../secret.png" 1x)}`, /escapes declared root/],
  ])("rejects %s", (_name, css, message) => {
    const item = setup('<link rel="stylesheet" href="main.css">', { "main.css": css });
    expect(() => verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact)).toThrow(message);
  });
});

describe.skipIf(!findChrome())("browser CSS resource grammar parity", () => {
  it("agrees with Chrome on escaped url() and escaped image-set string syntax", async () => {
    const item = setup('<link rel="stylesheet" href="main.css"><p id="proof" data-claim-id="proof"><span>first</span><span>second</span></p><i id="other"></i><script>setTimeout(()=>document.body.append(getComputedStyle(proof).backgroundImage+getComputedStyle(other).backgroundImage),0)</script>', {
      "main.css": String.raw`@import "theme.css" supports(display:block); #proof{background-image:image\2d set("tile.svg" 1x type("image/svg+xml"))} #other{background-image:u\72l("other.svg")}`,
      "theme.css": "#proof span{display:block}",
      "tile.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>',
      "other.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="blue"/></svg>',
    });
    const rendered = await inspectRenderedDocument(item.htmlPath);
    expect(rendered.claims.find(claim => claim.id === "proof")?.text).toBe("first second");
    expect(rendered.text).toContain("tile.svg");
    expect(rendered.text).toContain("other.svg");
  }, 30_000);

  it("demonstrates that Chrome resolves var() into an image resource", async () => {
    const item = setup('<link rel="stylesheet" href="main.css"><p id="proof"></p><script>setTimeout(()=>document.body.append(getComputedStyle(proof).backgroundImage),0)</script>', {
      "main.css": `:root{--candidate:url("tile.svg") 1x} #proof{background-image:image-set(var(--candidate))}`,
      "tile.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    });
    const rendered = await inspectRenderedDocument(item.htmlPath);
    expect(rendered.text).toContain("tile.svg");
    expect(() => verifyArtifactResources(readFileSync(item.htmlPath, "utf8"), item.htmlPath, item.base, item.artifact)).toThrow(/dynamic CSS substitution/);
  }, 30_000);
});
