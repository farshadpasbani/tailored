# Trustworthy application engine — implementation PRD

Date: 2026-07-14  
Status: historical implementation design; superseded for execution
Product: `tailored`  
Current implementation baseline for the accessibility redesign: `main` at
`d748222604fa179a328e608237da0ed7c336437f`

> **Execution reset (2026-07-14):** This document is no longer implementation authority. See
> `docs/superpowers/prds/2026-07-14-field-first-reset.md`. Tailored 011 is complete through 011a;
> 011b and 011c are retired; 012 is deferred. No production work is authorised by this PRD.

## 1. Document control and source lineage

This PRD translates the approved design into an implementation contract. It does not replace or
weaken the source specification. If this PRD and the source specification conflict, the source
specification wins and implementation MUST stop until the conflict is resolved by a human.

| Authority | Exact anchor | Role |
|---|---|---|
| Trustworthy application engine specification | `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md` at `a1cd1827f19ff3e30681597b0760ae45218577dc`; SHA-256 `f7abbb27cf9445a5fdd2299c46c48becaed94cabfd52bde1e94c6aa3a069591e` | Product behavior and acceptance authority |
| Trustworthy workflow programme map | the private vault's programme map | Cross-repository order and human-use gate |
| Tailored execution plan | the private vault's umbrella plan | 011/012 scope, budgets and review boundaries |
| Tailored 011 | `backlog/011-report-status-aware-editorial-advisories.md` at commit `833205480bb81648cf5f8195a0b6f2c29aa8419c`; SHA-256 `ad5b43583934f9aa83afc60ee9a7307e803874dee781f1efc14a27102115c9ca` | Remaining editorial/corpus slice |
| Tailored 012 | `backlog/012-ship-the-v2-contract-and-field-fixtures.md` at `119f9461841f9c7ca6b0e31806b8677a82317dfb`; SHA-256 `89dc303123081f7eecedc6c7e0b777b4274f01542eb2ec900ff06f9d48ac6e1a` | Original remaining public-contract slice; current dependency wording is anchored by Plan 02B |

The 011 umbrella is decomposed into reviewed `backlog/011a-connect-status-aware-editorial-authority.md`,
retired `backlog/011b-prove-same-page-accessibility-authority.md`, and replacement
`backlog/011c-prove-sealed-profile-accessibility-authority.md`. Their exact execution anchors are
held by Plans 02A1, retired 02A2, and executable 02A3. The rejected
`codex/011-editorial-advisories` branch at `b113c80` is
forensic evidence only: it MUST NOT be patched, merged or cherry-picked. The alternative
`codex/009-claim-evidence-public` branch is retired evidence. Agents MUST NOT
merge or cherry-pick it into 011 or 012. Any independently desirable idea from that branch requires
a new human-anchored work unit.

`codex/011b-accessibility-authority@d83a0b5b39cc182a09db531d10b7c3c5753948df`
(tree `71e5a886609eca0b13bf397a804fee42bd3bcf1f`) is also retired evidence. It descends from
the current planning baseline and reviewed 011a, but final remediation review still found
classification authority outside its stability ledger. It MUST NOT receive a third remediation,
be merged, cherry-picked, or copied as implementation. Red cases and aggregate field evidence may
inform 011c only when independently re-derived from this PRD.

## 2. Product outcome, users and trust boundaries

### 2.1 Outcome

Tailored SHALL be the deterministic trust boundary for a complete job-application pack. Given
declared, immutable inputs, it SHALL render the CV and cover PDF, prove the facts that deterministic
software can prove, expose the judgements software cannot prove, and issue one hash-bound
`ready-for-human` receipt. It SHALL never convert lexical similarity, ATS vocabulary, an agent
opinion or an editorial heuristic into factual authority.

### 2.2 Users

- A candidate uses Tailored to obtain inspectable evidence and exact review artefacts.
- A drafting agent authors proposed requirements, strategy, HTML and evidence records, but does not
  approve its own factual gaps, waivers, semantic judgements or final artefacts.
- The private vault consumes Tailored's root public package API and receipts as the private workflow layer.
- A human reviewer owns semantic truth, taste, waivers, attestations and downstream publication.
- A package maintainer owns public API compatibility, sanitised fixtures and release documentation.

### 2.3 Trust boundaries

1. Canon facts, archived employer material and explicit human records are authority. HTML, PDF,
   Markdown, CLI prose and receipts are derived projections.
2. Candidate facts and employer sources are separate namespaces. Employer text MUST NOT license a
   candidate achievement or first-person claim.
3. Blocking gates prove schema, referential, privacy and artefact-integrity properties. Advisory
   gates report vocabulary, repetition, design and editorial judgement.
4. A receipt proves internal byte integrity and verifier execution state. A digest alone does not
   prove provenance, human approval, publication or submission.
5. Existing submitted/private artefacts are immutable field evidence. Tailored SHALL read copies or
   sealed read-only sources and SHALL NOT repair private history.

Treat deterministic checks as instruments, not oracles: instrument -> bounded evidence; oracle ->
false certainty.

## 3. Current baseline and mandatory reuse

