# Implementation notes

This public file records design decisions and reproducible, sanitised verdicts.
Private application content, company names, source lines, metrics, paths, and
field output stay in the external vault audit.

## Claim/evidence integrity (backlog 009)

### Second Stage 4 remediation

- Red first: screen-DOM inspection plus a separate print process accepted an
  owned screen node replaced by identical unowned print-only text; concurrent
  path replacement changed what Chrome consumed after hashing; event handlers
  in HTML/SVG executed before a verdict; short employer names matched inside
  unrelated words; and the hand-written entity decoder diverged from browsers.
- The verifier now reads and hashes authored HTML once, validates it with the
  standards parser, builds a restrictive-CSP snapshot synchronously, and uses
  one CDP page. That page emulates print media before navigation, waits once for
  load/fonts, inspects painted ownership in the print DOM, and sends that exact
  document revision to `Page.printToPDF`. PDF text remains supplemental.
- Declarative preflight is a parser-backed element/attribute/URL allowlist. It
  rejects event attributes, active foreign-content handlers, executable URLs,
  frames/srcdoc, embedded objects, refresh directives and scripts before Chrome.
- The same parser now owns named-entity decoding, block/inline text semantics,
  and source claim-marker extraction. Employer subjects use normalised whole-
  phrase boundaries rather than substring search.
- Public notes retain only aggregate sanitised verdicts; private target names,
  metric relationships, per-pack totals and corpus inventory stay in the
  external audit.

### Stage 4 remediation

- Red first: employer authority still accepted `ourselves`; the schema admitted
  public and crossed subject/namespace states; source text inserted a space
  before inline punctuation; authored scripts executed; print-only prose was
  invisible to the screen-DOM verdict; text-indent, near-zero scale,
  white-on-white and transparent descendants passed an outer-box visibility
  test; and the replay script neither isolated nor detected input mutation.
- Binding serialization is now canonical by key, so strict-schema parsing cannot
  stale a digest merely by reordering object properties.
- The shared claim renderer and the existing canon renderer use one painted-text
  function. It measures every descendant text node with `Range` rectangles after
  transforms, viewport and ancestor clipping, effective font/opacity/fill, and
  foreground/background contrast.
- The final entrypoint rejects scripts before Chrome, waits for fonts in its
  fixed inspection viewport, prints the same source to PDF, extracts the real
  PDF text layer, and reconciles every claim plus any print-only residue.
- Canon migration now emits complete identities for distinct same-period private
  fleet metrics without inventing denominators or timeframes: inapplicable
  dimensions are explicit.
- Real-Chrome files are bounded to two workers. This avoids unbounded concurrent
  Chrome launches terminating CI without a verdict while retaining parallelism.

The requested `superpowers:test-driven-development` skill was unavailable in
this session. The remediation nevertheless followed its red-first sequence,
with the failing results above captured before implementation.

### Contract

- `evidence.yaml` v2 is a discriminated union with exactly two authority pairs:
  candidate/candidate and employer/employer. A mixed or public third state is
  not representable. HTML repeats the pair; disagreement fails closed.
- Every authored visible text node must have exactly one owner: a claim marker,
  or `data-nonfactual-reason` with a non-empty reason. Chrome enumerates the
  rendered DOM, including direct text, inline/semantic/table elements, headings,
  quotations. Authored scripts are rejected before execution; unknown or
  multiply-owned residue blocks.
- `analyzeClaimIntegrityPreflight` is explicitly source-only. The public
  `verifyClaimIntegrity` entrypoint inspects painted descendant text geometry
  in Chrome and reconciles text extracted from an actual print-to-PDF run;
  static evidence can never produce the final pass verdict.
- Candidate-looking fragments fail closed as candidate claims. First-person,
  named-candidate, third-person, and common pronoun-free achievement fragments
  cannot borrow employer/JD authority. Employer claims must explicitly name the
  employer subject recorded on the archived source.
- Structured metrics require value, subject, unit, denominator, scale, and
  timeframe. A genuinely absent dimension is written explicitly as
  `not-applicable`; omission is not equivalent to not applicable.
- SHA-256 bindings cover exact artifact bytes, exact claim text, and archived
  employer/JD source bytes plus source text. Text or source replacement stales
  the evidence. These deterministic bindings remain compatible with the later
  signed pack receipt; they do not claim semantic entailment.

### Adversarial verdicts

- PASS: exact rendered candidate binding with complete source metric identity.
- PASS: explicitly attributed employer statement bound to an unchanged archived
  vacancy source.
- BLOCK: unmarked headings, spans, semantic containers, table content,
  quotations, root text, and DOM-injected text.
- BLOCK: empty, hidden, duplicated, case-colliding, stale, and numerically
  incomplete claims.
- BLOCK: employer authority attached to candidate achievements, and employer
  prose without explicit subject attribution.
- BLOCK: omitted or mismatched metric dimensions, edited artifact/claim text,
  and replaced archived employer sources.
- BLOCK: text-indented off canvas, effectively zero-scaled, transparent-child,
  and white-on-white claims; print-only unowned factual text; authored scripts.
- PASS: presentation-only `<strong>`, `<em>` and `<a>` markup, entities, and
  adjacent punctuation preserve exact browser/source text.
- PASS: an exact private metric paragraph bound to its correct migrated fact;
  BLOCK: the same exact paragraph rebound to a semantically different metric.

### Private field replay

The replay discovers strict `evidence.yaml` files, inventories every canon,
evidence, referenced HTML and employer archive byte they consume, copies them to
a temporary mirror, migrates the copied canon, and invokes the built public CLI
only against that mirror. It detects child mutation of temporary inputs and
re-manifests the entire original vault after execution. A zero-artifact result
is discovery only, never a pack verdict. No private fixture, path, output, or
byte is committed here.

The finished high-level verifier was also run from temporary byte-for-byte
copies of a representative private application corpus. The aggregate verdict
blocked the audited legacy failure class and the post-run digest recorded zero
private-byte deltas. Per-pack diagnostics and inventory remain external.

### Stage 4 verification

- Production build: PASS.
- Full suite after the second remediation: PASS, 34 files and 352 tests.
- Real Chrome/PDF adversarial CLI: PASS for print-only text, scripts, exact
  inline text semantics, complete self-reference, exact print substitution,
  active HTML rejection and concurrent path replacement.
- Standards parser matrix: PASS for event handlers, executable URLs, active
  SVG/MathML, frames/srcdoc, embeds/objects, refresh directives, named entities,
  inline punctuation and authored block spans. Production dependency audit:
  zero known vulnerabilities.
- Temp-copy replay mutation harness: PASS; both temp-input and original-vault
  mutation are detected. Private discovery details remain in the external audit.
