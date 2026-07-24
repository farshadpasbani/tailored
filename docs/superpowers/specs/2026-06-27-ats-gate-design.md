# ATS Gate — Design Spec

> Sub-project B of the "tailored as funnel optimiser" effort (goal: 100x the
> chance of landing a job). The ATS gate is the first piece because the ATS
> keyword/parse screen is the funnel's biggest *hard filter* — most online
> applications die here before a human ever reads them. Folds in a minimal
> version of sub-project A (the JD keyword model); the full ranked-requirements
> core is factored out later for the fit/match sub-projects.

## Goal

Add a deterministic `tailored ats` gate that fails an application before it is
sent if the rendered CV would not survive an Applicant Tracking System: either it
does not **parse** (no text layer, missing contact, missing standard headings) or
it does not **cover** the job's must-have keywords. Same philosophy as the
existing gates — the model proposes the keyword set and the prose; the gate
deterministically decides.

## Why this is the first multiplier

`P(land) = P(reach a human) × …`. The ATS screen is `P(reach a human)`, a hard
gate that silently zeroes most applications. A clean, impactful CV that an ATS
can't parse or that misses the must-have keywords never reaches the skim stage at
all. Fixing it is plausibly 3–5x on its own, and it is the most deterministic of
the funnel additions, so it slots into the existing gate architecture with no
change to the product's identity.

## The soul boundary — coverage, not fabrication

The gate checks **presence** of must-have keywords in the CV text. It does NOT
license keyword stuffing. A missing must-have means one of two things:

- The candidate HAS that evidence in `canon.yaml` and it should be surfaced in the
  CV → fix the document (legitimate).
- The candidate does NOT have it → that is a genuine **fit gap**, surfaced by the
  fit sub-project (C), and must NOT be papered over with a fabricated skill.

The existing invariant stands: everything in the document traces to a fact in the
canon. The ATS gate raises "you're missing keyword X"; truthfulness still governs
how it gets covered.

## The JD model (minimal sub-project A, folded in)

The agent extracts the job's keywords from the JD during intake and writes them to
an inspectable, editable `jd.yaml` (model proposes; human can correct; gate
decides). Validated with zod, like `canon.yaml`.

```yaml
role: Senior Machine Learning Engineer
company: Acme
mustHave:
  - machine learning
  - python
  - pytorch
  - mlops
niceToHave:
  - kubernetes
  - aws
# optional: real-world variants the gate should treat as a match for a key term
synonyms:
  machine learning: [ML]
  pytorch: [torch]
```

Schema rules:
- `role` (string, required), `company` (string, optional).
- `mustHave` (string[], ≥1 required), `niceToHave` (string[], optional, default []).
- `synonyms` (map of canonical-term → string[], optional, default {}). A term in
  `synonyms` need not appear in `mustHave`/`niceToHave`, but a warning is printed
  if it doesn't (likely a typo).

## CLI

```
tailored ats <pdf> --jd <jd.yaml> [--min <0..1>]
```

- `<pdf>` — the rendered CV PDF (e.g. `out/cv.pdf`).
- `--jd` — path to the `jd.yaml`. Required.
- `--min` — minimum must-have coverage to pass, default `0.8`. Validated to be a
  number in `[0,1]`.

Output mirrors the other gates: human-readable lines, `PASS:`/`FAIL:`, exit code 0
or 1. On FAIL, it lists exactly what failed (which parse checks, which must-have
keywords are missing) so the agent can fix the document and re-run.

## The checks

### 1. Parseability (all must pass)

Extract the PDF's text layer via poppler's `pdftotext` (reuse the `Runner`
pattern from `pageFit.ts`; `-layout` off so we get reading-order text).

- **Text layer present:** extracted text length ≥ 200 non-whitespace chars.
  Catches image-only / scanned PDFs that ATS cannot read at all.
- **Contact parseable:** an email address matches in the extracted text
  (`/[^\s@]+@[^\s@]+\.[^\s@]+/`). ATS needs to find how to contact the candidate.
- **Standard headings present:** at least 3 of these section headings appear
  (case-insensitive, whole-word): `summary` / `profile`, `experience`,
  `education`, `skills`, `projects`. ATS parsers key off standard headings; exotic
  ones get dropped.

Out of scope for v1 (documented, not silently skipped): multi-column reading-order
scrambling detection, table/text-box detection, font-embedding checks. The
`-layout`-off extraction already approximates ATS reading order; deeper layout
forensics is a later iteration if real failures show up.

### 2. Keyword coverage

- Normalise the extracted CV text: lowercase, collapse whitespace.
- For each `mustHave` term, it is **covered** if the term OR any of its `synonyms`
  appears as a normalised, word-boundary-aware substring of the CV text.
