import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Canon } from "../canon/schema.js";
import type { EvidenceFile } from "../evidence/schema.js";
import type { DocumentEvidence } from "../render/inspector.js";
import { analyzeClaimIntegrity, analyzeClaimIntegrityPreflight, computeClaimBindingHash } from "./claimIntegrity.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const metric = { value: 40, unit: "percent", subject: "document review time", denominator: "review duration", scale: "relative reduction", timeframe: "per review" };
const candidateFact = {
  id: "candidate.fact.review-time", statement: "Alex cut document review time by 40 percent.", kind: "achievement",
  subject: "document review time", metrics: [metric], provenance: { type: "candidate-attested" as const, source: "Alex Rivers" },
  verifiedOn: "2026-07-12", status: "candidate-attested" as const, confidence: 0.9, allowedUses: ["cv", "cover"], sensitivity: "public" as const,
};
const canon: Canon = {
  schemaVersion: 2, identity: { name: "Alex Rivers", role: "AI Engineer" }, skills: [], projects: [], experience: [], education: [], certifications: [], publications: [],
  protectedTopics: [], verifiedFacts: {}, talkingPoints: {}, ipBoundaries: [], discretion: {}, draftingGuidance: {}, facts: [candidateFact],
};
const claimText = "Reduced document review time by 40% per review.";
const marked = (text = claimText, id = "cv.review-time", subject = "candidate", authority = "candidate") =>
  `<html><body><p data-claim-id="${id}" data-claim-subject="${subject}" data-claim-authority="${authority}">${text}</p></body></html>`;
function plan(html: string, claims: EvidenceFile["claims"] = []): EvidenceFile {
  const artifactSha256 = hash(html);
  const defaults: EvidenceFile["claims"] = [{
    id: "cv.review-time", artifact: "cv", text: claimText, subject: "candidate", namespace: "candidate",
    evidenceIds: [candidateFact.id], artifactSha256, textSha256: hash(claimText), bindingSha256: "0".repeat(64), metrics: [metric],
  }];
  return seal({ schemaVersion: 2, artifacts: [{ id: "cv", path: "cv.html", sha256: artifactSha256 }], employerSources: [], claims: claims.length ? claims : defaults });
}
function seal(evidence: EvidenceFile): EvidenceFile { for (const claim of evidence.claims) claim.bindingSha256 = computeClaimBindingHash(claim, evidence, canon); return evidence; }
function rendered(text = claimText, id = "cv.review-time", subject = "candidate", authority = "candidate", units = [{ locator: "html > body > p", tag: "p", text, visible: true, claimIds: [id], structuralReasons: [] }]): DocumentEvidence {
  return { text, printText: text, markers: [], owners: [], claims: [{ id, text, subject, authority, visible: true }], textUnits: units, generatedContent: [] };
}
function run(html = marked(), evidence = plan(html), browser = rendered()) {
  return analyzeClaimIntegrity({ html, artifact: "cv", evidence, canon, renderedDocument: browser, archivedSources: {} });
}