- Package dry-run: PASS; the published tarball includes the evidence authority,
  claim verifier, contract documentation and replay harness. Prose lint and
  diff hygiene: PASS. Clean-worktree and fresh full-suite evidence are rerun
  from the committed tip before handoff.

### Third-review hardening

- Artifact evidence now seals a deterministic manifest for the complete local
  render dependency closure: stylesheets, recursive CSS imports, fonts and
  images. Dependencies must stay inside one evidence-relative root; remote,
  missing, undeclared, unused, symlink-escaped and stale bytes fail closed.
- The immutable print mirror contains only the declarative HTML snapshot and
  the verified declared resource bytes. Its `try/finally` begins immediately
  after temporary-directory creation, including copy and write failures.
- Chrome target creation and WebSocket opening have independent bounded
  handshakes. Failure closes a partial socket and always terminates the browser
  process and removes its profile.
- Exact claim text comes from the immutable print DOM after computed CSS. The
  source parser remains the active-content and structural preflight, avoiding
  false failures when class CSS blockifies adjacent inline elements.

### Final resource review

- The evidence-relative resource root is checked again after `realpath`, so a
  symlink cannot relocate the whole dependency tree beyond the evidence root.
  Every discovered file retains its own physical containment check.
- CSS references retain grammar-derived type through recursive discovery:
  case-insensitive `@import` targets are always parsed as CSS, while ordinary
  `url()` targets are copied as opaque bytes. Filenames and URL suffixes do not
  determine type.
- `buildResourceManifest` is the supported public authoring API. Manifest paths
  are NFC-normalized and sorted by UTF-8 byte order, independent of host locale.
- Snapshot fault adapters are internal implementation detail and cannot be
  supplied through `VerifyClaimIntegrityInput`.
- The DevTools target request shares one deadline across headers and JSON body.
  A stalled body is aborted and cancelled; partial sockets, targets, browser
  processes and profiles are cleaned on failure.

### CSS escaped-resource closure

- CSS resource discovery now consumes CSS Syntax tokens from the CSSTools
  tokenizer. Decoded at-keyword and function values classify standards-valid
  escaped spellings without regex reconstruction.
- Quoted URL candidates inside `image()`, `image-set()` and
  `-webkit-image-set()` are inventoried at any supported nesting depth;
  ordinary nested `url()` tokens remain independently discoverable.
- Real Chrome confirms parity for escaped `url()` and escaped `image-set()`
  computed styles. Remote, missing and out-of-root string candidates fail the
  same containment gate as every other resource.
- Token traversal keeps a function-frame stack: only direct string children of
  supported image functions are resource candidates. Descriptor strings inside
  `type()` or unrelated nested functions remain metadata, while nested image
  functions classify their own direct children.
- `@import` authority is consumed by exactly its first string or URL target;
  later `layer()`, `supports()` and media-condition strings cannot become
  accidental stylesheet dependencies.
- Verified CSS rejects decoded `var()`, `env()` and `attr()` functions before
  resource traversal. Real Chrome demonstrates that `var()` can resolve into
  an `image-set()` URL, so accepting it would make static manifest closure a
  claim the verifier cannot prove.

## Backlog 010 — complete-pack transaction

### Accepted-stack integration

- Merged accepted `codex/009-claim-evidence` tip `846ac0e` into the existing
  stacked 010 branch. Accepted `codex/008-requirement-fit` tip `41a64b2` remains
  an ancestor through both sides of the merge.
- Where the old embedded 009 implementation conflicted, the accepted 009
  snapshot/resource/DevTools implementation won. The stronger existing private
  replay properties were reconciled: isolated temp-copy replay and vault
  mutation detection remain, alongside non-vacuous required-group manifests
  and named expected-negative gate issues.
- The accepted 009 branch had removed the accepted 008 requirements CLI and
  public exports despite retaining 008 in ancestry. The integration restored
  `migrate-requirements`, external baseline issuance, verified `fit`, separate
  `requirements-ats`, the legacy command name, smoke's verified-fit path, and
  all requirements/fit/ATS public exports. The combined stack now preserves
  both accepted APIs rather than treating graph ancestry as functional proof.
- The accepted claim verifier now optionally copies out the exact PDF produced
  from its inspected immutable snapshot, and only after the claim verdict
  passes. `verify-pack` uses that PDF as its candidate artifact; it does not run
  a second independent render.

### Transaction and freshness decisions

- The candidate directory is an atomic publication boundary. HTML, PDFs,
  findings, bindings, and receipt are prepared under a hidden sibling staging
  directory and exposed by one rename only after all blockers pass.
- Receipt bindings cover the descriptor itself (including page budgets and
  artifact declarations), all named source classes, corpus membership, waivers,
  attestations, exact HTML/PDF outputs, and the engine revision. The receipt's
  canonical digest also makes finding/disposition edits stale.
- Advisory failures require an explicit disposition and stay `ok: false`.
  `ready-for-human` means deterministic blockers passed, not that editorial
  judgement was silently promoted into proof.

### Unhappy-path checklist

- Empty/zero/missing: empty artifact sets, missing policy/input files, missing
  Chrome, missing Poppler, and empty PDF text layers fail without publication.
- Reload/persistence: the emitted JSON receipt is parsed from disk and all
  source/output hashes are recomputed by `verify-pack-fresh`.
- Concurrency/re-entrancy: simultaneous writers to the same candidate yield one
  winner; the losing rename fails and its private staging directory is removed.
- Malformed/hostile: malformed descriptors, invalid findings, duplicate IDs and
  output names, path-constrained PDF names, mixed-generation source mutation,
  receipt tampering, and post-publication output mutation fail or report stale.
- Injected mid-render, receipt-write, Chrome, Poppler, blocking-gate, and
  mixed-generation failures all leave no visible candidate.

### Field-fixture limitation

- The configured real acceptance packs were inspected read-only through the
  environment-driven field harness. Both are legacy output folders, not complete
  production trust packs: each lacks the strict pack descriptor, in-pack canon,
  requirements, external baseline receipt, evidence/claim map, strategy,
  versioned policy, preferences, and lifecycle corpus descriptor. One has only
  prose research rather than the strict research schema.
- The authored HTML also predates accepted 009's complete claim markers and
  evidence bindings. Creating a ready receipt would require inventing claim
  authority, reviewed requirement evidence, lifecycle status, or human
  resolutions. The field gate therefore remains RED and backlog 010 remains
  blocked; no synthetic substitute is described as real evidence.

### Stage 4 authority and trust remediation

- Only the public production entrypoint can emit `tailored.verify-pack` in
  `ready-for-human`. The injected transaction harness lives in a separate
  `*.testing.ts` module excluded from the production build; package exports also
  reject deep imports. Runtime, installed-package and type-surface attacks cover
  the boundary.