| Unit | State on local `main` | Reuse contract |
|---|---|---|
| 007 strict canon and prohibited claims | Complete; merged by `4839006` | Frozen foundation. Do not redesign schemas, migration or prohibition matching in 011/012. |
| 008 requirement-evidence fit | Complete; merged by `1b5b4d1` | Frozen foundation. Do not reconnect fit to ATS or replace freeze receipts. |
| 009 rendered claim evidence | Complete; merged by `af321a8` and later hardened | Frozen foundation. Reuse claim/resource/snapshot authority; do not import the retired alternative line. |
| 010 complete-pack verification | Complete at `0e6e1cd` | Frozen transaction foundation. Extend only where 011 requires policy/advisory separation or 012 requires public exposure/documentation. |
| 011a status-aware corpus/editorial authority | Complete; reviewed tip `6c71a00` is on `main` | Frozen reviewed slice. Do not disturb its corpus, strategy or editorial semantics. |
| 011b open-ended CSSOM accessibility authority | Retired at `d83a0b5` after final review | Evidence only. Property replay did not prove stable rule classification; no third patch loop. |
| 011c sealed-profile accessibility authority | Not complete | First dependency-valid Tailored slice; replace the whole accessibility joint from current `main`. |
| 012 public contract and fixtures | Not complete | Implement only after reviewed 011c merges and the 011 umbrella closes. |

The root package export already exposes canon, requirements, evidence, claim-integrity, policy,
corpus, receipt and verify-pack types. `verify-pack` already stages into a hidden sibling, renders
from an immutable snapshot, writes `receipt.json`, verifies exact output hashes and atomically
renames the candidate directory. Agents SHALL connect these mechanisms, not build parallel ones.

Current backlog statuses for 007–010 are stale recordkeeping, not permission to reopen them.

## 4. Scope and non-goals

### 4.1 In scope

- Complete Tailored 011 through reviewed 011a plus replacement 011c: 011a connects status-aware
  corpus, strategy and editorial advisories; 011c proves same-page accessibility floors/targets
  inside a sealed declarative Chrome page and a deliberately narrow stylesheet profile.
- Complete Tailored 012: root exports, compatibility messages, CLI/help/README/skill alignment,
  conflict-copy reconciliation, sanitised fixtures and clean package gates.
- Preserve all behavior already accepted for 007–010.

### 4.2 Non-goals

- No prose generator, LLM call, semantic scorer or automated taste approval.
- No application approval, publication, submission or impersonation of a human reviewer.
- No package publication, version bump, remote push or repository visibility change.
- No private canon, vacancy, contact detail, application artefact or field result in Git.
- No private-vault implementation, private-vault migration or clean public extraction of the private vault.
- No new plugin system, storage abstraction, alternate renderer or compatibility wrapper.
- No refactor of 007–010 unless a failing 011/012 acceptance check proves the smallest necessary
  edit; that edit MUST remain within the applicable slice budget.

## 5. Numbered functional requirements

### Completed requirements that SHALL remain closed

**FR-001 — Strict canon authority (AC1–AC2).** Tailored MUST require strict canon v2 for verified
operation, preserve every real private-canon namespace, reject unknown keys with exact paths, and
keep migration deterministic, idempotent and fail-closed for duplicate/unresolved IDs.

**FR-002 — Prohibitions and structured metrics (AC3–AC4).** Tailored MUST block `claims.cannot`,
protected-topic and known prohibited transformations, and MUST compare value, subject, unit,
denominator, scale and timeframe. The 124-commit/58-run attachment MUST fail.

**FR-003 — Frozen requirements and honest fit (AC5–AC6).** Verified fit MUST derive only from the
frozen requirement-evidence map. ATS terms SHALL remain a separate advisory vocabulary result.
Hard gaps SHALL remain visible, and post-freeze changes MUST carry dated, externally bound receipts.

**FR-004 — Rendered claim integrity (AC7).** Every factual CV/cover clause MUST have one stable
rendered marker and exact evidence record. Unknown, duplicate, stale, hidden, unowned or
namespace-invalid claims MUST block with artefact and location diagnostics.

**FR-005 — Complete-pack transaction (AC8).** `tailored verify-pack` MUST render both exact PDFs,
run every declared gate, issue one receipt and expose no candidate directory on a blocker or
interruption.

**FR-006 — Freshness and idempotence (AC9).** A prior receipt MUST become stale when any bound
descriptor, input, corpus member, waiver, attestation, engine identity, HTML or exact output changes.
Unchanged verification in a new empty destination MUST reproduce content hashes and gate results.

### Remaining 011 requirements

**FR-007 — Status-aware final corpus (AC10).** Distinctness MUST consume only the supplied corpus
manifest. Only exact-hash `approved` and `submitted` document members SHALL enter comparison.
`current`, `draft`, `skipped`, `abandoned`, `superseded` and `withdrawn` members SHALL be excluded
before their artefact bytes are read. An eligible member that is missing, unreadable or hash-stale
MUST block as `corpus-eligibility`; it MUST NOT be silently dropped. “The candidate itself” means
the same resolved artefact path as a current pack artefact, not any separate prior that happens to
have identical bytes. A separately stored approved/submitted byte twin remains eligible and MUST be
reported as a collision. For a pack at `<vault>/<pack>/pack.yaml`, the v1 manifest trust base is the
real, non-symlink `<vault>` directory. The root descriptor, nested descriptors and eligible members
MUST remain beneath that one base, and neither the base nor any traversed path component may be a
symlink. This definition permits declared immutable sibling collections such as `Applied/**`
without permitting an implicit filesystem-wide base.

**FR-008 — Complete strategy record.** New strategy records MUST state opening move, core argument,
anchor fact IDs and selected project IDs. Unknown fact/project IDs MUST produce deterministic
advisory messages. A legacy strategy containing only `selectedProjectIds` and `rationale` MAY be
read, but missing new fields MUST remain visible as `review-required`; the verifier MUST NOT invent
them.

