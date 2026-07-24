import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const fixtureDir = mkdtempSync(join(tmpdir(), "tailored-prohibited-cli-"));

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("ip-guard CLI", () => {
  it("fails when claims.cannot prohibits a paraphrased capability claim", () => {
    const canonPath = join(fixtureDir, "canon.yaml");
    const htmlPath = join(fixtureDir, "cv.html");
    writeFileSync(canonPath, [
      "schemaVersion: 2",
      "identity:",
      "  name: Alex Rivers",
      "  role: AI Engineer",
      "facts: []",
      "protectedTopics: []",
      "claims:",
      "  cannot:",
      "    - id: no-aws",
      "      statement: Do not claim hands-on production experience with AWS.",
      "      concepts: [aws-production]",
      "",
    ].join("\n"));
    writeFileSync(htmlPath, "<p>Deployed production workloads across Amazon Web Services using Lambda.</p>");

    const result = spawnSync(process.execPath, [
      "dist/cli.js", "ip-guard", htmlPath, "--canon", canonPath,
    ], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/forbidden claim.*aws-production/i);
  });

  it("fails closed when the v2 canon is malformed", () => {
    const canonPath = join(fixtureDir, "malformed-canon.yaml");
    const htmlPath = join(fixtureDir, "innocent.html");
    writeFileSync(canonPath, "schemaVersion: 2\nidentity:\n  name: Alex Rivers\n  role: AI Engineer\n  locaton: Manchester\n");
    writeFileSync(htmlPath, "<p>A bounded public statement.</p>");

    const result = spawnSync(process.execPath, [
      "dist/cli.js", "ip-guard", htmlPath, "--canon", canonPath,
    ], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/identity\.locaton/);
  });

  it("blocks a protected topic and a forbidden internal-IP claim in one chokepoint", () => {
    const canonPath = join(fixtureDir, "private-canon.yaml");
    const htmlPath = join(fixtureDir, "leak.html");
    writeFileSync(canonPath, [
      "schemaVersion: 2",
      "identity:",
      "  name: Alex Rivers",
      "  role: AI Engineer",
      "facts: []",
      "protectedTopics:",
      "  - Project Juniper",
      "claims:",
      "  cannot:",
      "    - id: no-internal-ip",
      "      statement: Do not disclose Project Juniper or internal client metrics.",
      "      concepts: [internal-ip]",
      "",
    ].join("\n"));
    writeFileSync(htmlPath, "<p>Project Juniper improved an internal client metric.</p>");

    const result = spawnSync(process.execPath, [
      "dist/cli.js", "ip-guard", htmlPath, "--canon", canonPath,
    ], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/protected-topic leak/i);
  });

  it("fails specifically as metric-conflict through persisted CLI input", () => {
    const canonPath = join(fixtureDir, "metric-canon.yaml");
    const htmlPath = join(fixtureDir, "metric-cover.html");
    const claimsPath = join(fixtureDir, "metric-claims.yaml");
    writeFileSync(canonPath, [
      "schemaVersion: 2",
      "identity:",
      "  name: Alex Rivers",
      "  role: AI Engineer",
      "facts:",
      "  - id: fact-fleet-commits",
      "    statement: Coding agents landed 124 commits across five repositories.",
      "    kind: attested",
      "    subject: coding-agent fleet",
      "    metrics:",
      "      - { value: 124, unit: commits, subject: coding-agent fleet, timeframe: audit period }",
      "    provenance: { type: candidate-attested, source: candidate }",
      "    verifiedOn: '2026-07-12'",
      "    status: candidate-attested",
      "    confidence: 1",
      "    allowedUses: [cover]",
      "    sensitivity: private",
      "  - id: fact-interlock-runs",
      "    statement: The interlock gate executed 58 times.",
      "    kind: attested",
      "    subject: interlock gate",
      "    metrics:",
      "      - { value: 58, unit: gate executions, subject: interlock gate, timeframe: audit period }",
      "    provenance: { type: candidate-attested, source: candidate }",
      "    verifiedOn: '2026-07-12'",
      "    status: candidate-attested",
      "    confidence: 1",
      "    allowedUses: [cover]",
      "    sensitivity: private",
      "",
    ].join("\n"));
    const clause = "The interlock gate sorted 124 commits during the audit period.";
    writeFileSync(htmlPath, `<style>.sign { color: red; }</style><p>${clause}</p>`);
    writeFileSync(claimsPath, [
      "schemaVersion: 1",
      "claims:",
      "  - id: claim-interlock-commits",
      `    text: ${clause}`,
      "    factIds: [fact-fleet-commits, fact-interlock-runs]",
      "    value: 124",
      "    unit: commits",
      "    subject: interlock gate",
      "    timeframe: audit period",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [
      "dist/cli.js", "ip-guard", htmlPath, "--canon", canonPath,
      "--metric-claims", claimsPath,
    ], { cwd: root, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/metric-conflict/);
    expect(result.stderr).not.toMatch(/engineering-sign-off/);
  });

  it("fails closed when visible numeric claims have no persisted metric input", () => {
    const canonPath = join(fixtureDir, "numeric-canon.yaml");
    const htmlPath = join(fixtureDir, "numeric-cover.html");
    writeFileSync(canonPath, "schemaVersion: 2\nidentity:\n  name: Alex Rivers\n  role: AI Engineer\nfacts: []\n");
    writeFileSync(htmlPath, "<p>Completed 124 audited runs.</p>");
    const result = spawnSync(process.execPath, ["dist/cli.js", "ip-guard", htmlPath, "--canon", canonPath], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/numeric occurrence.*--metric-claims/i);
  });

  it("rejects an omitted invented 999 beside a supported 124", () => {
    const canonPath = join(fixtureDir, "coverage-canon.yaml");
    const htmlPath = join(fixtureDir, "coverage.html");
    const claimsPath = join(fixtureDir, "coverage-claims.yaml");
    writeFileSync(canonPath, supportedMetricCanon());
    writeFileSync(htmlPath, "<p>Completed 124 commits.</p><p>Invented 999 runs.</p>");
    writeFileSync(claimsPath, metricClaimsYaml([
      { id: "claim-124", text: "124 commits", value: 124, unit: "commits", subject: "coding-agent fleet" },
    ]));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/uncovered-numeric-claim.*999/);
  });

  it("rejects text containing 999 when the record declares 124", () => {
    const canonPath = join(fixtureDir, "mismatch-canon.yaml");
    const htmlPath = join(fixtureDir, "mismatch.html");
    const claimsPath = join(fixtureDir, "mismatch-claims.yaml");
    writeFileSync(canonPath, supportedMetricCanon());
    writeFileSync(htmlPath, "<p>Invented 999 commits.</p>");
    writeFileSync(claimsPath, metricClaimsYaml([
      { id: "claim-mismatch", text: "999 commits", value: 124, unit: "commits", subject: "coding-agent fleet" },
    ]));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/numeric-value-mismatch/);
  });

  it("rejects an ambiguous span and duplicate records for one occurrence", () => {
    const canonPath = join(fixtureDir, "ambiguous-canon.yaml");
    const htmlPath = join(fixtureDir, "ambiguous.html");
    const claimsPath = join(fixtureDir, "ambiguous-claims.yaml");
    writeFileSync(canonPath, supportedMetricCanon());
    writeFileSync(htmlPath, "<p>124 commits and 124 tests.</p>");
    writeFileSync(claimsPath, metricClaimsYaml([
      { id: "claim-wide", text: "124 commits and 124 tests", value: 124, unit: "commits", subject: "coding-agent fleet" },
      { id: "claim-duplicate-a", text: "124 commits", value: 124, unit: "commits", subject: "coding-agent fleet" },
      { id: "claim-duplicate-b", text: "124 commits", value: 124, unit: "commits", subject: "coding-agent fleet" },
    ]));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ambiguous-numeric-record/);
    expect(result.stderr).toMatch(/duplicate-numeric-record/);
  });

  it("accepts a fully covered Vendor-C-shaped numeric set with explicit identity and date exemptions", () => {
    const canonPath = join(fixtureDir, "classified-canon.yaml");
    const htmlPath = join(fixtureDir, "classified.html");
    const claimsPath = join(fixtureDir, "classified-claims.yaml");
    writeFileSync(canonPath, supportedMetricCanon("+1 202 555 0142"));
    writeFileSync(htmlPath, "<p>+1 202 555 0142 | 10 July 2026</p><p>Completed 124 commits.</p>");
    writeFileSync(claimsPath, [
      "schemaVersion: 1",
      "claims:",
      "  - id: claim-124",
      "    text: 124 commits",
      "    factIds: [fact-fleet-commits]",
      "    value: 124",
      "    unit: commits",
      "    subject: coding-agent fleet",
      "    timeframe: audit period",
      "exemptions:",
      "  - { id: identity-phone, text: '+1 202 555 0142', classification: identity }",
      "  - { id: application-date, text: '10 July 2026', classification: date }",
      "",
    ].join("\n"));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects identity, date, and reference exemption abuse", () => {
    const canonPath = join(fixtureDir, "abuse-canon.yaml");
    writeFileSync(canonPath, supportedMetricCanon("+1 202 555 0142") + [
      "projects:", "  - name: Historical Release", "    year: '2025'",
      "    bullets: [Published a bounded release.]", "",
    ].join("\n"));
    const cases = [
      { name: "identity", html: "+1 303 555 0199 events", text: "+1 303 555 0199", classification: "identity", issue: "invalid-numeric-exemption" },
      { name: "date", html: "Processed 2025 customer requests", text: "2025", classification: "date", issue: "sourcePaths" },
      { name: "reference", html: "Served #999 customer requests", text: "#999", classification: "reference", issue: "invalid-numeric-exemption" },
    ];
    for (const testCase of cases) {
      const htmlPath = join(fixtureDir, `abuse-${testCase.name}.html`);
      const claimsPath = join(fixtureDir, `abuse-${testCase.name}.yaml`);
      writeFileSync(htmlPath, `<p>${testCase.html}</p>`);
      writeFileSync(claimsPath, [
        "schemaVersion: 1", "claims: []", "exemptions:",
        `  - { id: exemption-${testCase.name}, text: '${testCase.text}', classification: ${testCase.classification} }`, "",
      ].join("\n"));
      const result = runGuard(htmlPath, canonPath, claimsPath);
      expect(result.status, testCase.name).toBe(1);
      expect(result.stderr, testCase.name).toMatch(new RegExp(testCase.issue));
    }
  });

  it("rejects duplicate IDs across claims and exemptions at the second exact path", () => {
    const canonPath = join(fixtureDir, "duplicate-id-canon.yaml");
    const htmlPath = join(fixtureDir, "duplicate-id.html");
    const claimsPath = join(fixtureDir, "duplicate-id.yaml");
    writeFileSync(canonPath, supportedMetricCanon("+1 202 555 0142"));
    writeFileSync(htmlPath, "<p>+1 202 555 0142 | Completed 124 commits.</p>");
    writeFileSync(claimsPath, [
      "schemaVersion: 1", "claims:", "  - id: duplicate-id", "    text: 124 commits",
      "    factIds: [fact-fleet-commits]", "    value: 124", "    unit: commits",
      "    subject: coding-agent fleet", "    timeframe: audit period", "exemptions:",
      "  - { id: duplicate-id, text: '+1 202 555 0142', classification: identity }", "",
    ].join("\n"));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/exemptions\.0\.id: Duplicate persisted ID "duplicate-id"/);
  });

  it("accepts the shipped example CV with canon-grounded date exemptions", () => {
    const result = runGuard(
      "examples/alex-rivers/cv.html",
      "examples/alex-rivers/canon.yaml",
      "examples/alex-rivers/metric-claims.yaml",
    );
    expect(result.status).toBe(0);
  });

  it("uses the shared tokenizer across preceding full dates and repeated years", () => {
    const canonPath = join(fixtureDir, "date-order-canon.yaml");
    const htmlPath = join(fixtureDir, "date-order.html");
    const validClaims = join(fixtureDir, "date-order-valid.yaml");
    const borrowedClaims = join(fixtureDir, "date-order-borrowed.yaml");
    writeFileSync(canonPath, supportedMetricCanon() + [
      "projects:", "  - { name: Gatehouse, year: '2024', bullets: [Released.] }", "",
    ].join("\n"));
    const owner = '<div data-canon-entry="projects[0]"><div class="eh"><div class="title"><span class="project-name" data-canon-owner="projects[0].name">Gatehouse</span></div><div class="meta" data-canon-source="projects[0].year">2024</div></div></div>';
    writeFileSync(htmlPath, `<p>10 July 2026</p><p>2026-07-11</p>${owner}`);
    writeFileSync(validClaims, ["schemaVersion: 1", "claims: []", "exemptions:",
      "  - { id: human-date, text: '10 July 2026', classification: date }",
      "  - { id: iso-date, text: '2026-07-11', classification: date }",
      "  - id: gatehouse-year", "    text: 'Gatehouse 2024'", "    classification: date",
      "    sourcePaths: ['projects[0].year']", "",
    ].join("\n"));
    expect(runGuard(htmlPath, canonPath, validClaims).status).toBe(0);

    writeFileSync(htmlPath, `<p>10 July 2026</p><p>2026-07-11</p>${owner}<p>Processed 2024 requests</p>`);
    writeFileSync(borrowedClaims, ["schemaVersion: 1", "claims: []", "exemptions:",
      "  - { id: human-date, text: '10 July 2026', classification: date }",
      "  - { id: iso-date, text: '2026-07-11', classification: date }",
      "  - id: gatehouse-year", "    text: 'Gatehouse 2024'", "    classification: date",
      "    sourcePaths: ['projects[0].year']",
      "  - id: borrowed-year", "    text: 'Processed 2024 requests'", "    classification: date",
      "    sourcePaths: ['projects[0].year']", "",
    ].join("\n"));
    const borrowed = runGuard(htmlPath, canonPath, borrowedClaims);
    expect(borrowed.status).toBe(1);
    expect(borrowed.stderr).toMatch(/invalid-numeric-exemption/);
  });

  it("rejects computed-hidden source markers and hidden owner ancestors", () => {
    const canonPath = join(fixtureDir, "hidden-canon.yaml");
    const htmlPath = join(fixtureDir, "hidden.html");
    const claimsPath = join(fixtureDir, "hidden.yaml");
    writeFileSync(canonPath, supportedMetricCanon() + [
      "projects:", "  - { name: Historical Release, year: '2025', bullets: [Released.] }",
      "  - { name: Gatehouse, year: '2024', bullets: [Released.] }", "",
    ].join("\n"));
    writeFileSync(htmlPath, ["<style>.concealed { display:none }</style>",
      '<div data-canon-entry="projects[0]"><div class="eh"><div class="title"><span class="project-name" data-canon-owner="projects[0].name">Historical Release</span></div><div class="meta" style="display:none" data-canon-source="projects[0].year">2025</div></div></div>',
      '<div class="concealed"><div data-canon-entry="projects[1]"><div class="eh"><div class="title"><span class="project-name" data-canon-owner="projects[1].name">Gatehouse</span></div><div class="meta" data-canon-source="projects[1].year">2024</div></div></div></div>',
      "<p>Processed 2025 requests</p><p>Counted 2024 requests</p>",
    ].join(""));
    writeFileSync(claimsPath, ["schemaVersion: 1", "claims: []", "exemptions:",
      "  - { id: hidden-leaf, text: 'Processed 2025 requests', classification: date, sourcePaths: ['projects[0].year'] }",
      "  - { id: hidden-ancestor, text: 'Counted 2024 requests', classification: date, sourcePaths: ['projects[1].year'] }", "",
    ].join("\n"));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr.match(/invalid-numeric-exemption/g)).toHaveLength(2);
  });

  it("rejects transparent, zero-size, clipped, and off-page canon fields", () => {
    const canonPath = join(fixtureDir, "concealed-canon.yaml");
    const htmlPath = join(fixtureDir, "concealed.html");
    const claimsPath = join(fixtureDir, "concealed.yaml");
    writeFileSync(canonPath, supportedMetricCanon() + [
      "projects:",
      "  - { name: Inline Transparent, year: '2025', bullets: [Released.] }",
      "  - { name: Global Transparent, year: '2024', bullets: [Released.] }",
      "  - { name: Zero Size, year: '2023', bullets: [Released.] }",
      "  - { name: Offscreen, year: '2022', bullets: [Released.] }",
      "  - { name: Clipped, year: '2021', bullets: [Released.] }", "",
    ].join("\n"));
    const entry = (index: number, name: string, year: string, ownerStyle = "", sourceStyle = "", sourceClass = "") =>
      `<div data-canon-entry="projects[${index}]"><div class="eh"><div class="title"><span class="project-name ${sourceClass === "owner-transparent" ? "transparent" : ""}" style="${ownerStyle}" data-canon-owner="projects[${index}].name">${name}</span></div><div class="meta ${sourceClass === "source-transparent" ? "transparent" : sourceClass}" style="${sourceStyle}" data-canon-source="projects[${index}].year">${year}</div></div></div>`;
    writeFileSync(htmlPath, ["<style>.transparent { color:transparent } .zero { font-size:0 }</style>",
      entry(0, "Inline Transparent", "2025", "color:transparent"),
      entry(1, "Global Transparent", "2024", "", "", "source-transparent"),
      entry(2, "Zero Size", "2023", "", "", "zero"),
      entry(3, "Offscreen", "2022", "position:absolute;left:-9999px"),
      entry(4, "Clipped", "2021", "", "position:absolute;clip:rect(0,0,0,0)"),
    ].join(""));
    writeFileSync(claimsPath, ["schemaVersion: 1", "claims: []", "exemptions:",
      ...[
        ["inline-transparent", "Inline Transparent 2025", "projects[0].year"],
        ["global-transparent", "Global Transparent 2024", "projects[1].year"],
        ["zero-size", "Zero Size 2023", "projects[2].year"],
        ["offscreen", "Offscreen 2022", "projects[3].year"],
        ["clipped", "Clipped 2021", "projects[4].year"],
      ].flatMap(([id, text, path]) => [`  - id: ${id}`, `    text: '${text}'`, "    classification: date", `    sourcePaths: ['${path}']`]), "",
    ].join("\n"));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr.match(/invalid-numeric-exemption/g)).toHaveLength(5);
  });

  it("accepts a visible canon entry positioned at the page edge", () => {
    const canonPath = join(fixtureDir, "edge-canon.yaml");
    const htmlPath = join(fixtureDir, "edge.html");
    const claimsPath = join(fixtureDir, "edge.yaml");
    writeFileSync(canonPath, supportedMetricCanon() + "projects:\n  - { name: Gatehouse, year: '2024', bullets: [Released.] }\n");
    writeFileSync(htmlPath, '<div style="position:absolute;right:0;top:0" data-canon-entry="projects[0]"><div class="eh"><div class="title"><span class="project-name" data-canon-owner="projects[0].name">Gatehouse</span></div><div class="meta" data-canon-source="projects[0].year">2024</div></div></div>');
    writeFileSync(claimsPath, ["schemaVersion: 1", "claims: []", "exemptions:",
      "  - id: edge", "    text: 'Gatehouse 2024'", "    classification: date", "    sourcePaths: ['projects[0].year']", "",
    ].join("\n"));
    expect(runGuard(htmlPath, canonPath, claimsPath).status).toBe(0);
  });

  it("rejects fields fully clipped by nested horizontal and vertical overflow", () => {
    const canonPath = join(fixtureDir, "overflow-canon.yaml");
    const htmlPath = join(fixtureDir, "overflow.html");
    const claimsPath = join(fixtureDir, "overflow.yaml");
    writeFileSync(canonPath, supportedMetricCanon() + ["projects:",
      "  - { name: Horizontal, year: '2024', bullets: [Released.] }",
      "  - { name: Vertical, year: '2023', bullets: [Released.] }", "",
    ].join("\n"));
    const entry = (index: number, name: string, year: string, position: string) =>
      `<div style="position:relative;width:40px;height:60px;overflow:hidden"><div style="position:absolute;${position}" data-canon-entry="projects[${index}]"><div class="eh"><div class="title"><span class="project-name" data-canon-owner="projects[${index}].name">${name}</span></div><div class="meta" data-canon-source="projects[${index}].year">${year}</div></div></div></div>`;
    writeFileSync(htmlPath, entry(0, "Horizontal", "2024", "left:60px;top:0") + entry(1, "Vertical", "2023", "left:0;top:80px"));
    writeFileSync(claimsPath, ["schemaVersion: 1", "claims: []", "exemptions:",
      "  - { id: horizontal, text: 'Horizontal 2024', classification: date, sourcePaths: ['projects[0].year'] }",
      "  - { id: vertical, text: 'Vertical 2023', classification: date, sourcePaths: ['projects[1].year'] }", "",
    ].join("\n"));
    const result = runGuard(htmlPath, canonPath, claimsPath);
    expect(result.status).toBe(1);
    expect(result.stderr.match(/invalid-numeric-exemption/g)).toHaveLength(2);
  });

  it("accepts fields that partially intersect nested overflow bounds", () => {
    const canonPath = join(fixtureDir, "partial-overflow-canon.yaml");
    const htmlPath = join(fixtureDir, "partial-overflow.html");
    const claimsPath = join(fixtureDir, "partial-overflow.yaml");
    writeFileSync(canonPath, supportedMetricCanon() + "projects:\n  - { name: Gatehouse, year: '2024', bullets: [Released.] }\n");
    writeFileSync(htmlPath, '<div style="position:relative;width:100px;height:60px;overflow:hidden"><div style="position:absolute;left:90px;top:20px;width:50px" data-canon-entry="projects[0]"><div class="eh"><div class="title"><span class="project-name" data-canon-owner="projects[0].name">Gatehouse</span></div><div class="meta" data-canon-source="projects[0].year">2024</div></div></div></div>');
    writeFileSync(claimsPath, ["schemaVersion: 1", "claims: []", "exemptions:",
      "  - { id: partial, text: 'Gatehouse 2024', classification: date, sourcePaths: ['projects[0].year'] }", "",
    ].join("\n"));
    expect(runGuard(htmlPath, canonPath, claimsPath).status).toBe(0);
  });
});