- One strict policy owns a complete 18-gate registry, severities, fit/ATS floors,
  readability floors, and corpus-distinctness thresholds. Missing, duplicate,
  or severity-swapped gates block before rendering; receipt finding IDs are
  unique and complete.
- Corpus members have exact path/hash/status and nested corpus descriptors are
  traversed recursively. Waiver and attestation records have globally unique
  IDs, exact pack/policy/finding-content scope, typed resolution, and canonical
  self-hashes. Duplicate, unused, stale, cross-pack, arbitrary-byte and competing
  resolutions fail closed.
- Descriptor bytes are read once, hashed and parsed as the same buffer. Every
  bound input/member is captured once; canon/evidence/requirements/policy use
  those snapshots, and fit plus ATS share one verified requirements object.
  A descriptor or source generation swap before publication removes staging.
- Output names are checked globally and case-insensitively across derived HTML,
  `.pdf` outputs, and reserved `receipt.json`. Engine identity is derived from
  the executing repository commit or installed-build digest, and freshness
  independently derives and compares the current identity.
- The synthetic public-production integration uses real Chrome, Poppler, the
  accepted claim snapshot verifier, strict requirements/evidence/policy/corpus,
  and all production gates. It emits an authoritative receipt without adapters;
  this validates the engine, not the unavailable private field evidence.

### Structural authority remediation

- HTML is captured once with the other source bindings and written to staging.
  Claim verification reads that staged path while retaining the evidence-declared
  source identity for artifact/resource checks. The inspected PDF, staged HTML,
  and receipt therefore bind one byte generation. A mutate-then-return race on
  the original path cannot change the rendered candidate.
- Issued production receipt objects carry runtime-only provenance in a private
  issuer registry. Fresh JSON with a correct canonical digest is explicitly not
  accepted as verifier-issued; digest proves integrity, not who ran the gates.
- The configured field harness copies supplied private packs into temporary
  storage, recursively manifests the untouched source, verifies production,
  mutates and restores every descriptor/input/artifact/resolution/corpus member
  plus exact outputs, and requires every old receipt to become stale. The current
  legacy packs still fail the prerequisite inventory before this path can run.

### Stage 4 verification

- Full suite: PASS; 48 files passed, the environment-driven private field file
  skipped without configuration, and 462 tests passed.
- Authoritative production integration: PASS through real Chrome and Poppler;
  all 18 policy gate IDs appeared exactly once, the receipt was authoritative,
  and no adapter was accepted by the public API.
- Authority/schema adversarial slice: PASS for test-only receipts, absent public
  adapters/declarations, missing/duplicate/wrong-severity gates, corpus status
  and hash validation, typed resolution scope/self-hash, case-folded output
  collisions, descriptor/source generation swaps, and engine staleness.
- Build, repository prose lint, package dry-run, and production-dependency audit:
  PASS. The tarball contains the public policy/trust schemas and no test adapter
  declarations; production dependencies report zero known vulnerabilities.
- Configured private field gate: BLOCKED/RED for both acceptance packs with the
  same ten missing trust files. No candidate was created and no private file was
  modified.

### Structural verification

- Staged-byte mutation-return race: PASS in both transaction and accepted claim
  verifier tests; the original path can change and return without changing the
  inspected staged HTML or exact PDF.
- Engine provenance: PASS; no CLI identity flags remain, checkout/build identity
  is deterministic, and a separately self-consistent fake engine receipt is
  stale against independently derived current identity.
- Runtime/package authority: PASS; verifier-issued objects are accepted in the
  issuing runtime, reconstructed JSON is rejected as provenance, the test module
  is absent from `dist`/tarball, and package exports reject deep imports.
- Resolution generation: PASS for one exact attestation; duplicate and cross-pack
  reuse fail before publication. Nested corpus traversal is exercised by the
  production Chrome/Poppler integration.
- Final build, prose lint, package dry-run, privacy slice, package-install attack
  test, and production dependency audit: PASS. The installed package contains no
  test verifier artefact; production dependencies report zero vulnerabilities.

### 2026-07-13 real-pack unblock

- Private fixtures A and B now carry complete production trust inputs built from
  their human-approved HTML, archived postings, reviewed requirement maps, the
  16-document submitted corpus, strict policy and exact editorial attestations.
- Both packs pass `verify-pack` through real Chrome and Poppler as one-page CV and
  cover candidates; their receipts pass `verify-pack-fresh`.
- The private field harness now optionally copies the fixture root so sibling
  corpus paths remain valid inside disposable storage. Both real packs passed
  mutation checks for every bound input and output without changing source bytes.
- Superseding verification: 49 test files, 463 tests, the two configured private
  field tests, production build, the private vault's test suite, typecheck and production
  build all pass.

## Canon v2 and prohibited claims (backlog 007)

- Exact public CLI attacks for inline/global transparent text, zero font size,
  extreme negative positioning, and a zero-area clip rectangle all block. A visible entry
  positioned against the page's right edge passes.
- Nested horizontal and vertical `overflow:hidden` containers fully clipping an
  owner/source pair block; a partially intersecting nested control passes.
- Production build and focused browser boundary: PASS. Full suite: PASS; 29
  files, 264 tests.
- Shipped Alex public CLI and one-page render: PASS; extracted text remains
  SHA-256 `8f87f2264da69420430161c7027d82443697f4077961f6bbd8a065f350872ebe`.
- Package and private-field gates remain unchanged: public inspector declarations
  and ledger ship without conflict artefacts; both configured private fixtures retain required
  conflicts with no numeric coverage/exemption errors.

## Recovery deviations

- The permanent local repository was reconstructed from `origin` because 60
  included iCloud files remained dataless and File Provider made no progress.
  The source-only commit and all local branch refs were then fetched directly
  from the read-only iCloud repository, and the seven source-only conflict
  copies were preserved by matching SHA-256 manifests.
- The authored slice above was replayed from timestamped Codex `apply_patch`
  calls. All ten reconstructed paths matched the preflight SHA-256 manifest
  before this recovery note was appended.

## Backlog 008: requirement-evidence fit

- Added strict `requirements.yaml` v2 records bound to the exact archived-JD
  SHA-256. Every requirement freezes an exact source quote/location,
  hard/preferred classification, positive weight, eligibility impact, ATS terms,
  and direct/transferable canon fact IDs, an explicit gap, or a dated waiver.
- Fit now accepts only the frozen requirement map. Direct evidence earns full
  weight, explicitly transferable evidence half weight, and gaps/waivers no
  evidence weight. Hard eligibility blockers force `BLOCKED` and remain listed
  even when the aggregate would otherwise be strong. Literal ATS coverage is a
  separate function and command that cannot affect fit.
