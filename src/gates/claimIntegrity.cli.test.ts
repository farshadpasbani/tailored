import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import yaml from "js-yaml";
import { computeClaimBindingHash, verifyClaimIntegrity } from "./claimIntegrity.js";
import { loadCanon } from "../canon/load.js";
import type { EvidenceFile } from "../evidence/schema.js";
import { computeResourceManifestHash } from "../evidence/resources.js";

const cli = "dist/cli.js", root = join(tmpdir(), `tailored-claim-integrity-${process.pid}`), canon = "examples/alex-rivers/canon.yaml";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const text = "Halyard builds trustworthy systems.";
const loadedCanon = loadCanon(canon);
if (!loadedCanon.ok) throw new Error(loadedCanon.errors.join("\n"));
function run(args: string[]) { try { return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) }; } catch (error: any) { return { code: error.status ?? 1, out: (error.stdout ?? "") + (error.stderr ?? "") }; } }
function fixture(name: string, html: string, claimText = text): { html: string; evidence: string; data: EvidenceFile } {
  const htmlPath = join(root, `${name}.html`), evidencePath = join(root, `${name}.yaml`), archive = `Archived vacancy: ${claimText}`, archiveName = `${name}.jd.txt`;
  writeFileSync(htmlPath, html); writeFileSync(join(root, archiveName), archive);
  const artifact = { id: "cover", path: `${name}.html`, sha256: hash(html), resourceRoot: ".", resources: [], resourceManifestSha256: computeResourceManifestHash([]) }, source = { id: "employer.jd.company", subject: "Halyard", text: claimText, archivePath: archiveName, archiveSha256: hash(archive), textSha256: hash(claimText) };
  const claim = { id: "cover.company", artifact: "cover", text: claimText, subject: "employer" as const, namespace: "employer" as const, evidenceIds: [source.id], artifactSha256: artifact.sha256, textSha256: hash(claimText), bindingSha256: "" };
  const evidence = { schemaVersion: 2, artifacts: [artifact], employerSources: [source], claims: [claim] } as EvidenceFile;
  claim.bindingSha256 = computeClaimBindingHash(claim, evidence, loadedCanon.data);
  writeFileSync(evidencePath, yaml.dump(evidence, { noRefs: true }));
  return { html: htmlPath, evidence: evidencePath, data: evidence };
}