**FR-009 — Editorial advisories.** Density, evidence altitude, skills/project selection,
self-reference, natural-language concerns and lexical/structural repetition MUST be advisory
findings. Messages MUST be deterministic, stable-sorted and scoped to a named gate. A failing
advisory MUST remain `ok: false` even after it is accepted or waived. The v1 strategy/canon shapes
can prove reference existence and fact trust metadata, but they do not encode a structured
project-to-fact relationship or role-relative delivery altitude. The engine therefore MUST NOT
auto-pass semantic evidence altitude from project-name string containment or fact quality alone.
Until a later version supplies that authority, `evidence-altitude` remains failed and
`review-required` (or human-resolved) with deterministic diagnostics; a human attestation owns any
acceptance of semantic altitude.

**FR-010 — Accessibility separation.** Font below 9pt, line height below 1.28 or page margin below
8mm MUST be a blocking `accessibility-floor` failure. Font below 10pt, line height below 1.32 or
page margin below 10mm while still above the floor MUST be an `accessibility-preferred` advisory.
Content selection SHALL be preferred over compression. Effective body font size and line height
MUST come from the same immutable print DOM already inspected and rendered by Chrome; a partial CSS
cascade implemented with regular expressions is not blocking evidence. Page margins MUST be proven
from the complete Chrome CSSOM of the same page. For `ready-for-human`, the supported profile is
intentionally closed: exactly one active inline `<style>` owner and root; exactly one unnamed,
unqualified top-level `CSSPageRule` at index zero; and only top-level `CSSStyleRule` entries after
it. Imports, links, media/supports/layer/container/scope groups, nested style rules, font-face,
keyframes and every other at-rule are unsupported and MUST block rather than be traversed. The page
rule uses the millimetre grammar in Section 6.7. This restriction matches every inventoried current
CV/cover field artefact and removes unneeded dynamic graph classification from the trust boundary.

**FR-011 — Full-corpus field result.** With the complete private current plus `Applied/**` manifest,
the distinct advisory MUST report every non-canonical prose collision and its eligible denominator
without requiring synonym churn for a blocking pass. The 2026-07-14 corrected-detector baseline is
8 submitted packs / 16 eligible CV+cover documents: 0 of 8 cover-to-cover collisions and 3 of 8
covers colliding when compared with all eligible CV+cover documents. These are field evidence, not
production constants. A later change MUST explain fixture/hash or detector changes and MUST NOT
restore the pre-`5e37205` structural-boundary/canon-fact false positives merely to recover six.

### Remaining 012 requirements

**FR-012 — Honest public contract (AC11).** CLI help, README, skill and house style MUST use the
same blocking/advisory vocabulary and MUST state that deterministic checks do not prove taste or
arbitrary semantic truth.

**FR-013 — Compatibility (AC12).** Existing v1 canon/examples/commands MUST either run through an
explicitly labelled compatibility path or fail with a concrete migration instruction. No supported
consumer may receive an opaque Zod/module-resolution error. The private vault SHALL import only `tailored`,
not `tailored/dist/index.js` or another private subpath.

**FR-014 — Clean package gates (AC13).** Canonical conflict copies MUST be reconciled before deletion.
The final tree MUST pass full test, build, self-lint, smoke, package dry-run and personal-data scan.

**FR-015 — Public/private fixtures (AC14).** Sanitised fixtures MUST reproduce audited Vendor-A,
Vendor-B and Vendor-C/Vendor-D failure classes. Separate private field runs MUST exercise the real packs,
record only non-private aggregate evidence and leave source hashes unchanged.

**FR-016 — Consumable root API.** The package root MUST export the exact parsers, policies, findings,
receipts, freshness types, corpus schema and strategy schema used internally. No new public subpath
or duplicate DTO SHALL be introduced.

**FR-017 — Release evidence.** Each slice MUST pass malformed, missing, concurrency and interrupted
write cases relevant to its changes. 011 and 012 SHALL have separate completion reviews and SHALL
not be combined into one change.

## 6. Exact data contracts and ownership

### 6.1 Canon v2 — complete, frozen

`schemaVersion` MUST equal `2`. The strict top-level object SHALL retain `identity`, `summary`,
`skills`, `projects`, `experience`, `education`, `certifications`, `publications`,
`protectedTopics`, `claims`, `verifiedFacts`, `talkingPoints`, `positioning`, `ipBoundaries`,
`discretion`, `draftingGuidance`, `numbersThatStand` and `facts`.

Each fact SHALL contain `id`, `statement`, `kind`, `subject`, `provenance`, `verifiedOn`, `status`,
`confidence`, `allowedUses`, `sensitivity`, optional `metrics` and optional
`prohibitedTransforms`. A metric SHALL bind finite `value`, non-empty `unit` and `subject`, plus
its applicable `denominator`, `scale` and `timeframe`. Evidence contracts use the literal
`not-applicable` rather than empty euphemisms.

The candidate/private vault owns canon content. Tailored owns strict parsing, compatibility
migration and deterministic validation; it SHALL NOT silently add facts.

### 6.2 Requirements v2 — complete, frozen

`requirements.yaml` MUST contain `schemaVersion: 2`, role, optional company, archived JD SHA-256,
`frozenAt`, at least one requirement, baseline canonical digest/external receipt digest, and an
append-only `changes` array. Each requirement SHALL contain:

- stable ID and exact JD quote/location/span;
- frozen/current `hard|preferred` class;
- finite positive weight and `none|uncertain|blocker` eligibility impact;
- archive-sourced ATS literals and explicitly reasoned aliases;
- exactly one evidence form: direct fact IDs, transferable fact IDs plus note, explicit gap, or
  externally receipted waiver.

The drafting agent may propose the map. The archived JD and baseline receipt own freeze authority.
Only a named human may own `approvedBy`; agents MUST NOT mint waivers or backdate changes.

### 6.3 Evidence v2 — complete, frozen