- The old keyword model remains behind `legacy-fit` and the legacy `ats --jd`
  command. Their output explicitly says it is keyword compatibility, not
  verified fit. `migrate-requirements` produces explicit gaps and refuses to
  invent a source quote when a legacy keyword or synonym is absent from the
  archived posting.
- The fictional Alex Rivers fixture now carries canon fact IDs and a hash-bound
  `requirements.yaml`; the shipped smoke path exercises verified v2 fit.

### Unhappy paths written before implementation

- Empty/zero/missing: empty requirement arrays, zero weights, missing
  requirements files, missing archived-JD text, and zero ATS terms are covered.
- Reload/persistence: a persisted YAML record is loaded twice with identical
  results; hash and quote checks rerun on every load.
- Concurrency/re-entrancy: parsing and fit are pure, synchronous functions with
  no shared state or writes. Repeated parse calls are asserted equal and caller
  input is asserted unchanged; no asynchronous concurrency path reaches them.
- Malformed/hostile: malformed waiver dates/hashes, stale JD hashes, source
  quotes absent from the archive, unknown/case-mismatched fact IDs,
  duplicate/case-colliding requirement IDs, and post-freeze reclassification
  without a receipt-bound waiver all fail closed.

### Deviations

- The two legacy private `jd.yaml` files contain interpreted keyword
  phrases that are not always verbatim posting text. Migration therefore refuses
  those entries rather than laundering them into supposed quotes. The real field
  test freezes every actual posting bullet directly and leaves unmatched claims
  as explicit gaps. This is the conservative boundary: a failed migration is
  repairable; invented employer wording is not evidence.
- Sponsorship is not resolved by either posting. Each field map records the
  posting location as the exact source quote and keeps sponsorship/right-to-work
  as a visible eligibility uncertainty rather than guessing a blocker or pass.

## Backlog 008 review remediation

- The complete pre-change map is now persisted twice by design: readable
  requirement records plus their canonical byte string. A SHA-256 digest and
  self-verifying freeze receipt bind that canonical baseline to the archived JD
  and freeze timestamp. Any mutation to quote, location, byte span, class,
  bounded weight, eligibility, ATS inventory, evidence IDs/kind, gap note, or
  metadata invalidates the baseline before fit runs.
- Permitted reclassification is a separate ordered `changes[]` event. Its prior
  receipt must be resolved explicitly and hash-match the baseline receipt, JD,
  requirement ID, action, exact before and after values, waiver approval, and change date. Missing,
  fake, replayed, future, pre-freeze and stale receipts fail closed. The receipt
  binds the prior baseline, avoiding a self-referential current-receipt hash.
- Fit now requires an explicit fact policy and the live canon. Only verified or
  explicitly allowed candidate-attested facts above the confidence floor, with
  `fit` in `allowedUses`, permitted sensitivity and permitted provenance can earn
  weight. A later status/policy change immediately removes that weight.
- Requirement weights are finite, positive and capped at 100; maps are capped at
  1,000 records and the aggregate is rechecked before scoring. Blocked or
  uncertain eligibility must carry gap evidence, preventing a direct-evidence
  record from contradicting its eligibility state.
- The two real private field maps now preserve every complete wrapped
  bullet with exact byte spans and all 48/53 terms from the reviewed legacy
  inventories. ATS is evaluated at the real 80% threshold. Temporary private
  requirements and rendered PDFs live in one temporary directory removed in a
  `finally`, with an injected-failure cleanup regression.

### Review-remediation verification

- TDD red: baseline/receipt APIs were absent and all four integrity tests failed;
  trust-policy tests showed disputed, unverified and disallowed facts still
  earning full weight. The implemented adversarial suite now covers field-level
  baseline mutations, baseline receipt tampering, fake/missing/hash-mismatched
  receipts, JD/requirement/action/waiver replay, duplicate receipt reuse,
  pre-freeze/future/stale dates, evidence-waiver eligibility contradictions,
  disputed/unverified/zero-confidence/no-fit-use/confidential/provenance policy,
  per-record and aggregate overflow, and injected-failure cleanup.
- Default suite: PASS, 35 files/296 tests passed and one field-test file skipped; the three private field tests are
  deliberately skipped unless `TAILORED_PRIVATE_VAULT` is supplied. Explicit
  private suite: PASS, 3/3, and no matching private temporary path remained.
- Private fixture A (shape only; the audited counts stay in the private vault): exact-span
  records for every JD bullet, all reviewed ATS terms represented, some eligible direct and
  transferable evidence, the remainder material gaps, sponsorship uncertain, verified fit
  WEAK, rendered-PDF ATS FAIL at the real 80% threshold.
- Private fixture B (shape only): exact-span records, all reviewed ATS terms, eligible
  direct evidence, one confidential mapped fact rejected as ineligible, the remainder
  material gaps, sponsorship uncertain, verified fit WEAK, rendered-PDF ATS FAIL.
- Production build, self-lint, browser/Poppler smoke, `git diff --check` and npm
  package dry-run all pass. The unrelated conflict-copy test is byte-identical
  to the accepted 007 parent again.

## Backlog 008 second re-review remediation

- Baseline trust moved outside `requirements.yaml`. The file stores the
  canonical map, digest and external receipt digest only. Validation requires a
  trusted `baselineReceiptResolver`; a self-consistent replacement produced by
  the local preparation/issuance primitives still fails when the trusted store
  retains the original anchor. `issue-baseline-receipt` is the explicit,
  separately persisted issuance operation.
- Structural and historical parsing no longer consults today's date. Pre-freeze
  receipts always fail; future/staleness checks run only when callers explicitly
  supply `asOfDate` and optional maximum age. Repeated CLI calls over identical
  files produce identical output.
- ATS vocabulary now separates exact archive-sourced literals from reviewed
  aliases/paraphrases. Literal terms carry their own source span/location and are
  the default scoring authority; aliases enter only through explicit policy.
  Zero-overlap legacy terms are rejected, not attached to a convenient bullet.
- Canon migration no longer adds `fit` authority. The private field test clones
  the migrated canon, explicitly grants `fit` only to reviewed referenced fact
  IDs, and asserts candidate-attested statuses do not change.
- Superseding field result: private fixture A has 43 literal source terms, 12 aliases and
  one rejected zero-source term (`Python`) across the 48 reviewed legacy terms;
  rendered literal ATS is 72.1%/FAIL at 80%. Private fixture B has 52 literals, 6 aliases,
  no rejected term and rendered literal ATS 51.9%/FAIL. Fit remains 10.4% and
  11.3% respectively.

### Second re-review verification

- Red first: a requirements file could regenerate its own weight/ATS baseline;
  ATS still accepted unanchored keyword arrays; legacy migration granted every
  migrated fact `fit`. New attacks prove missing external baseline resolution,
  internally regenerated weight/ATS bindings, raw/unbranded fit/ATS inputs and
  silent migration authority all fail.