describe.skipIf(!existsSync(cli))("tailored claim-integrity CLI", () => {
  let valid: ReturnType<typeof fixture>, empty: ReturnType<typeof fixture>, hidden: ReturnType<typeof fixture>;
  beforeAll(() => {
    mkdirSync(root, { recursive: true });
    const marker = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>`;
    valid = fixture("cover", marker); empty = fixture("empty", ""); hidden = fixture("hidden", `<style>[data-claim-id]{display:none}</style>${marker}`);
  });
  it("always renders and states the deterministic boundary honestly", () => {
    const result = run(["claim-integrity", valid.html, "--artifact", "cover", "--canon", canon, "--evidence", valid.evidence]);
    expect(result.code).toBe(0); expect(result.out).toMatch(/structural and evidence integrity passed/); expect(result.out).toMatch(/does not prove arbitrary semantic truth/);
  });
  it("fails closed on empty and hidden documents", () => {
    expect(run(["claim-integrity", empty.html, "--artifact", "cover", "--canon", canon, "--evidence", empty.evidence]).out).toMatch(/empty-document/);
    expect(run(["claim-integrity", hidden.html, "--artifact", "cover", "--canon", canon, "--evidence", hidden.evidence]).out).toMatch(/hidden-claim-marker/);
  });
  it("fails cleanly on malformed evidence", () => {
    const malformed = join(root, "malformed.yaml"); writeFileSync(malformed, "claims: [");
    expect(run(["claim-integrity", valid.html, "--artifact", "cover", "--canon", canon, "--evidence", malformed]).out).toMatch(/invalid evidence/);
  });
  it("keeps legacy trace wording honest", () => {
    const result = run(["trace", "examples/alex-rivers/cv.html", "--canon", canon]); expect(result.code).toBe(0); expect(result.out).toMatch(/does not prove semantic truth/i);
  });

  it("blocks employer authority for myself and ourselves", () => {
    const claimText = "Halyard asked myself and ourselves to build trustworthy systems.";
    const marker = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${claimText}</p>`;
    const item = fixture(`self-${hash(claimText).slice(0, 8)}`, marker, claimText);
    expect(run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]).out).toMatch(/candidate-claim-employer-evidence/);
  });

  it("matches browser text semantics across emphasis, links, entities, and adjacent punctuation", () => {
    const claimText = "Halyard, builds trustworthy systems & tools.";
    const html = '<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer"><strong>Halyard</strong>, builds <a href="#">trustworthy</a> <em>systems</em> &amp; tools.</p>';
    const item = fixture("inline-markup", html, claimText);
    expect(run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]).code).toBe(0);
  });

  it.each(["block", "flex", "grid", "list-item"])("uses print-DOM text for class-applied display:%s", display => {
    const html = `<style>.piece{display:${display}}</style><p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer"><span class="piece">Halyard</span><span class="piece">builds trustworthy systems.</span></p>`;
    const item = fixture(`computed-${display}`, html);
    expect(run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]).code).toBe(0);
  }, 30_000);

  it("rejects scripts before delayed injection", () => {
    const html = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p><script>setTimeout(()=>document.body.append('delayed unowned text'),10)</script>`;
    const item = fixture("scripted", html);
    expect(run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]).out).toMatch(/executable-html/);
  });

  it("uses the actual print/PDF text layer and blocks print-only factual residue", () => {
    const html = `<style>.print-only{display:none}@media print{.print-only{display:block}}</style><p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p><p class="print-only">Print-only factual residue.</p>`;
    const item = fixture("print-only", html);
    // print-unannotated-content can only be produced from pdftotext output of
    // the real print-media artifact; the screen DOM hides this paragraph.
    expect(run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]).out).toMatch(/print-unannotated-content/);
  }, 30_000);

  it("inspects ownership in the same print DOM that is sent to Page.printToPDF", () => {
    const html = `<style>.print-copy{display:none}@media print{.screen-copy{display:none}.print-copy{display:block}}</style>
      <p class="screen-copy" data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>
      <p class="print-copy">${text}</p>`;
    const item = fixture("print-substitution", html);
    const result = run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]);
    expect(result.out).toMatch(/hidden-claim-marker/);
    expect(result.out).toMatch(/unannotated-content/);
  }, 30_000);

  it.each([
    ["img-onerror", `<img src="missing.png" onerror="document.querySelector('[data-claim-id]').remove()">`],
    ["svg-onload", `<svg onload="document.querySelector('[data-claim-id]').remove()"></svg>`],
  ])("rejects active HTML before browser execution: %s", (name, active) => {
    const html = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>${active}`;
    const item = fixture(name, html);
    expect(run(["claim-integrity", item.html, "--artifact", "cover", "--canon", canon, "--evidence", item.evidence]).out).toMatch(/active-html/);
  });

  it("verifies an immutable byte snapshot when the original path is swapped concurrently", async () => {
    const html = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>`;
    const item = fixture("path-swap", html), original = readFileSync(item.html, "utf8");
    const pending = verifyClaimIntegrity({ htmlPath: item.html, evidencePath: item.evidence, artifact: "cover", evidence: item.data, canon: loadedCanon.data });
    writeFileSync(item.html, "<p>swapped unowned revision</p>");
    try { expect((await pending).ok).toBe(true); }
    finally { writeFileSync(item.html, original); }
  }, 30_000);

  it("renders staged immutable HTML while retaining the evidence-declared source identity", async () => {
    const html = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>`;
    const item = fixture("staged-source-identity", html), staged = join(root, "staged-source-identity.snapshot.html"), original = readFileSync(item.html, "utf8");
    writeFileSync(staged, original);
    const pending = verifyClaimIntegrity({ htmlPath: staged, declaredArtifactPath: item.html, evidencePath: item.evidence, artifact: "cover", evidence: item.data, canon: loadedCanon.data });
    writeFileSync(item.html, "<p>mutated then returned</p>");
    writeFileSync(item.html, original);
    expect((await pending).ok).toBe(true);
  }, 30_000);

  it("can publish the exact PDF produced from the inspected immutable snapshot", async () => {
    const html = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>`;
    const item = fixture("bound-pdf-output", html), pdf = join(root, "bound-pdf-output.pdf");
    const result = await verifyClaimIntegrity({
      htmlPath: item.html,
      evidencePath: item.evidence,
      artifact: "cover",
      evidence: item.data,
      canon: loadedCanon.data,
      outputPdfPath: pdf,
    });
    expect(result.ok).toBe(true);
    expect(existsSync(pdf)).toBe(true);
    expect(readFileSync(pdf).subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("removes the temporary mirror when rendering fails", async () => {
    const html = `<p data-claim-id="cover.company" data-claim-subject="employer" data-claim-authority="employer">${text}</p>`;
    const item = fixture("snapshot-render-failure", html), fakeChrome = join(root, "failing-chrome.sh");
    writeFileSync(fakeChrome, "#!/bin/sh\nexit 1\n"); chmodSync(fakeChrome, 0o755);
    const before = readdirSync(tmpdir()).filter(name => name.startsWith("tailored-claim-print-")).sort(), previous = process.env.CHROME_BIN;
    process.env.CHROME_BIN = fakeChrome;
    try {
      await expect(verifyClaimIntegrity({ htmlPath: item.html, evidencePath: item.evidence, artifact: "cover", evidence: item.data, canon: loadedCanon.data })).rejects.toThrow();
    } finally {
      if (previous === undefined) delete process.env.CHROME_BIN; else process.env.CHROME_BIN = previous;
    }
    expect(readdirSync(tmpdir()).filter(name => name.startsWith("tailored-claim-print-")).sort()).toEqual(before);
  });
});