`evidence.yaml` MUST contain `schemaVersion: 2`, one or more artefacts, zero or more employer
sources, and one or more claims. Artefacts SHALL bind ID, declared path, SHA-256, physical resource
root, complete resource manifest and manifest SHA-256. Employer sources SHALL bind exact archive
path/bytes/text and optional complete metrics. Claims SHALL bind stable ID, artefact, exact text,
text/artifact/binding hashes, one namespace, evidence IDs and optional complete metrics.

The only claim authority pairs are `candidate/candidate` and `employer/employer`. HTML MUST expose
matching `data-claim-id`, `data-claim-subject` and `data-claim-authority` values. The authoring tool
owns the proposed record; canon/employer archives own factual authority; Tailored owns deterministic
verification.

### 6.4 Strategy v1 — 011 extension

The canonical strategy record SHALL remain `schemaVersion: 1` for compatibility and SHALL accept:

```yaml
schemaVersion: 1
selectedProjectIds: [project-id]
rationale: "Why these projects serve this role"
openingMove: "The intended opening move"
argument: "The application’s central argument"
anchorFactIds: [fact-id]
```

New packs MUST provide all fields. `selectedProjectIds` and `anchorFactIds` MUST be non-empty and
unique. IDs MUST resolve to the current canon. Legacy v1 records lacking the three new fields MAY
verify, but SHALL emit failed `strategy-selection`/`evidence-altitude` advisories with
`review-required`; absence MUST NOT be converted into invented content.

The drafting agent owns the proposal. A human attestation owns acceptance of its semantic quality.

### 6.5 Corpus manifest v1 — 011 extension

The supplied strict manifest SHALL remain `schemaVersion: 1`. Every member SHALL have stable `id`,
path, lowercase SHA-256, lifecycle status and `document|corpus` kind. Status SHALL be one of:

`current`, `draft`, `approved`, `submitted`, `skipped`, `abandoned`, `superseded`, `withdrawn`.

Selection SHALL occur in this order:

1. Parse the complete descriptor and reject duplicate/case-colliding IDs or paths.
2. Exclude non-final statuses without reading their referenced document bytes.
3. Establish the one v1 pack-vault trust base defined by FR-007, prove the base itself is real and
   non-symlink, then resolve approved/submitted paths beneath it; reject physical escape or any
   symlink component. Exclude only a member whose resolved path is a current artefact path.
4. Read each eligible member once from an immutable snapshot and require the declared hash.
5. Traverse nested corpus descriptors with cycle detection.
6. Pass only eligible document bytes to distinctness.

The caller owns lifecycle classification. Tailored owns eligibility enforcement. The receipt MUST
hash the manifest and every included approved/submitted prior; excluded private artefacts MUST NOT
be copied into candidate output.

### 6.6 Pack descriptor, findings and receipt — complete, extend only as stated

The strict pack descriptor SHALL remain `schemaVersion: 1` and declare canon, JD, requirements,
baseline receipt, evidence, strategy, research, preferences, policy, at least CV and cover
artefacts, corpus descriptor, waivers and attestations.

A finding SHALL remain:

```text
id, severity(blocking|advisory), ok, messages[],
optional disposition(review-required|accepted|waived),
optional resolution(attestationId xor waiverId)
```

Failed advisories MUST have a disposition. `accepted` requires exactly one human attestation;
`waived` requires exactly one human waiver; `review-required` carries no false resolution.
Resolution hashes SHALL bind the exact pack, policy and finding-content generation.

The JSON receipt SHALL remain `schemaVersion: 1`, `kind: tailored.verify-pack`,
`state: ready-for-human`. It MUST bind descriptor, pack generation, all named inputs, source HTML,
exact HTML/PDF outputs, corpus descriptor/included members, waivers, attestations, engine version
and revision, every finding, and its own canonical payload digest. It MUST contain hashes and IDs,
not private source contents.

### 6.7 Sealed print page and closed stylesheet profile — 011c accessibility authority

Chrome's print page is the sole authority for computed body values and page margins. The verifier
SHALL inspect the CSSOM of the exact loaded page sent to `Page.printToPDF`; it SHALL NOT scan CSS
source, parse CSS independently, render a second page, reconstruct a cascade, or model an
open-ended CSSOM object graph.

#### Observation boundary

The renderer SHALL accept only the existing parser-produced declarative HTML contract. It MUST
reject authored scripts, event handlers, executable URLs/elements and active meta behavior before
Chrome starts. It SHALL load only the verified immutable local resource snapshot with the existing
restrictive CSP. The trusted inspection script is therefore the only page script.

After print media, load and `document.fonts.ready`, that trusted script SHALL make one synchronous,
run-to-completion observation of the DOM, computed body values and the closed CSSOM profile. No
property-value replay or JavaScript-object ledger is authority. On successful observation, the
controller SHALL disable page script execution before `Page.printToPDF`; it SHALL not navigate,
reload or mutate the page in between. CSS keyframes and every nested/conditional rule are rejected,
so no supported CSS mechanism remains that can change the decision-bearing values between the
observation and print.

Chrome naturally supplies browser-created `StyleSheetList`, `CSSStyleSheet`, `CSSRuleList`,
`CSSStyleRule`, `CSSPageRule`, `CSSStyleDeclaration` and `CSSStyleProperties` objects. Authored
JavaScript can replace prototypes, constructors, getters, constants and object identity, but such
JavaScript is outside the accepted declarative input boundary and MUST be rejected before it can
run. The inspector SHALL neither defend a hostile JavaScript object graph nor mistake it for
browser authority. Direct renderer calls MUST pass the same declarative preflight; a caller cannot
bypass the boundary used by `verify-pack`.

#### Exact supported profile

Every successful artefact MUST satisfy all of these conditions:

1. `querySelectorAll('style, link[rel~="stylesheet"]')` yields exactly one owner, it is an inline
   `<style>` element, and it has no non-empty `media` qualification and is not disabled.
2. `document.styleSheets` is a genuine list with finite safe-integer length `1`, callable `item`,
   and matching index/item entries. That exact sheet is `owner.sheet`; its `ownerNode` is that owner,
   it is enabled, and its browser media text is empty.
3. `CSSRule.STYLE_RULE` and `CSSRule.PAGE_RULE` are finite distinct safe integers. Rule
   classification uses only one synchronous read of the Chrome-native rule's numeric `type`. It
   MUST NOT read or compare constructors, prototypes, brands, `instanceof`, class names or
   `Symbol.toStringTag`.
4. The root `cssRules` is a genuine completely enumerable rule list. Index and `item(index)` must
   return the same non-null object for every position. Throw, null, undefined, hole, early null,
   malformed length/item or mismatch blocks.
5. Rule index zero is the sole `CSSPageRule`; every later rule is a `CSSStyleRule`. Any import,
   link-owned root, media/supports/layer/container/scope group, nested rule, font-face, keyframes,
   counter-style, property rule, namespace/charset residue, page-margin child, unknown/future type
   or second page rule blocks. There is no inactive-branch exception because conditional rules are
   outside the supported profile.
6. A style or page rule may expose a browser `cssRules` capability only when that list is completely
   enumerable and empty. A non-empty, unreadable or malformed nested list blocks regardless of the
   outer numeric type. This closes CSS nesting and hidden/emergent child capability without
   classifying the child graph.
7. The page rule exposes a string `selectorText` empty after trimming and a non-null style
   declaration. The style declaration has a finite safe-integer length, callable `item` and
   `getPropertyValue`, unique non-empty string property names, matching index/item values and string
   property values for every declared property. Any throw, null, undefined, hole, duplicate,
   changing length during the synchronous loop or malformed value blocks.

The profile is a product input contract, not an incomplete graph walk. Local imported stylesheets
remain valid resource-manifest inputs for other non-authoritative commands, but any import or link
in a `ready-for-human` artefact blocks `accessibility-floor`. Current field inventory on 2026-07-14
found 159 CV/cover artefacts: all 159 have one inline style and one `@page`; none has a stylesheet
link or import/media/supports/layer/container/scope/keyframes/font-face at-rule. Supporting those
constructs would add machinery without carrying a current product load.

#### Computed values and page declaration

The same synchronous observation SHALL read `document.body`, `getComputedStyle(body).fontSize` and
`.lineHeight`. Each must be a finite positive pixel value. Font converts by `72/96`; line height is
the line-height pixel value divided by that same font pixel value. Missing body/API/style,
non-string, non-pixel, non-finite or non-positive values block; `normal` is not guessed.

The sole page rule's `CSSStyleDeclaration` SHALL use exactly one of these margin forms:

- one declared `margin` shorthand, no margin longhands, containing one to four finite non-negative
  `mm` values; or
- all four declared `margin-top`, `margin-right`, `margin-bottom` and `margin-left` longhands, no
  shorthand, each containing one finite non-negative `mm` value.

Missing sides, mixed shorthand/longhand, CSS-wide keywords, functions, negative values and
non-`mm` units block. The normal one-to-four-value expansion is the only reduction Tailored
performs after Chrome has selected the declaration object; Chrome's parsed declaration object, not
discarded source-level duplicates, is the authority.

## 7. `verify-pack` workflow and transaction semantics

1. Resolve the descriptor and declared paths without changing the caller's working directory.
2. Parse strict schemas and capture one immutable byte snapshot of every required input.
3. Validate requirements, evidence, policy, eligible corpus and human resolution bindings.
4. Create one hidden sibling staging directory. The requested candidate directory MUST not exist.
5. For each declared artefact, copy the snapshotted HTML and complete verified local resource
   closure, enforce the declarative boundary and closed stylesheet profile, capture computed body
   values and the page declaration, disable page scripts, render that same immutable Chrome print
   page, extract PDF text, enforce page/accessibility floors, and record exact hashes.
6. Run the complete blocking and advisory registry exactly once; reject missing, duplicate or
   wrong-severity gates.
7. Rehash descriptor and all bound sources before exposure. Any delta MUST abort.
8. Write `receipt.json` with exclusive creation, verify every staged output hash, then perform one
   atomic rename to the new candidate directory.
9. On any error, recursively remove only the owned hidden staging directory and leave the requested
   candidate path absent. Existing destinations and source inputs MUST remain untouched.

Success MUST exit `0` and print:

`PASS: complete pack staged ready-for-human at <output>; receipt <sha256>`

A blocking, schema, dependency, Chrome, Poppler, collision, mutation or interruption failure MUST
exit non-zero, write a concise named error to stderr, and expose no partial candidate. Advisory
failure alone SHALL NOT change the exit code if it is validly recorded with an explicit disposition.

`verify-pack-fresh` MUST exit `0` only when receipt integrity, engine identity, every current input
and every exact output match. Success SHALL retain the existing `FRESH:` message. Staleness MUST
exit non-zero with `stale verify-pack receipt: <stable comma-separated keys>`.

## 8. Blocking versus advisory policy

The 011 policy contract SHALL retain `schemaVersion: 1` and extend its strict required shape. The
policy already declares every gate and severity explicitly, so the new gate IDs and preferred
threshold fields make the correction visible without creating a second versioned policy format.

Blocking gate IDs SHALL be: `canon-schema`, `evidence-schema`, `requirements-trust`,
`fit-blockers`, `protected-topics`, `prohibited-claims`, `claim-integrity`, `pdf-text-layer`,
`page-integrity`, `corpus-eligibility`, `accessibility-floor`.