- Default suite: PASS, 36 files/303 tests passed with the private field file
  skipped. Explicit private suite: PASS, 3/3. Build, self-lint, deterministic
  repeated fit CLI, one-page browser/Poppler smoke, package dry-run and diff
  check pass; no private temporary paths remain.
- Final field authority uses literal terms only at 80%: private fixture A 72.1% and
  private fixture B 51.9%, both FAIL. Fixture A's reviewed-but-posting-absent `Python`
  entry is explicitly rejected instead of being attached to an unrelated source.

## Backlog 014 — retire the verify-pack doppelganger

### What replaced the wall

- `src/verify/pack.testing.ts` was a hand-maintained second implementation of the
  pack transaction. It is deleted. `verifyPack` now takes an optional third
  argument that overrides only `verifyAndRender`, `extractText` and `pageCount`.
  Filesystem access, hashing, snapshot capture, the gate registry and the
  staging/atomic-rename transaction are not injectable and always run for real.
- Three guard tests used to defend the duplication. They are replaced by data:
  the receipt payload carries `dependencies: "production" | "injected"`, inside
  the hashed payload, so `receiptSha256` binds it. Any third argument — even an
  empty object — yields `"injected"`.
- `verifyReceiptFreshness` pushes `receipt:provenance` for a receipt whose
  provenance is not production, so the `verify-pack-fresh` CLI lane exits 1 on an
  injected receipt even when that receipt is internally self-consistent.

### Legacy receipts

- The field is optional on parse and absent means production, so receipts written
  before this change still parse and still verify. `canonicalJson` drops undefined
  values, so an absent field leaves the pre-change digest untouched.
- Stripping `dependencies` from an injected receipt does not launder it: the
  remaining payload no longer hashes to the recorded `receiptSha256`, so freshness
  reports `receipt:integrity`. Both directions are asserted in pack.test.ts.
- `src/verify/fixtures/legacy-receipt.json` is a genuine pre-change artefact,
  minted by the pre-change CLI with real Chrome and real Poppler over
  `src/verify/fixtures/legacy-pack`. The fixture pack binds the published
  `examples/alex-rivers` canon, job description, requirements and baseline
  receipt in place; only the claim-annotated artefacts, evidence map, policy,
  strategy, research, preferences and corpus are authored beside them.

### Test port

- All 13 scenarios from the old clone-driven pack.test.ts now drive the real
  `verifyPack`; the gates run for real against a complete fixture pack. Two
  scenarios could not be ported literally, because the behaviour they injected no
  longer exists:
  - The old suite injected a failing `blockingChecks` adapter. The seam no longer
    offers one, so the blocking-failure case now comes from a `verifyAndRender`
    adapter that returns a failing claim-integrity finding — the real registry
    aggregates and blocks on it.
  - The old suite injected an advisory finding with no disposition, and a
    `writeReceipt` adapter that threw. Neither is reachable: the registry always
    assigns a disposition, and the receipt write is not injectable. The
    disposition invariant is now asserted on both ends (schema rejects an
    undisposed advisory finding; every failing advisory finding in a real receipt
    carries `review-required`), and the interrupted-write case squats the reserved
    `receipt.json` name inside the staging directory so the real `wx` write fails.
- Injected receipts are never fresh, so the ported staleness assertions filter the
  always-present `receipt:provenance` key and assert on the remaining classes.

### Verification

- `npm test`: 485 passed, 1 skipped, 52 files (2 skipped: the env-gated private
  field lane and the private replay lane).
- Field test on this machine (real Chrome 141, Poppler 26.06):
  `node dist/cli.js verify-pack src/verify/fixtures/legacy-pack/pack.yaml <out>`
  passes with every blocking finding ok and `dependencies: "production"`;
  `verify-pack-fresh` then exits 0. Re-signing that same receipt with
  `dependencies: "injected"` makes the same command exit 1 with
  `stale verify-pack receipt: receipt:provenance`.
- The literal acceptance wording asked for the field run over
  `examples/alex-rivers`. That directory is not a complete pack — it has no
  evidence, policy, corpus, strategy, research or preferences file, and its CV and
  cover carry no claim markers, which claim integrity requires. Annotating the
  published example is a separate, larger change outside this unit's paths, so the
  field pack binds the example's real trust inputs and supplies the missing files
  beside them.

## Backlog 015: one Gate interface and one registry

### Shape

- `src/gates/gate.ts` holds the contract: `Finding = { id, ok, messages[] }`,
  `Gate = { id, severity, run, command }`, the `GateInput` the pack lane shows a
  gate, and the small helpers gate commands share (option naming, the requirements
  flag block, the receipt resolver).
- `src/gates/registry.ts` holds the set. Its first block is the pack lane in
  receipt order; its second is the terminal-only legacy checks (`page-fit`,
  `ip-guard`, `legacy-ats`, `legacy-fit`, `trace`) that no receipt has ever
  recorded. `PACK_GATES` is the first block, and it is what `policy/verify.ts` and
  `verify/pack.ts` consume, so no gate is added to or dropped from the pack lane.
- `verifyPolicySchemaFor(gates)` builds the policy schema from a gate list;
  `VerifyPolicySchema` is that function applied to `PACK_GATES`. Every ID string
  and severity is unchanged, so existing policy.yaml files and receipts parse as
  before.
- `assembleFindings(input, policy, resolutions, gates)` in `verify/pack.ts` runs
  the registry and normalises each verdict. The two runtime assertions are gone
  because they are now structurally impossible: one finding per registry gate
  cannot duplicate an ID, and the policy schema already refuses a policy that does
  not name exactly the registry's set.
- `cli.ts` declares the nine commands that are not gates and registers every gate
  command from the registry, in a pinned order so the published help is unchanged.
  A newly registered gate appends to the end of the help without a cli.ts edit.
  One `report()` prints every gate command's output and exits from `Finding.ok`.
- `cli.ts` now exports `buildProgram(gates)` and only parses argv when it is the
  process entry point, so a test can inspect dispatch without running the CLI.

### Two lanes, one verdict

- A gate's receipt messages and its terminal messages are worded differently and
  always have been (`mdash-entity at line 3` in a receipt, `cv.html:3:
  mdash-entity ("&amp;mdash;")` in a terminal). Both lanes are a contract: receipts
  are hashed and the downstream vault's `ats-decisions` gate greps the `ats` command's WARN
  lines verbatim. So a gate exposes both: `run` for the receipt, `command.run` for
  the terminal. Neither recomputes a verdict; both call the same analysis function.
- `ConsoleReport` is a `Finding` plus the one-line `summary` a terminal prints, and
  an optional `verdict` word for `fit` and `legacy-fit`, which print `STRONG:` or
  `APPLY:` rather than `PASS:`.