- `coverage = covered_mustHave / total_mustHave`.
- `niceToHave` coverage computed the same way, reported as **informational only**
  (never gates).
- Matching is deterministic: case-insensitive, word-boundary substring + explicit
  synonyms. No stemming, no fuzzy/NLP matching in v1 (YAGNI; explicit synonyms
  handle the real variance like ML/machine learning and keep the gate inspectable).

### 3. The gate

- FAIL if any parseability check fails, OR if `coverage < min`.
- On FAIL, print: the failed parse checks; `coverage X% (n/total)`; and the bullet
  list of missing must-have terms.
- On PASS, print: `PASS: ats — parseable, must-have coverage X% (n/total)` plus the
  nice-to-have coverage line.

## Files

- **Create `src/gates/ats.ts`** — pure, testable core:
  - `extractPdfText(pdfPath, run: Runner = defaultRun): Promise<string>` — wraps
    `pdftotext <pdf> -` (stdout). Same ENOENT→install-hint handling as `pageFit`.
    (Lift the shared `Runner`/`defaultRun` so `pageFit` and `ats` share one copy
    rather than duplicating the spawn wrapper — a small, in-scope tidy.)
  - `parseChecks(cvText): { textLayer: boolean; contact: boolean; headings: number; ok: boolean }`
  - `keywordCoverage(cvText, terms: string[], synonyms): { covered: string[]; missing: string[]; ratio: number }`
  - `analyzeAts(cvText, jd, min): AtsResult` — composes the above into one result
    object (`ok`, parse detail, must/nice coverage, missing list).
- **Create `src/jd/schema.ts`** + **`src/jd/load.ts`** — zod schema + loader for
  `jd.yaml`, mirroring `src/canon/schema.ts` + `src/canon/load.ts` (returns
  `{ ok, data } | { ok:false, errors }`).
- **Modify `src/cli.ts`** — add the `ats` command: load+validate jd, render-text,
  analyze, print, exit. Follows the existing command style.
- **Create `examples/alex-rivers/jd.yaml`** — a fictional JD keyword set matching
  the example canon, so `tailored smoke` / the docs can demo the gate.
- **Modify the smoke path** (`src/smoke.test.ts` / `smoke-example.test.ts` and the
  `smoke` command if present) — render the example CV and assert `ats` passes
  against `examples/alex-rivers/jd.yaml`.
- **Modify `skill/SKILL.md`** (the published skill copy) — add an `ats` row to the
  gates table, an intake step "extract the JD's must-haves into `jd.yaml`", and the
  `tailored ats out/cv.pdf --jd jd.yaml` line in the gate-running step.

## Testing (TDD, vitest — match the existing gate tests)

All core functions are pure or take an injectable `Runner`, so tests need no real
poppler. Build the failing test first for each:

- `parseChecks`: image-only fixture (empty/short text) fails text-layer; text
  without an email fails contact; text missing headings fails; a good CV passes.
- `keywordCoverage`: exact match; synonym match (ML ↔ machine learning); case
  insensitivity; word-boundary (no "java" inside "javascript" false-positive);
  missing-term list correct; ratio math.
- `analyzeAts`: gate fails below `min`, passes at/above; nice-to-have never gates.
- `jd` schema: rejects empty `mustHave`, accepts minimal valid, warns on orphan
  synonym key.
- `extractPdfText`: injected `Runner` returns canned text; ENOENT surfaces the
  install hint (assert the message), mirroring `pageFit`'s test.
- CLI integration: `ats` exits 0 on the example, exits 1 with a missing-keyword
  list when a must-have is removed from the example `jd.yaml`.

## Acceptance criteria

- `tailored ats <pdf> --jd <jd.yaml>` exists, validates the jd, and exits 0/1.
- A CV PDF with no text layer FAILS with a clear "no text layer" message.
- A CV missing a must-have keyword FAILS, listing the missing term(s).
- A CV that parses and meets `--min` coverage PASSES, printing coverage %.
- `niceToHave` never affects the exit code.
- The gate fabricates nothing and reads nothing personal — it only inspects the
  rendered PDF text and the jd.yaml.
- `tailored smoke` (or the example test) renders the example CV and the ats gate
  passes against `examples/alex-rivers/jd.yaml`.
- All new functions have vitest coverage; `npm test` green; `npm run build` clean.

## Out of scope (this sub-project)

- Fit/targeting score (`tailored fit`) — sub-project C.
- Match/gap matrix, impact-evidence gate, warm path, outcome tracking — later.
- Deep layout forensics (column-order, tables, font embedding) — later iteration if
  real ATS failures demand it.
- Any change to the existing gates' behaviour beyond lifting the shared `Runner`.
