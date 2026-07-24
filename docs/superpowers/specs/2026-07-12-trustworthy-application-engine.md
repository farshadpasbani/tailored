# Trustworthy application engine

Date: 2026-07-12
Status: approved

## Context

Tailored currently produces attractive, ATS-readable documents, but its green
gates overstate what they prove. `trace` validates disconnected values and a
small set of names rather than semantic claims; `fit` and `ats` share a keyword
matcher; `distinct` rewards lexical camouflage; and the export caller must
assemble several independent commands without one hash-bound result.

The engine must become the trust boundary for a job-application pack. It should
prove the things deterministic code can prove, record the things only a human or
editorial reviewer can judge, and never call the latter deterministic truth.

## Goal

Provide a backwards-compatible v2 contract in which:

- candidate facts have stable IDs, provenance, scope, calibration and explicit
  prohibitions;
- job requirements are frozen before prose and bind to candidate evidence or an
  honest gap;
- factual clauses in application documents bind to candidate or employer
  evidence without allowing employer text to license a first-person claim;
- one `tailored verify-pack` command renders and verifies a complete pack and
  emits a machine-readable, hash-bound receipt;
- truth, privacy, schema and artifact-integrity failures block, while ATS,
  distinctness and editorial heuristics remain visible advisories;
- the CLI and documentation describe the assurance honestly.

## Chosen approach

### 1. Strict canon v2 with a compatibility migration

`schemaVersion: 2` is required after migration. The schema is strict at every
object boundary and models all current namespaces, including the guidance that
v1 silently strips. Stable facts live in a top-level `facts` registry. A fact
contains:

- `id`, `statement`, `kind`, `subject` and optional structured `metrics`;
- `provenance`, `verifiedOn`, `status` and `confidence`;
- `allowedUses`, `sensitivity`, and optional `prohibitedTransforms`.

Existing identity, project, experience, education and guidance sections remain
human-readable. Their claim-bearing entries reference fact IDs rather than
becoming a second source of truth. `tailored migrate-canon` performs the v1 to
v2 conversion and refuses unresolved or duplicate IDs. `tailored validate`
accepts v1 only with an explicit legacy warning during the migration window.

### 2. Requirements are evidence records, not keyword lists

`requirements.yaml` stores the archived posting hash plus one record per
requirement:

- stable ID, exact source quote/location and `hard` or `preferred` class;
- importance weight and eligibility impact;
- candidate fact IDs, explicit gap, or dated human waiver;
- ATS terms kept separately from evidence.

The legacy `jd.yaml` loader remains readable and can be migrated, but a legacy
keyword list cannot receive a verified fit verdict. Fit is calculated from the
frozen requirement-evidence map; ATS reports literal vocabulary only after fit.

### 3. Claim bindings make provenance inspectable

Each outward factual clause has a stable claim ID in `evidence.yaml` and a
matching `data-claim-id` in authored HTML. The evidence record stores the exact
rendered text, artifact, evidence namespace and referenced fact or employer
source IDs.

The deterministic verifier checks coverage, exact text/hash correspondence,
known IDs, namespace separation, structured metric compatibility, forbidden
claims and missing bindings. It does not pretend arbitrary paraphrase entailment
is mechanically solved. Semantic and editorial review is a separately named,
hash-bound attestation.

### 4. One pack verifier and receipt

`tailored verify-pack` reads a pack descriptor, renders into a temporary
versioned directory, runs all blocking and advisory checks, and emits JSON. The
receipt hashes:

- canon, archived JD, requirements, evidence plan, strategy, research and
  preference inputs;
- CV/cover HTML and final PDFs;
- the distinct-corpus manifest and every included prior;
- engine version and source revision;
- every gate result, warning, waiver and reviewer attestation.

The command exits non-zero only for blocking failures. Advisory failures are
recorded and require an explicit downstream waiver before publication.

### 5. Blocking checks and advisory diagnostics are different types

Blocking:

- strict schema and referential integrity;
- claim-binding coverage and exact-text integrity;
- candidate/employer namespace separation;
- `claims.cannot`, protected topics, structured metric conflicts and known
  contradictory transformations;
- required artifact presence, input/output hashes, PDF text layer and page
  integrity.

Advisory:

- ATS vocabulary coverage;
- lexical and structural distinctness;
- density, default 10pt/1.32/10mm targets, project/skills selection and other
  recruiter-skim heuristics;
- evidence altitude and natural-language editorial rubric.

Hard accessibility floors remain blocking. Preferred design targets do not.

### 6. Distinctness uses a supplied final-corpus manifest

The engine does not discover priors through a shell glob. The caller supplies a
manifest containing immutable approved/submitted artifact IDs, statuses and
hashes. Skipped, abandoned, superseded and the candidate itself are excluded.
Lexical matches remain diagnostic. A strategy record captures opening move,
argument, anchor evidence and selected projects so semantic repetition can be
reviewed without rewarding thesaurus edits.

## Rejected approaches

- **Add more regexes to `trace`:** preserves the false promise while moving the
  next semantic error one clause to the right.