### The one behaviour change

- `impact` printed its three readability messages unconditionally while its verdict
  respected the `--skip-*` flags. A document failing only the font floor, run with
  `--skip-min-font`, printed the violation, said it was clean, and exited 0; the
  same flag also inflated the reported violation count. The message list, the
  count, the verdict and the exit code now all derive from the same enabled-check
  set. Three oracle cases move, all the same fix:
  - `impact tinyfont.html --skip-min-font`: the silenced font line is no longer
    printed. Exit stays 0.
  - `impact bad.html --skip-min-font`: `4 violation(s)` becomes `3 violation(s)`.
    Exit stays 1.
  - the same with more flags: `3 violation(s)` becomes `2 violation(s)`. Exit
    stays 1.
- `src/gates/impact.cli.test.ts` pins both directions. Both new cases fail against
  a merge-base build and pass here.

### Incidental differences (evidenced, outside the oracle)

- `lint` used to print a file's tells as it went, so an unreadable file part-way
  through a batch still showed the earlier files' lines. That is preserved:
  `GateInputError` carries the messages produced before the command gave up, and
  the CLI prints them before `FAIL:`. Same for the `ats` orphan-synonym warnings
  and `ip-guard`'s leak lines.
- `smoke` renders the example PDF before running the gate set rather than after the
  text gates. With a passing example the output is identical; with a failing one it
  now spends a Chrome render first.
- `smoke`'s failure wording is generic (`example fails <gate>: ...`) instead of one
  bespoke sentence per check. The success line is byte-identical.

### Deferred, deliberately

- Thresholds still live in two places: the policy schema declares the eight numbers
  and `GateThresholds` names the same eight. Card 3 owns `policy/thresholds.ts`.
- `smoke` re-derives the page count and the legacy ATS ratio its summary line
  quotes, because a `Finding` carries a verdict and not those figures. A report
  shape rich enough to carry them belongs with card 5.

### Verification

- Per-command oracle: 88 invocations (every command, its `--help`, and its failure
  paths) over `examples/alex-rivers` and `src/verify/fixtures/legacy-pack`, run
  against a merge-base build and this one. Four files differ: the three enumerated
  `impact` cases, and `verify-pack`'s receipt digest, which differs between two
  consecutive runs of the merge-base build as well, because Chrome stamps a
  creation date into the PDF. The receipt's findings are byte-identical.
- `npm test`: 494 passed, 1 skipped, 53 files. `npm run lint:self` clean.
  `node dist/cli.js smoke` passes.
- Cross-repo field test: `npm pack` of this build installed into a scratch copy of
  the downstream vault (the live checkout was read from and never written to).
  `bash scripts/battery.sh --text --vault ../..` over the practice vault reports
  `TEXT PHASE GREEN (14 gates)`; `python3 tests/test_gates.py` reports 46 tests OK.
  `npx tailored --version` resolves through the npm bin shim, which is what proves
  the new entry-point guard does not break the installed CLI.

### Deviation: diff budget

- The unit's budget was 550 new production lines with a net target of +100. The
  result is roughly 1400 added and 700 deleted across 17 production files. The
  budget assumed the CLI's per-command wording would be absorbed by the shared
  formatter; it cannot be, because each command's detail lines and verdict sentence
  are a preserved contract, so about 470 of those lines are relocated from cli.ts
  rather than new. cli.ts itself sheds 296 lines net. The genuinely new code is
  `gate.ts` and `registry.ts` (about 300 lines) plus one `run` per pack gate.
  Speculative surface was stripped before reporting this: an unused
  `DEFAULT_THRESHOLDS`, two duplicated analysis blocks, and three index exports.

### Review remediation (dual review, 2026-07-29)

- **Pack-lane membership is declared, not inferred.** `PACK_GATES` was
  `GATES.filter(entry => entry.run !== null)`, so giving a terminal-only gate a
  receipt lane silently promoted it to a required policy gate and every existing
  policy.yaml started failing. `PACK_GATES` is now a written-out list of the
  eighteen and `GATES` is `[...PACK_GATES, ...TERMINAL_ONLY_GATES]`. Two probes:
  giving `legacy-fit` a `run()` leaves `PACK_GATES` at eighteen and the fixture
  policy parsing; adding it to the declared list fails four independent
  assertions.
- A new `PackGate` type (a `Gate` whose `run` is required) is what `PACK_GATES`,
  `verifyPolicySchemaFor`, and `assembleFindings` accept. That deletes the
  `run !== null` filter in `policy/verify.ts` and the unreachable guard in
  `assembleFindings`, and each pack gate now declares its lane at its definition.
- `strategy-selection` and `evidence-altitude` moved out of the registry into
  `src/gates/strategy.ts`. The registry's own rule (it delegates, it never
  implements) is now true of every entry, and a grep of `src/gates/` finds them.
- Test pins that do not derive from the thing they check: `registry.test.ts` holds
  a hand-written list of the eighteen IDs in receipt order and a hand-written
  severity map, and asserts the policy schema's required set against the same
  literals. The old assertion compared `PACK_GATES` against a projection of
  itself, and incidentally pinned an all-blocking-then-all-advisory ordering that
  a legal new advisory gate would have broken.
- `COMMAND_ORDER` is now pinned twice: its set equals the builtins plus every
  registry command, and `buildProgram()` registers exactly it, in order. A renamed
  gate command used to slide silently to the end of the published help.
- `smokeCalls` is hoisted out of the smoke action and exported, so a test asserts
  every `SMOKE_SET` ID has an invocation. The action also fails cleanly on a
  missing one instead of throwing on `undefined.args`.
- Public API narrowed on the owner's ruling: `index.ts` exports `Gate`, `Finding`,
  `GateInput`, and `GateSeverity` only. `GateCommand`, `ConsoleReport`,
  `GateArtifact`, `GateThresholds`, and `PackGate` stay internal, because a
  published package cannot un-export a type without a breaking change and the
  CLI-declaration layer is not a shape a consumer should pin. `index.test.ts`
  checks the built `dist/index.d.ts`, not the source.
- Deferred by ruling, not fixed here: decorative severities on terminal-only gates
  (F2), the `GateInput` breadth that forces the test's cast (F7), `impact` and
  `accessibility` both calling `packResults` (F8), and smoke's inert `0.8` literal
  (card 3).

## Backlog 016: one canon projection, one atomic write, one threshold source

Architecture card 3, stacked on card 1 (backlog 015). Three duplications of
knowledge removed; no new capability.

### The one canon projection

`src/canon/corpus.ts` replaces `fit.canonToText` and `trace.canonCorpus`. The
field set is the union of what those two read. The table below is what was
tabulated before writing any code — a "union" that quietly dropped a field one
reader depended on was the main risk.