function runGuard(htmlPath: string, canonPath: string, claimsPath: string) {
  return spawnSync(process.execPath, [
    "dist/cli.js", "ip-guard", htmlPath, "--canon", canonPath, "--metric-claims", claimsPath,
  ], { cwd: root, encoding: "utf8" });
}

function supportedMetricCanon(phone?: string): string {
  return [
    "schemaVersion: 2", "identity:", "  name: Alex Rivers", "  role: AI Engineer",
    ...(phone ? [`  phone: '${phone}'`] : []), "facts:",
    "  - id: fact-fleet-commits", "    statement: Completed 124 commits.", "    kind: attested",
    "    subject: coding-agent fleet", "    metrics:",
    "      - { value: 124, unit: commits, subject: coding-agent fleet, timeframe: audit period }",
    "    provenance: { type: candidate-attested, source: candidate }", "    verifiedOn: '2026-07-12'",
    "    status: candidate-attested", "    confidence: 1", "    allowedUses: [cover]",
    "    sensitivity: private", "",
  ].join("\n");
}

function metricClaimsYaml(claims: Array<{ id: string; text: string; value: number; unit: string; subject: string }>): string {
  return ["schemaVersion: 1", "claims:", ...claims.flatMap((claim) => [
    `  - id: ${claim.id}`, `    text: ${claim.text}`, "    factIds: [fact-fleet-commits]",
    `    value: ${claim.value}`, `    unit: ${claim.unit}`, `    subject: ${claim.subject}`,
    "    timeframe: audit period",
  ]), "exemptions: []", ""].join("\n");
}