- **Use a generative model as the blocking truth gate:** useful as an
  adversarial reviewer, but non-deterministic and capable of blessing the same
  overclaim it wrote.
- **Require canon wording verbatim:** mechanically safe but destroys the
  editorial freedom needed for a tasteful application.
- **Break all v1 packs immediately:** makes historical evidence unreadable and
  forces low-value bulk rewriting.
- **Keep ATS and fit as one score:** lets vocabulary masquerade as experience.

## Data and command surface

Expected new or revised surfaces:

- `src/canon/schema.ts`, `src/canon/migrate.ts`, `src/canon/load.ts`
- `src/requirements/schema.ts`, `src/requirements/migrate.ts`
- `src/evidence/schema.ts`, `src/gates/claimIntegrity.ts`
- `src/gates/prohibitedClaims.ts`, `src/gates/editorial.ts`
- `src/verify/pack.ts`, `src/verify/receipt.ts`, `src/verify/hash.ts`
- `src/cli.ts`, `src/index.ts`
- `skill/SKILL.md`, `skill/references/house-style.md`, examples and README

The public API exports parsers and receipt types so the private vault can use
the same schemas rather than maintaining looser copies.

## Edge and unhappy paths

- Empty, malformed or non-mapping canon and requirement files.
- Unknown, duplicated or case-colliding IDs.
- v1 canon loaded without migration acknowledgement.
- Canon fields lost because the schema forgot a namespace.
- A claim references both JD and candidate namespaces to imply experience.
- An employer number is attached to a first-person achievement.
- Equal numeric values with different subjects, units or timeframes.
- A prohibited claim expressed through a known synonym or forbidden predicate.
- An unbound factual clause, missing HTML marker or stale evidence text.
- Requirements recategorised after fit without a recorded waiver.
- Missing, unreadable, image-only, multi-page or stale PDFs.
- Receipt generation interrupted part-way through.
- Advisory failures with and without explicit waivers.
- A distinct corpus containing the current pack, a skipped pack, a missing file
  or a hash that no longer matches.
- Filenames containing spaces and application directories outside the current
  working directory.

## Acceptance criteria

1. The migrated real the private vault's `canon.yaml` validates strictly without
   discarding any current namespace, and a one-character unknown-key mutation
   fails with an exact path.
2. The canon migration is deterministic and idempotent; rerunning it produces no
   diff and duplicate/unresolved IDs fail closed.
3. `claims.cannot` and protected-topic checks block representative OpenAI API,
   AWS, ANSYS, chartership/sign-off, unsupported database and internal-IP claims.
4. The Vendor-C/Vendor-D-style attachment of 124 commits to 58 interlock runs fails
   structured metric validation even though both numbers exist in canon.
5. Vendor-A cannot obtain a verified fit or claim LLM-as-judge/drift expertise
   without matching fact IDs; literal JD wording can improve ATS only.
6. A requirement cannot change from hard to preferred after freezing unless a
   dated waiver is present and included in the receipt.
7. Every factual claim marker in CV and cover has an exact evidence record, and
   every evidence record points to the correct artifact text and allowed source
   namespace.
8. `tailored verify-pack` renders both PDFs, runs the complete blocking and
   advisory sets, writes one deterministic-schema receipt, hashes all named
   inputs/outputs/corpus members, and leaves no published partial output after a
   blocking failure.
9. Re-running verification without changes yields the same content hashes and
   gate results; changing canon, JD, preferences, HTML, PDF, corpus or attestation
   makes the previous receipt stale.
10. Full-corpus distinct analysis includes approved/submitted `Applied/**`
    artifacts and excludes skipped/abandoned/superseded artifacts.
11. CLI help, skill instructions and README consistently state what each check
    proves and do not say that deterministic gates guarantee taste or semantic
    truth.
12. Existing v1 examples and commands either continue through an explicit
    compatibility path or fail with a migration command, never an opaque parse
    error.
13. The full unit/integration suite passes, including malformed, missing,
    concurrent and interrupted-write cases.
14. A complete field run against the real Vendor-A and Vendor-B packs produces
    actionable failures under v2 before they are repaired and verified receipts
    after repair.

## Assumptions

- No LLM API is introduced into the engine or local UI.
- The human remains the final semantic and taste authority.
- Existing submitted artifacts are immutable historical records. Their defects
  can be indexed and quarantined, not silently rewritten.
- The public Tailored repository contains no private canon or application data;
  real-pack tests execute from the private vault and public tests use sanitised
  fixtures reproducing the same failure class.
- Current readability values of 9pt/1.28/8mm remain absolute floors; the new
  10pt/1.32/10mm values are preferred targets.

## Does not count

- Renaming `trace` while retaining disconnected number matching as the claimed
  truth guarantee does not count.
- A receipt that omits the JD, canon, preferences, evidence plan, corpus or PDF
  hashes does not count.
- Green tests using only invented fixtures while Vendor-A, Vendor-C/Vendor-D or
  Vendor-B still reproduces the audited failure does not count.
- Treating ATS, lexical distinctness or a model-written review as permission to
  fabricate evidence does not count.
- Rewriting old applications until the new gates pass does not count as a
  compatibility migration.