| canon field | fit (canonToText) | trace (canonCorpus) | distinct extras | one projection |
| --- | --- | --- | --- | --- |
| identity.name / role | – | yes | yes | yes |
| identity.location / email / phone | – | yes | yes | yes |
| identity.links (label + url) | – | – | yes | no (distinct only) |
| summary | yes | yes | – | yes |
| skills.label / value | yes | yes | – | yes |
| projects.name / tagline / bullets | yes | yes | – | yes |
| projects.links | – | – | yes | no (distinct only) |
| experience.title / org / bullets | yes | yes | – | yes |
| experience.start / end | – | yes | yes | yes |
| experience.location | – | – | yes | no (distinct only) |
| education.qualification / institution / note | yes | yes | – | yes |
| education.year / result | – | yes | yes | yes |
| certifications, publications | yes | yes | – | yes |
| claims.can | yes | – | yes | yes |
| facts, numbersThatStand, talkingPoints, positioning, protectedTopics, ipBoundaries, discretion, draftingGuidance, verifiedFacts, projects.year | – | – | – | no |

Two composition facts made this safe to unify, both checked before changing
anything: `ats.norm` collapses all whitespace before matching, and
`distinct.normalizeTokens` replaces every non-alphanumeric character with a
space, so newline-versus-space and part granularity are inert for both readers.
The numeric tokeniser's patterns are `\s`-based, so they are inert too. What
matters is only that no two fields are glued into one word.

`distinct` keeps a named extra (`distinctExemptionText`): link strings and an
entry's location. Stated reason, in the module: exemption is not evidence.
There a canon phrase only proves "this recurrence is a fact, not a voice tic";
in the trace corpus a digit inside a URL would pass as proof that a claim is
grounded. Widening the exemption corpus can only silence a false flag; widening
the evidence corpus would launder an unproven number.

### Every verdict change, enumerated

Method: a harness ran `legacy-fit`, `trace`, `distinct` (and `fit-blockers` as a
control that reads no projection) through the registry's command lane over the
bundled example and a read-only copy of the private downstream vault — 132 real
`jd.yaml` files, 179 real `cv.html`, 169 real `cover.html`, each distinct run
against every same-type document as priors — at the merge base and at HEAD.
832 records, 830 byte-identical, **zero verdict flips**.

1. `legacy-fit`, 2 records (two superseded packs for one ML-engineer role):
   must-have coverage 33% → 38%, verdict SKIP → SKIP. Causing field:
   `identity.role`, whose specialism phrase is exactly the JD must-have that had
   been reported as a gap.
   Justified: the gate's own gap message asks whether the canon genuinely lacks
   the term. It does not — the projection was under-reading the canon by
   ignoring the identity block. Both verdicts unchanged.