Advisory gate IDs SHALL be: `ats`, `ai-tell`, `impact`, `distinctness`, `strategy-selection`,
`evidence-altitude`, `editorial`, `accessibility-preferred`.

Policy v1 SHALL require every gate exactly once at its prescribed severity. Thresholds SHALL retain
fit, ATS and distinctness settings and SHALL name:

- blocking: `minimumFontPt: 9`, `minimumLineHeight: 1.28`, `minimumMarginMm: 8`;
- preferred: `preferredFontPt: 10`, `preferredLineHeight: 1.32`,
  `preferredMarginMm: 10`.

A legacy policy-v1 shape that omits the new required gates or preferred thresholds MUST fail with a
direct policy-update instruction and MUST NOT issue a ready-for-human receipt. Existing policy
examples SHALL be updated in 012. Editorial and distinct findings SHALL never block factual
readiness.

## 9. Public API, CLI and package compatibility

- Package identity SHALL remain ESM `tailored@0.1.0` during 011/012; no version bump is authorised.
- `exports["."]` SHALL remain the supported runtime/type entry. `./package.json` may remain exposed.
  No internal `dist` subpath SHALL be public.
- Existing root exports for canon, requirements, evidence, claim integrity, verify-pack, receipt,
  policy, corpus, waivers and attestations MUST remain compatible.
- 011 SHALL add the internally used `StrategySchema` and `Strategy` type to the root export. It
  SHALL extend the existing corpus/policy exports rather than create parallel public DTOs.
- `verifyPack`, `verifyReceiptFreshness` and opaque verifier-issued receipt behavior MUST remain.
- Existing commands (`validate`, `migrate-canon`, requirement migration/freeze/fit/ATS,
  `claim-integrity`, `ip-guard`, `impact`, `distinct`, `render`, `verify-pack`,
  `verify-pack-fresh`) SHALL remain discoverable and truthfully described.
- Legacy `jd.yaml` may support legacy vocabulary/fit commands but MUST NOT produce a verified v2
  fit verdict.
- `npm pack --dry-run` MUST contain built root API, skill, sanitised examples, claim-integrity docs,
  replay script, README and licence, and MUST contain no private field artefact.

## 10. Concurrency, idempotency, staleness, privacy and errors

- Two concurrent verifies targeting the same output MUST serialize at filesystem exposure: at most
  one atomic rename succeeds; the loser exits non-zero and removes only its staging directory.
- A pre-existing output directory is never overwritten, merged or repaired.
- Interrupted writes, process death, missing tools and renderer timeouts MUST leave no visible
  candidate and no modified input.
- Re-running against an empty destination with unchanged bytes MUST yield identical bound hashes and
  findings. Wall-clock time SHALL NOT enter deterministic gate content.
- All source files SHALL be read from immutable snapshots. A mid-run replacement MUST abort before
  exposure.
- Paths MUST be contained, real and non-symlink at trust boundaries. Filenames with spaces and packs
  outside the working directory MUST work when explicitly declared.
- Private replay MUST copy consumed data to a temporary location, record a before manifest, run,
  remanifest the source and fail on any mutation. Logs MUST contain aggregate counts/digests only.
- Errors MUST name the failed contract and relevant stable ID/path while avoiding source prose,
  personal data and stack traces in normal CLI output.
- Empty, malformed, unknown-key, duplicate-ID, case-collision, stale-hash and unsupported-version
  cases MUST fail visibly; no empty result may be reported as a pass.

## 11. Sanitised and private field fixtures

### Public sanitised fixtures

012 MUST include minimal fictional fixtures for these failure classes:

1. Vendor-C/Vendor-D-style equal numbers attached to different subjects/units/timeframes.
2. Vendor-A-style literal LLM/drift wording with ATS vocabulary but no candidate fact authority.
3. Vendor-B-style dense layout that crosses preferred targets and a separate fixture that crosses
   absolute accessibility floors.
4. Candidate claim licensed only by employer text.
5. Corpus entries representing current/skipped/abandoned/superseded plus an approved stale hash.
6. Strategy missing opening/argument/anchor facts and strategy referencing unknown IDs.
7. Advisory finding with no, accepted and waived dispositions bound to exact finding digests.

Fixtures MUST use invented identities, employers, URLs and hashes and MUST contain no transformation
of private prose.

### Private field fixtures

Real Vendor-A and Vendor-B packs and the complete current plus `Applied/**` corpus SHALL run from
the private vault or temporary copies. The field gate SHALL record before/after hashes,
attempt counts, gate counts, aggregate issue kinds and receipt digests outside the public repository.
It MUST demonstrate actionable v2 failures before repair and verified receipts after authorised
repair. It MUST also record the corrected-detector denominator and collision baseline from FR-011. No repair,
approval or submission is authorised by the field run.

## 12. Deterministic acceptance matrix