describe("claim integrity", () => {
  it("passes an exact candidate binding only with rendered coverage", () => {
    expect(run()).toEqual({ ok: true, issues: [] });
    expect(analyzeClaimIntegrity({ html: marked(), artifact: "cv", evidence: plan(marked()), canon }).issues).toContainEqual(expect.objectContaining({ kind: "rendered-evidence-required" }));
    expect(analyzeClaimIntegrityPreflight({ html: marked(), artifact: "cv", evidence: plan(marked()), canon })).toEqual({ ok: true, issues: [] });
  });

  it.each(["h2", "h6", "span", "section", "article", "td", "th", "caption", "blockquote"])("blocks unowned visible text in <%s>", tag => {
    const text = "Visible authored residue";
    expect(run(`<${tag}>${text}</${tag}>`, plan(`<${tag}>${text}</${tag}>`), { text, printText: text, markers: [], owners: [], claims: [], textUnits: [{ path: tag, tag, text, visible: true, claimIds: [], structuralReasons: [] }], generatedContent: [] }).issues).toContainEqual(expect.objectContaining({ kind: "unannotated-content" }));
  });

  it("blocks direct/root and DOM-injected text, but accepts one explicit reasoned nonfactual owner", () => {
    const residue = { path: "html > body > span", tag: "span", text: "Injected later", visible: true, claimIds: [] as string[], structuralReasons: [] as string[] };
    expect(run(marked(), plan(marked()), rendered(claimText, "cv.review-time", "candidate", "candidate", [rendered().textUnits![0], residue])).issues.some(i => i.kind === "unannotated-content")).toBe(true);
    expect(run(marked(), plan(marked()), rendered(claimText, "cv.review-time", "candidate", "candidate", [rendered().textUnits[0], { ...residue, text: "•", structuralReasons: ["decorative-separator"] }])).ok).toBe(true);
    expect(run(marked(), plan(marked()), rendered(claimText, "cv.review-time", "candidate", "candidate", [rendered().textUnits[0], { ...residue, text: "Increased revenue by 99%", structuralReasons: ["decorative-separator"] }])).issues.some(i => i.kind === "invalid-structural-content")).toBe(true);
    expect(run(marked(), plan(marked()), rendered(claimText, "cv.review-time", "candidate", "candidate", [rendered().textUnits[0], { ...residue, text: "•", structuralReasons: ["visual flourish"] }])).issues.some(i => i.kind === "invalid-structural-content")).toBe(true);
    expect(run(marked(), plan(marked()), rendered(claimText, "cv.review-time", "candidate", "candidate", [{ ...rendered().textUnits![0], structuralReasons: ["overlap"] }])).issues.some(i => i.kind === "ambiguous-text-ownership")).toBe(true);
  });

  it("reconciles source, rendered, text-unit, and evidence claim ID sets", () => {
    const injected = { ...rendered(), claims: [...rendered().claims, { id: "cv.injected", text: "Injected", subject: "candidate", authority: "candidate", visible: true }] };
    expect(run(marked(), plan(marked()), injected).issues.some(i => i.kind === "rendered-claim-mismatch" && i.claimId === "cv.injected")).toBe(true);
    expect(run(marked(), plan(marked()), { ...rendered(), textUnits: [{ ...rendered().textUnits[0], claimIds: ["cv.injected"] }] }).issues.some(i => i.kind === "rendered-claim-mismatch")).toBe(true);
    expect(run(marked(), plan(marked()), { ...rendered(), textUnits: [] }).issues.some(i => i.kind === "rendered-claim-mismatch")).toBe(true);
  });

  it("requires complete final evidence and rejects visible CSS-generated content", () => {
    expect(run(marked(), plan(marked()), { ...rendered(), generatedContent: [{ locator: "html > body > p::before", text: "Injected", visible: true }] }).issues.some(i => i.kind === "generated-content")).toBe(true);
    const incomplete = { ...rendered() } as Partial<DocumentEvidence>; delete incomplete.generatedContent;
    expect(run(marked(), plan(marked()), incomplete as DocumentEvidence).issues.some(i => i.kind === "rendered-evidence-incomplete")).toBe(true);
  });

  it.each([
    ["pronoun-free fragment", "Built an evaluation harness.", "candidate"],
    ["candidate name", "Alex Rivers built an evaluation harness.", "candidate"],
    ["candidate surname", "At Acme, Rivers built an evaluation harness.", "employer"],
    ["candidate noun", "Built by the candidate.", "employer"],
    ["applicant noun", "The applicant delivered an evaluation harness.", "employer"],
    ["third-person fragment", "He built an evaluation harness.", "candidate"],
    ["reflexive singular", "I completed the evaluation myself.", "employer"],
    ["reflexive plural", "The evaluation was completed by ourselves.", "employer"],
    ["object plural", "Acme selected us to deliver the evaluation.", "employer"],
    ["possessive plural", "The evaluation is ours.", "employer"],
  ])("does not let employer evidence license %s", (_label, text, subject) => {
    const html = marked(text, "cv.test", subject, "employer"), artifactSha256 = hash(html);
    const sourceText = "Acme requires evaluation experience.", archive = sourceText;
    const evidence = seal({ schemaVersion: 2, artifacts: [{ id: "cv", path: "cv.html", sha256: artifactSha256 }], employerSources: [{ id: "employer.jd", subject: "Acme", text: sourceText, archivePath: "jd.txt", archiveSha256: hash(archive), textSha256: hash(sourceText) }], claims: [{ id: "cv.test", artifact: "cv", text, subject: subject as "candidate", namespace: "employer", evidenceIds: ["employer.jd"], artifactSha256, textSha256: hash(text), bindingSha256: "0".repeat(64) }] });
    const result = analyzeClaimIntegrity({ html, artifact: "cv", evidence, canon, archivedSources: { "employer.jd": archive }, renderedDocument: rendered(text, "cv.test", subject, "employer") });
    expect(result.issues.some(i => i.kind === "candidate-claim-employer-evidence")).toBe(true);
  });

  it("allows an explicitly employer-attributed quote and blocks bare JD prose", () => {
    const sourceText = "Acme requires evaluation experience.", archive = `Archived vacancy\n${sourceText}`;
    const check = (text: string) => {
      const html = marked(text, "cv.jd", "employer", "employer"), artifactSha256 = hash(html);
      const evidence = seal({ schemaVersion: 2, artifacts: [{ id: "cv", path: "cv.html", sha256: artifactSha256 }], employerSources: [{ id: "employer.jd", subject: "Acme", text: sourceText, archivePath: "jd.txt", archiveSha256: hash(archive), textSha256: hash(sourceText) }], claims: [{ id: "cv.jd", artifact: "cv", text, subject: "employer", namespace: "employer", evidenceIds: ["employer.jd"], artifactSha256, textSha256: hash(text), bindingSha256: "0".repeat(64) }] });
      return analyzeClaimIntegrity({ html, artifact: "cv", evidence, canon, archivedSources: { "employer.jd": archive }, renderedDocument: rendered(text, "cv.jd", "employer", "employer") });
    };
    expect(check("Acme requires evaluation experience.").ok).toBe(true);
    expect(check("Requires evaluation experience.").issues.some(i => i.kind === "employer-attribution-required")).toBe(true);
  });

  it("matches an employer subject as a whole phrase, never as a substring collision", () => {
    const text = "Halyard said evaluation experience is required.", html = marked(text, "cv.jd", "employer", "employer"), artifactSha256 = hash(html);
    const sourceText = "AI requires evaluation experience.", archive = sourceText;
    const source = { id: "employer.jd", subject: "AI", text: sourceText, archivePath: "jd.txt", archiveSha256: hash(archive), textSha256: hash(sourceText) };
    const evidence = { schemaVersion: 2, artifacts: [{ id: "cv", path: "cv.html", sha256: artifactSha256 }], employerSources: [source], claims: [{ id: "cv.jd", artifact: "cv", text, subject: "employer", namespace: "employer", evidenceIds: [source.id], artifactSha256, textSha256: hash(text), bindingSha256: "0".repeat(64) }] } as EvidenceFile;
    evidence.claims[0].bindingSha256 = computeClaimBindingHash(evidence.claims[0], evidence, canon);
    const result = analyzeClaimIntegrity({ html, artifact: "cv", evidence, canon, archivedSources: { [source.id]: archive }, renderedDocument: rendered(text, "cv.jd", "employer", "employer") });
    expect(result.issues).toContainEqual(expect.objectContaining({ kind: "employer-attribution-required" }));
  });

  it("stales when an archived employer/JD source is replaced", () => {
    const text = "Acme requires evaluation experience.", archive = `Vacancy\n${text}`, html = marked(text, "cv.jd", "employer", "employer"), artifactSha256 = hash(html);
    const evidence = seal({ schemaVersion: 2, artifacts: [{ id: "cv", path: "cv.html", sha256: artifactSha256 }], employerSources: [{ id: "employer.jd", subject: "Acme", text, archivePath: "jd.txt", archiveSha256: hash(archive), textSha256: hash(text) }], claims: [{ id: "cv.jd", artifact: "cv", text, subject: "employer", namespace: "employer", evidenceIds: ["employer.jd"], artifactSha256, textSha256: hash(text), bindingSha256: "0".repeat(64) }] });
    const result = analyzeClaimIntegrity({ html, artifact: "cv", evidence, canon, archivedSources: { "employer.jd": `${archive} replaced` }, renderedDocument: rendered(text, "cv.jd", "employer", "employer") });
    expect(result.issues.some(i => i.kind === "source-hash-mismatch")).toBe(true);
  });

  it.each(["subject", "unit", "denominator", "scale", "timeframe"] as const)("rejects metric %s mismatch", field => {
    const evidence = plan(marked()); evidence.claims[0].metrics = [{ ...metric, [field]: `wrong-${field}` }];
    expect(run(marked(), evidence).issues.some(i => i.kind === "metric-mismatch" && i.message.includes(field))).toBe(true);
  });

  it("binds exact artifact, claim text, and archived employer source hashes", () => {
    const edited = marked("Reduced document review time by 41% per review.");
    const evidence = plan(marked()); evidence.claims[0].text = "Reduced document review time by 41% per review.";
    expect(run(edited, evidence, rendered(evidence.claims[0].text)).issues.some(i => i.kind === "artifact-hash-mismatch" || i.kind === "claim-text-hash-mismatch")).toBe(true);
  });

  it("stales coordinated HTML and evidence-text edits until a new combined binding is issued", () => {
    const text = "Reduced document review time by 41% per review.", html = marked(text), evidence = plan(marked()), oldBinding = evidence.claims[0].bindingSha256;
    evidence.artifacts[0].sha256 = hash(html); evidence.claims[0].artifactSha256 = hash(html); evidence.claims[0].text = text; evidence.claims[0].textSha256 = hash(text); evidence.claims[0].metrics = [{ ...metric, value: 41 }];
    expect(evidence.claims[0].bindingSha256).toBe(oldBinding);
    expect(run(html, evidence, rendered(text)).issues.some(i => i.kind === "claim-binding-hash-mismatch")).toBe(true);
  });

  it("binds the complete claim, source, and metric payload", () => {
    const evidence = plan(marked()), original = evidence.claims[0].bindingSha256;
    for (const mutate of [
      () => { evidence.claims[0].evidenceIds = ["candidate.fact.other"]; },
      () => { evidence.claims[0].artifactSha256 = "f".repeat(64); },
      () => { evidence.claims[0].metrics![0].unit = "milliseconds"; },
      () => { candidateFact.metrics[0].scale = "absolute"; },
    ]) {
      const snapshot = structuredClone(evidence), factSnapshot = structuredClone(candidateFact.metrics);
      mutate();
      expect(computeClaimBindingHash(evidence.claims[0], evidence, canon)).not.toBe(original);
      Object.assign(evidence, snapshot); candidateFact.metrics = factSnapshot;
    }
  });

  it.each([
    ["£40", "percent"], ["40ms", "percent"], ["40%", "milliseconds"],
  ])("binds rendered numeric surface %s to declared unit %s", (surface, unit) => {
    const text = `Reduced document review time by ${surface} per review.`, html = marked(text);
    const evidence = plan(html); evidence.claims[0].text = text; evidence.claims[0].textSha256 = hash(text);
    evidence.claims[0].metrics = [{ ...metric, unit }]; evidence.claims[0].bindingSha256 = computeClaimBindingHash(evidence.claims[0], evidence, canon);
    expect(run(html, evidence, rendered(text)).issues.some(i => i.kind === "metric-mismatch" && i.message.includes("numeric surface"))).toBe(true);
  });

  it("allows a bare count when its complete declared unit is named beside it", () => {
    const countMetric = { value: 124, unit: "commits", subject: "coding-agent fleet", denominator: "not-applicable", scale: "absolute", timeframe: "2026-06-01" };
    const countFact = { ...candidateFact, id: "candidate.fact.commits", metrics: [countMetric] };
    const countCanon = { ...canon, facts: [countFact] };
    const text = "The fleet landed 124 agent-authored commits.", html = marked(text, "cv.commits"), artifactSha256 = hash(html);
    const evidence = { schemaVersion: 2, artifacts: [{ id: "cv", path: "cv.html", sha256: artifactSha256 }], employerSources: [], claims: [{ id: "cv.commits", artifact: "cv", text, subject: "candidate", namespace: "candidate", evidenceIds: [countFact.id], artifactSha256, textSha256: hash(text), bindingSha256: "0".repeat(64), metrics: [countMetric] }] } as EvidenceFile;
    evidence.claims[0].bindingSha256 = computeClaimBindingHash(evidence.claims[0], evidence, countCanon);
    const browser = rendered(text, "cv.commits");
    expect(analyzeClaimIntegrity({ html, artifact: "cv", evidence, canon: countCanon, renderedDocument: browser, archivedSources: {} }).ok).toBe(true);
  });

  it("preserves duplicate, case, stale, hidden, and numeric failure behaviour", () => {
    const duplicate = `${marked()}${marked()}`; expect(run(duplicate, plan(duplicate), { ...rendered(), claims: [...rendered().claims!, ...rendered().claims!] }).issues.some(i => i.kind === "duplicate-claim-marker")).toBe(true);
    expect(run(marked("stale"), plan(marked("stale")), rendered("stale")).issues.some(i => i.kind === "rendered-claim-mismatch")).toBe(true);
    expect(run(marked(), plan(marked()), { ...rendered(), claims: [{ ...rendered().claims![0], visible: false }] }).issues.some(i => i.kind === "hidden-claim-marker")).toBe(true);
    const noMetric = plan(marked()); noMetric.claims[0].metrics = undefined; expect(run(marked(), noMetric).issues.some(i => i.kind === "unbound-structured-number")).toBe(true);
  });

  it("rejects executable authored HTML before any delayed DOM injection can run", () => {
    const html = `${marked()}<script>setTimeout(() => document.body.append('unowned'), 10)</script>`;
    expect(analyzeClaimIntegrityPreflight({ html, artifact: "cv", evidence: plan(html), canon }).issues)
      .toContainEqual(expect.objectContaining({ kind: "executable-html" }));
  });

  it("reconciles exact print text and blocks print-only unowned content", () => {
    expect(run(marked(), plan(marked()), { ...rendered(), printText: `${claimText} Print-only factual residue.` }).issues)
      .toContainEqual(expect.objectContaining({ kind: "print-unannotated-content" }));
    expect(run(marked(), plan(marked()), { ...rendered(), printText: "" }).issues)
      .toContainEqual(expect.objectContaining({ kind: "print-claim-mismatch" }));
  });

  it("normalizes PDF line-wrap whitespace after an authored hyphen", () => {
    const text = claimText.replace("document review", "document-review"), html = marked(text), evidence = plan(html);
    evidence.claims[0].text = text; evidence.claims[0].textSha256 = hash(text);
    evidence.claims[0].bindingSha256 = computeClaimBindingHash(evidence.claims[0], evidence, canon);
    const browser = { ...rendered(text), printText: text.replace("document-", "document") };
    expect(run(html, evidence, browser).ok).toBe(true);
  });
});