2. `distinctness` pack lane: a signature phrase found verbatim in the canon's
   identity block is now exempt, as it already was at the terminal. The pack
   lane used `canonToText` (no identity, no dates) while the command used the
   wider exemption corpus, so a receipt could flag the candidate's own job title
   as a voice tic. Proven both ways: the new test in `distinct.test.ts` fails
   against the merge-base build (message "signature collision … ai engineer
   agentic systems") and passes at HEAD. Not visible in the harness, which
   exercises the command lane; the fixture receipt covers the pack lane and its
   `distinctness` finding is unchanged.
3. `trace` gained `claims.can` as corpus. No document in the field set changed
   (0 of 348), and the direction is defensible: a number the canon itself
   declares as an approved claim is traceable to the canon by definition, and
   `fit` already treated `claims.can` as canon content.

   Stated plainly, because it is the one loosening in this unit: for the real
   canon, `claims.can` prose adds five numeric tokens the trace corpus did not
   have (`30`, `10.`, `3.`, `0.2.0`, `24`), some of them list enumerators inside
   sentences rather than metrics. A document claiming one of those figures would
   now trace where it previously would not.

   The reason that is containable rather than a trust regression is where the
   number is allowed to matter. `traceGate` declares `run: null` — it is
   terminal-only, so no verify-pack receipt has ever recorded a trace verdict and
   none can; its own summary says it does not prove semantic truth. The pack lane
   grounds a number through `claim-integrity`, which binds each claim marker to a
   record in an evidence file. That is also why `facts` and `numbersThatStand`
   are excluded from the corpus outright: a keyword sweep must not be able to
   declare a figure grounded because the canon states it somewhere.

   Accepted on those grounds plus two more: no document in the 348 moved, and the
   alternative — dropping `claims.can` — would narrow `fit`, which has read it all
   along, and would not be the union the acceptance requires.

   **Recorded for the owner, NOT changed here (review finding F2):**
   `untracedNumbers` matches on numeric VALUE alone, with no unit and no context,
   so a `1. 2. 3.` enumerator anywhere in canon prose grounds any document number
   sharing that value. The reviewer reproduced it (`3`, `24`, `30`). The defect
   predates this unit — the corpus has always contained prose — and narrowing the
   match is a scope change for the owner to rule on. Including `claims.can` was
   mandated by the union criterion, and it widens the set of enumerators slightly;
   it does not create the mechanism.

No flip was left as a note; there was no unjustifiable flip to report.

### One atomic write

`src/fs/atomicWrite.ts` replaces three implementations in `cli.ts`. The
receipt path's property — it must FAIL when the target exists — survives as
`exclusive`, implemented the same way (link, not rename), and the temporary is
now removed in a `finally` so it cannot outlive a throw. Each caller still
phrases its own failure, so stderr is unchanged. `jd-pdf`'s scratch HTML for
Chrome is deliberately untouched: it is not a durable artefact, and it belongs
with the renderer split (card 4).

### One threshold source

`src/policy/thresholds.ts` owns the standards. The eight policy-settable numbers
keep their schema verbatim (still `.strict()`, still no `.default()`, so every
existing policy.yaml parses exactly as before, and a file still may not omit a
key); `gate.ts`'s `GateThresholds` is now that schema's inferred type instead of
a parallel interface. `impact`'s defaults, every CLI flag default (impact's six,
`ats`/`requirements-ats` `--min`, `page-fit --max`, `distinct`'s two,
`legacy-fit`'s two), and smoke's inert `0.8` all read it.

Grep proof: outside `policy/thresholds.ts` and tests, `src/` contains no
threshold literal. The only remaining matches for `1.28|0.8|0.5|60|45|18` are
`fit.ts`'s three named algorithm constants and a `padding-left: 18px` in the
archival JD stylesheet.

Deliberate boundary: the fit verdict scale (`STRONG_SCORE`, `MIXED_SCORE`) and
`TRANSFERABLE_CREDIT` stay in `fit.ts` as named constants. Those define what a
score means; a policy threshold decides what a document must reach. Coupling
`fitMinimumScore` to `STRONG_SCORE` would let a stricter policy silently
redefine the word STRONG.

### Deviations

- **Three files outside the scope contract's allowed paths**, each mandated by the
  no-threshold-written-twice criterion and each a two-to-four line edit:
  `gates/ats.ts` and `gates/pageFit.ts` own the `--min` and `--max` flag defaults,
  and `gates/gate.ts` held the parallel `GateThresholds` interface. Twelve
  production files in total against a budget of fourteen.
- **A privacy guard was red on this branch's merge base, and one fix reaches
  outside the allowed paths.** `no-personal-data.test.ts` only runs its term
  checks where `.security/denylist.local.txt` exists, and a git worktree does not
  inherit that untracked file - so the check had been running structure-only here.
  With the denylist copied in, the private downstream vault's repo name was found
  in four tracked files: two this unit wrote, plus `backlog/015-gate-registry.md`
  and the 015 section of these notes, which are green on `main` and red from 015
  onward. Every occurrence is now the neutral referent "the downstream vault".
  The seven lines changed in the two work-unit files are name substitutions only,
  auditable in one diff; no requirement wording moved. A private project name in a
  public repository is not a defect to walk past to preserve a path boundary.

- **Net production lines are +122, where the plan targeted negative** (+226 / -104
  across 12 files, well inside the 400-line ceiling; tests +317 against 350). The
  duplication removed was numerically small - a threshold literal is one line in
  each place it appears - while the three new chokepoints carry the reasoning that
  makes them safe to trust in their doc comments. One simplification pass was run
  before reporting this: an exported `CANON_CORPUS_FIELDS` array whose only
  consumer was a test asserting its own contents (the self-referential pin card 1's
  review called out) is now a doc comment, and the behavioural exclusion test that
  does the real work stayed.

### Verification

- CLI oracle: 54 invocations (every command's `--help`, `--version`, an unknown
  command, and real runs including failure paths, both migrate paths, a second
  `issue-baseline-receipt` to an existing path, and `smoke`) at merge base and
  HEAD. All 54 identical; the single textual difference is the path of the
  base-build's own bundled example directory.
- Fixture receipt: `verify-pack` over `src/verify/fixtures/legacy-pack` on both
  builds — same 18 findings, same order, same severities, same verdicts, same
  messages. The receipt's `engine`, `bindings.outputs` PDF hashes and
  `receiptSha256` differ, because Chrome stamps a creation date into every PDF
  and the two builds report different revisions; both staged HTML files are
  byte-identical.
- Adversarial check on the union: for the real vault canon and the bundled
  example, every word of the merge-base `canonToText` and of the merge-base
  `canonCorpus` is present in the new projection (0 dropped, both canons), and
  every word of the old fit corpus is present in the new distinct exemption
  text. A "union" that silently dropped a field was the main risk in this unit,
  so it is checked directly rather than inferred from verdicts matching.
- `npm test`: 514 passed, 1 skipped, 54 files. `npm run lint:self` clean.
  `node dist/cli.js smoke` passes (inside the oracle). `production.test.ts`
  untouched.
- Cross-repo field test: `npm pack` installed into a scratch copy of the private
  downstream vault (the live checkout was read from, never written to).
  `bash scripts/battery.sh --text --vault tests/practice-vault` reports
  `TEXT PHASE GREEN (14 gates)`; `python3 tests/test_gates.py` reports 46 tests
  OK. The `ats` warning line that `scripts/ats-decisions.py` greps verbatim is
  unchanged (only that command's `--min` default expression moved).

### Review remediation (dual review, 2026-07-29)

- **Blocker: `cli.ts` still printed a threshold as a literal.** The smoke PASS line
  said `(max 1)` forty-five lines below the call that reads
  `THRESHOLDS.maximumPages` properly, so raising the maximum to 2 would have let
  smoke accept two pages while announcing one — the same class of defect as the
  inert `0.8` this unit already fixed in that function. Now
  `(max ${THRESHOLDS.maximumPages})`. The printed text is unchanged today, because
  the constant is 1; what changed is that it can no longer disagree. No test guards
  the sentence: after the fix there is no second value to drift, and pinning it
  would only assert that string interpolation works.
- **The policy-settable boundary is compiler-enforced.** `POLICY_DEFAULTS` holds the
  eight the schema accepts, `as const satisfies GateThresholds` so literal types
  survive for the callers that render them into flag defaults, and `THRESHOLDS`
  spreads it and adds the command-only extras. The docstring that said "the first
  eight" — an ordering convention nothing checked — is gone, and the test's
  hand-copied list of those eight names (a third copy) is now
  `ThresholdsSchema.safeParse(POLICY_DEFAULTS)`. No value changed.
- **`distinct`'s exemption adjacency is restored.** Exemption matches a CONTIGUOUS
  run, so reordering fields changed which cross-field adjacencies exist: the
  reviewer reproduced four runs whose exemption status moved (three exempt to
  flagged, one flagged to exempt) even though no document in the 348 changed. The
  merge base's `title org location start end` line per job is back, with a comment
  saying why the apparent duplication is load-bearing, and
  `distinct.test.ts` now pins the adjacency so the next author cannot tidy it away.
  Checked on both canons: every rendered entry-header run
  (`senior structural engineer wsp cambridge uk 2022 present` and the example's two)
  is exemptable at the merge base and at HEAD.

  What no single corpus can restore, stated so it is not mistaken for a miss: any
  one ordering breaks some cross-FIELD adjacency the merge base's two differently
  ordered corpora happened to have. For the real canon, 30 four-word runs lose
  exemptability and 23 gain it — org glued to a bullet's opening word
  (`engineer wsp production tooling`), institution glued to a note, phone glued to
  the summary. None of them is reachable: `distinct` scans `<p>`/`<li>` only and
  never merges a run across an element boundary, so no rendered document contains
  an entry header running into a bullet. The empirical check agrees — 348 real
  documents, zero changes, before and after this fix.
- **`canon/corpus.ts` no longer restates its own body.** The six-line prose field
  list sat three lines above the twelve-line function that is the field list, with
  nothing keeping them in step. The exclusion rationale stays: that paragraph is
  load-bearing and `corpus.test.ts` guards it.
- `CONTEXT.md` gained entries for the two chokepoints a newcomer could not
  otherwise find (canon corpus, atomic write), including the permanent exclusion
  decision so it is not re-litigated.
- Left alone deliberately, recorded for the owner: F2 (`untracedNumbers` matching on
  numeric value alone — see above), `verify/pack.ts`'s own tmp-then-rename (a fourth
  instance, outside criterion 3's three), and `corpus.test.ts`'s source-text greps.