| PRD requirement | Source | Required evidence/check |
|---|---|---|
| FR-001 | AC1 | Real private canon validates; one-character unknown key fails at exact path |
| FR-001 | AC2 | Migration run twice is byte-identical; duplicate/unresolved IDs fail |
| FR-002 | AC3 | Sanitised OpenAI API, AWS, ANSYS, chartership, database and internal-IP claims block |
| FR-002 | AC4 | 124/58 subject mismatch blocks although both numbers exist |
| FR-003 | AC5 | Vendor-A literal wording changes ATS only; unsupported LLM/drift fit remains gap |
| FR-003 | AC6 | Post-freeze reclassification without dated prior receipt fails; bound change passes |
| FR-004 | AC7 | CV/cover source, rendered and PDF claim coverage plus namespace/hash cases pass/fail exactly |
| FR-005 | AC8 | Complete pack writes CV/cover HTML/PDF and one receipt; injected blocker leaves no output |
| FR-006 | AC9 | Unchanged rerun preserves hashes/findings; mutate each binding class and observe stale key |
| FR-007, FR-011 | AC10 | Supplied full corpus includes only exact approved/submitted finals and records the corrected non-canonical collision denominator/result without structural/canon false positives |
| FR-012 | AC11 | CLI help, README, skill and house style terminology snapshot agrees with gate registry |
| FR-013 | AC12 | v1 examples take labelled compatibility/migration path; root-import compile test passes |
| FR-014, FR-017 | AC13 | Full suite includes malformed, missing, concurrent and interrupted cases; build/lint/smoke/pack pass |
| FR-015 | AC14 | Sanitised failures reproduce publicly; private Vendor-A/Vendor-B runs show before/after evidence without source mutation |
| FR-008 | Chosen approach 6 / 011 | Complete strategy passes; each missing/unknown field yields stable advisory message |
| FR-009 | Chosen approach 5 / 011 | Advisory remains `ok:false` under review-required/accepted/waived dispositions |
| FR-010 | Spec accessibility assumption / 011 | Exact boundary tests at 8/9/10mm, 9/10pt and 1.28/1.32 distinguish block from advisory; real Chrome proves the sealed declarative boundary, one-root/top-level profile, unknown/nested rejection, exact page grammar and same-page script lock before print |
| FR-016 | Data/command surface | Public API compile test imports every documented root symbol; no deep import exists |

## 13. “Does not count” enforcement

| Source exclusion | PRD enforcement |
|---|---|
| Renaming `trace` while retaining disconnected number matching | FR-002/FR-004 require structured source identity and rendered claim bindings; 124/58 stays red |
| Receipt omits JD, canon, preferences, evidence, corpus or PDF hashes | FR-005/receipt contract and freshness mutation matrix require every class |
| Only invented green fixtures while real audited packs still fail differently | FR-011/FR-015 require separate real Vendor-A/Vendor-B/full-corpus field evidence |
| ATS, distinctness or model review permits fabrication | Trust boundary and FR-003/FR-009 keep them advisory and non-authoritative |
| Rewriting old applications until gates pass is called migration | Private fixture rules require immutable originals and before/after source hashes |

Additionally for 011/012: recursively globbing uncontrolled priors, including skipped drafts,
relabeling lexical thresholds as warnings without a manifest/strategy, compressing to the 9pt floor,
publishing APIs while the skill teaches the old workflow, deleting conflict copies without content
reconciliation, or passing only public fixtures SHALL fail review.

## 14. Release slices

### Slice A1 — Tailored 011a: status-aware corpus and editorial authority

Dependency: authoritative local main containing 007–010 at or after `119f946`.

Necessity decision: connect the existing corpus descriptor, distinct/impact gates, strategy input,
finding disposition and receipt transaction. Preserve the current accessibility policy, rendering
and finding byte-for-byte. This makes the editorial subset live without letting an unfinished
browser redesign masquerade as complete 011.

Allowed production paths: `src/verify/trust.ts`, `src/strategy/schema.ts`,
`src/gates/editorial.ts`, and `src/verify/pack.ts`. `src/gates/distinct.ts`,
`src/gates/impact.ts`, `src/policy/verify.ts`, `src/render/chrome.ts`,
`src/gates/claimIntegrity.ts`, `src/verify/receipt.ts`, and `src/cli.ts` are read-only.

Budget: at most 4 production files / 300 added lines; 4 test files / 360 added lines; 2
docs/status files / 120 added lines. Required gates are targeted corpus/strategy/editorial/pack,
unchanged accessibility and transaction regressions, full test/build/dry-pack/privacy, complete
private corpus, and generic-label field evidence. The reviewed implementation is complete on main.

### Retired Slice A2 — Tailored 011b: open-ended CSSOM accessibility authority

Disposition: `codex/011b-accessibility-authority@d83a0b5` is not mergeable. Its first review found
unstable import/style/group/owner reads; its remediation added a property ledger, but final review
showed that `CSSFontFaceRule`/`CSSKeyframesRule` could hide nested rules and that `instanceof`
classification could change while every recorded property remained stable. This unit exhausted its
remediation allowance and is forensic evidence only.

### Slice A3 — Tailored 011c: sealed-profile accessibility authority

Dependency: current main at `d748222` or a reviewed descendant containing Slice A1 `6c71a00`.

Necessity decision: reuse the existing declarative HTML parser/CSP/resource snapshot as the
executable-code boundary; restrict the accepted stylesheet surface to the one-root profile carried
by every current field pack; then connect the existing Chrome page, claim-integrity result, pure
threshold evaluator, policy registry and verify-pack aggregation. Delete open-ended traversal and
classification from the design. No import/group walker, property ledger, source scan, CSS parser,
second page, alternate renderer or CSS framework.

Allowed production paths: `src/render/chrome.ts`, `src/gates/claimIntegrity.ts`,
`src/gates/editorial.ts`, `src/policy/verify.ts`, and `src/verify/pack.ts`. Allowed tests are
`src/render/chrome.test.ts`, `src/gates/editorial.test.ts`,
`src/gates/claimIntegrity.cli.test.ts`, `src/policy/verify.test.ts` if newly necessary,
`src/verify/pack.test.ts`, and `src/verify/production.test.ts`.

Budget: at most 5 production files / 300 added lines; 6 test files / 450 added lines; 2
docs/status files / 120 added lines. Required gates include the sealed-input/closed-profile matrix
in real Chrome, all six failed-branch families rejected at the correct boundary, exact thresholds,
complete-pack no-output failures, full test/build/dry-pack/no-personal-data, and generic-label
read-only replay. Completion requires dual final review.

