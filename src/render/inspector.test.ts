import { describe, it, expect } from "vitest";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findChrome } from "./chrome.js";
import { inspect, inspectAndPrint } from "./inspector.js";

const dir = (name: string) => mkdtempSync(join(tmpdir(), `tailored-${name}-`));
const write = (name: string, html: string): string => {
  const path = join(dir(name), "document.html");
  writeFileSync(path, html);
  return path;
};
const pdfText = (pdf: string): string => spawnSync("pdftotext", [pdf, "-"], { encoding: "utf8" }).stdout ?? "";
const hasPoppler = spawnSync("pdftotext", ["-v"]).status === 0;

describe.skipIf(!findChrome())("inspect", () => {
  it("reports what the print document paints: claim markers, text units, generated content", async () => {
    const html = write("inspect-domain", `<html><head><style>
      .generated::before { content: "generated" }
      @media screen { .print-only { display: none } }
      @media print { .print-only { display: block } }
    </style></head><body>root text<h6>heading</h6>
      <p data-claim-id="c1" data-claim-subject="candidate" data-claim-authority="candidate">A claim.</p>
      <span class="generated">inline</span>
      <p class="print-only">print only</p>
      <table><caption>caption</caption><tr><th>header</th><td>cell</td></tr></table>
      <blockquote>quote</blockquote>
      <script>setTimeout(() => document.body.insertAdjacentText("beforeend", "injected"), 0)</script>
    </body></html>`);
    const evidence = await inspect(html);
    const painted = evidence.textUnits.filter(unit => unit.visible).map(unit => unit.text);
    expect(painted).toEqual(expect.arrayContaining(["root text", "heading", "A claim.", "inline", "caption", "header", "cell", "quote", "injected"]));
    expect(evidence.claims).toContainEqual({ id: "c1", subject: "candidate", authority: "candidate", text: "A claim.", visible: true });
    expect(evidence.textUnits.find(unit => unit.text === "A claim.")?.claimIds).toEqual(["c1"]);
    expect(evidence.textUnits.find(unit => unit.text === "injected")?.claimIds).toEqual([]);
    expect(evidence.generatedContent).toContainEqual(expect.objectContaining({ text: "generated", visible: true }));
    // Media matters to the verdict: what the reader receives is the printed page, so an
    // element the screen hides and print shows must count as painted.
    expect(painted).toContain("print only");
  }, 30_000);

  it("needs no instrumented copy: a bare fragment with no html or body element still yields evidence", async () => {
    const html = write("inspect-fragment", `<p data-claim-id="c1" data-claim-subject="candidate" data-claim-authority="candidate">Fragment claim.</p>`);
    const evidence = await inspect(html);
    expect(evidence.text).toBe("Fragment claim.");
    expect(evidence.claims).toEqual([{ id: "c1", subject: "candidate", authority: "candidate", text: "Fragment claim.", visible: true }]);
  }, 30_000);

  it("calls a claim concealed by contrast, indent, scale, or a hidden child unpainted", async () => {
    const html = write("inspect-concealed", `<body>
      <p data-claim-id="indent" style="text-indent:-10000px">indented</p>
      <p data-claim-id="scaled" style="transform:scale(0.00001)">scaled</p>
      <p data-claim-id="contrast" style="color:white;background:white">white on white</p>
      <p data-claim-id="child">visible <span style="opacity:0">hidden child</span></p>
      <p data-claim-id="clipped" style="overflow:hidden;height:0">clipped away</p>
    </body>`);
    const evidence = await inspect(html);
    for (const id of ["indent", "scaled", "contrast", "child", "clipped"])
      expect(evidence.claims.find(claim => claim.id === id)?.visible, id).toBe(false);
  }, 30_000);

  it("locates canon source markers and their owning entry", async () => {
    const html = write("inspect-markers", `<body>
      <div data-canon-entry="experience[0]">
        <div class="eh"><span class="title" data-canon-owner="experience[0].title">Engineer</span>
        <span class="org" data-canon-owner="experience[0].org">Acme</span></div>
        <div class="meta">Leeds · <span data-canon-source="experience[0].start">2017</span>–<span data-canon-source="experience[0].end">2022</span></div>
      </div>
    </body>`);
    const evidence = await inspect(html);
    const start = evidence.markers.find(marker => marker.path === "experience[0].start")!;
    expect(start).toMatchObject({ tag: "span", text: "2017", visible: true, entryPath: "experience[0]", entryVisible: true, entryCount: 1 });
    expect(start.metaText).toBe("Leeds · 2017–2022");
    expect(evidence.text.slice(0, start.offset)).toBe(start.textBefore);
    expect(evidence.owners.map(owner => owner.path)).toEqual(["experience[0].title", "experience[0].org"]);
    expect(evidence.owners[0]).toMatchObject({ tag: "span", classes: ["title"], text: "Engineer", visible: true, parentTag: "div" });
    // Group tokens are opaque: two fields in one header share a token, and that is all a
    // caller may ask of them.
    expect(evidence.owners[0].contextGroup).toBe(evidence.owners[1].contextGroup);
    expect(evidence.owners[0].parentGroup).toBe(evidence.owners[1].parentGroup);
  }, 30_000);
});

describe.skipIf(!findChrome())("inspectAndPrint", () => {
  it("prints the exact revision it inspected, so the PDF text layer carries the claims the evidence reports", async () => {
    const html = write("print-same-revision", `<html><head><style>
      @media screen { .print-only { display: none } }
      @media print { .print-only { display: block } }
    </style></head><body>
      <p data-claim-id="c1" data-claim-subject="candidate" data-claim-authority="candidate">Shipped the gate.</p>
      <p class="print-only" data-claim-id="c2" data-claim-subject="candidate" data-claim-authority="candidate">Printed only claim.</p>
    </body></html>`);
    const pdf = join(dir("print-out"), "document.pdf");
    const evidence = await inspectAndPrint(html, pdf);
    expect(evidence.claims.map(claim => claim.id).sort()).toEqual(["c1", "c2"]);
    expect(evidence.claims.every(claim => claim.visible)).toBe(true);
    expect(statSync(pdf).size).toBeGreaterThan(0);
    if (hasPoppler) {
      const text = pdfText(pdf).replace(/\s+/g, " ");
      expect(text).toContain("Shipped the gate.");
      expect(text).toContain("Printed only claim.");
    }
  }, 30_000);

  it("reports a claim the print stylesheet hides as unpainted, and leaves it out of the PDF", async () => {
    const html = write("print-hidden", `<html><head><style>
      @media print { .vanishes { visibility: hidden } }
    </style></head><body>
      <p data-claim-id="kept" data-claim-subject="candidate" data-claim-authority="candidate">Kept claim.</p>
      <p class="vanishes" data-claim-id="gone" data-claim-subject="candidate" data-claim-authority="candidate">Vanishing claim.</p>
    </body></html>`);
    const pdf = join(dir("print-hidden-out"), "document.pdf");
    const evidence = await inspectAndPrint(html, pdf);
    expect(evidence.claims.find(claim => claim.id === "kept")?.visible).toBe(true);
    expect(evidence.claims.find(claim => claim.id === "gone")?.visible).toBe(false);
    if (hasPoppler) expect(pdfText(pdf)).not.toContain("Vanishing claim.");
  }, 30_000);

  it("refuses to report evidence it cannot also print", async () => {
    const html = write("print-unwritable", `<body><p>Anything.</p></body>`);
    await expect(inspectAndPrint(html, join(dir("print-unwritable"), "no-such-directory", "out.pdf"))).rejects.toThrow();
  }, 30_000);
});