### Slice B — Tailored 012: public v2 contract and fixtures

Dependency: reviewed Slice A1 and replacement Slice A3 merged, with the 011 umbrella recorded done.

Necessity decision: prefer export wiring, documentation reconciliation and deletion. Add runtime
code only for a missing public export or a precise compatibility/migration message.

Allowed paths: `src/index.ts`, `src/cli.ts`, `skill/SKILL.md`,
`skill/references/house-style.md`, `skill/references/exemplars.md`, `README.md`, `examples/`,
`package.json`, exact public API/fixture tests, and conflict-copy files after comparison.

Budget: at most 3 production files / 120 added lines; 6 fixture/test files / 500 added lines; 6
docs/skill files / 500 added lines. Deletion is preferred. No package publication/version bump,
private fixture commit or private-vault implementation.

Required gates: public API compile; CLI help snapshots; v1 compatibility; full test/build;
`lint:self`; smoke; `npm pack --dry-run`; no-personal-data scan; sanitised fixtures; private
Vendor-A/Vendor-B replay. Completion requires dual review before any separate human release action.

## 15. Resolved implementation decisions and defaults

1. 007–010 are complete foundations; 011/012 agents SHALL not reopen their architecture.
2. Retire the alternative public 009 branch, rejected 011 branch and failed 011b branch; current
   main is the only implementation base.
3. Use the supplied manifest; never discover distinct priors with a shell glob.
4. Include only exact approved/submitted prior documents. Explicit non-final statuses are skipped
   without reading; stale eligible finals block.
5. Extend strategy v1 compatibly with optional-at-parse/required-for-clean-advisory fields; do not
   create a second strategy format or infer missing judgement.
6. Retain policy schema v1 and make the correction explicit through required gate IDs, severities,
   and preferred-threshold fields. Legacy v1 shapes fail with an actionable update message; do not
   create a second policy-version migration for one internal contract extension.
7. Keep receipt schema v1: policy/engine/input hashes already make old receipts stale, and findings
   already represent the new gate IDs.
8. Keep exact hard floors at 9pt/1.28/8mm and preferred targets at 10pt/1.32/10mm.
9. An unresolved advisory uses `review-required`; acceptance/waiver does not turn `ok` true.
10. Keep one hidden-stage/one-rename verify transaction and the root package export. No adapter.
11. Public fixtures are structural reproductions, never redacted private prose.
12. Accessibility classification uses only Chrome-native numeric `CSSRule.type` inside the sealed
    synchronous observation; constructor/prototype/brand/`instanceof` state is never authority.
13. The accepted stylesheet profile is exactly one inline root, first unnamed page rule, then only
    top-level style rules. Unsupported flexibility blocks; it is not silently ignored.
14. Local `main` is authoritative for implementation; its lead over `origin/main` is a
    shipping concern for 012/human release, not permission to push during implementation.

## 16. Human-only boundaries

- Only a human may approve a semantic claim, taste judgement, advisory acceptance or waiver.
- Only a human may approve/publicise a package release, remote push or visibility change.
- Tailored may issue `ready-for-human`; it MUST NOT issue `approved`, `published` or `submitted`.
- Agents may create sanitised fixtures and temporary private copies, but MUST NOT rewrite submitted
  history, repair real packs without a separate instruction, or retain private field bytes.
- The later public-ready extraction of the private vault remains deferred until private-vault unit 018 is complete and a
  non-builder human has used the private workflow and supplied feedback.

## 17. Readiness checklist

### Completed 011a evidence

- [x] Reviewed tip `6c71a00` is an ancestor of current main.
- [x] Status-aware manifest, strategy and editorial behavior matches FR-007–FR-009.
- [x] Private corpus evidence is generic, read-only and source-stable.
- [x] Accessibility was unchanged and FR-010 was not claimed.

### 011c completion

- [ ] Renderer entry rejects every non-declarative input before Chrome; only the verified snapshot
  and trusted inspector can execute.
- [ ] Real Chrome accepts the exact one-root/top-level profile and blocks every unsupported owner,
  rule type, nested capability, malformed list/declaration and unknown future type in Section 6.7.
- [ ] All six failed-011b families are rejected at either the declarative boundary or closed-profile
  boundary; no prototype/constructor/`instanceof`/brand ledger exists.
- [ ] Floor/preferred boundary tests match FR-010.
- [ ] Real Chrome and exact PDF evidence come from one immutable print page.
- [ ] Page scripts are disabled after the synchronous observation and before print.
- [ ] No private target name or source detail enters an implementation record; the deterministic
  no-personal-data gate runs before the full-suite claim.
- [ ] Full final-tree gates and dual review are compliant; the 011 umbrella is `done` only after merge.

### Before starting 012

- [ ] 011a and 011c are merged and the 011 umbrella is recorded done.
- [ ] Public export inventory is compared with actual internal schemas.
- [ ] Every tracked conflict copy has a content comparison and keep/delete decision.
- [ ] Sanitised fixtures reproduce named failure classes without private bytes.
- [ ] README, CLI, skill and house style use one assurance vocabulary.

### 012 completion

- [ ] Root API compile and no-deep-import searches pass.
- [ ] v1 compatibility/migration failures are explicit, never opaque.
- [ ] Test, build, self-lint, smoke, package dry-run and privacy scans pass.
- [ ] Public fixtures and separate private replays pass their declared expectations.
- [ ] No private data, generated build output or `.DS_Store` is staged.
- [ ] No package publication, push or version bump occurred.
- [ ] Dual review is compliant and the result is ready for the human release decision.
