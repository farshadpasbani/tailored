# Plan 02A2 — Prove same-page accessibility authority

Date: 2026-07-14
Status: retired after failed final remediation review; evidence only
Work unit: Tailored `011b`
Branch: `codex/011b-accessibility-authority@d83a0b5b39cc182a09db531d10b7c3c5753948df`

> **Do not execute this plan.** The branch exhausted its remediation allowance. Final review found
> hidden nested capability in nominal leaf rules and mutable `instanceof` classification outside
> its property ledger. No patch, merge, cherry-pick or implementation copy is allowed. Replacement
> authority is Plan 02A3 / work unit 011c.

## Immutable authority

| Source | Anchor |
|---|---|
| Original trustworthy-engine specification | `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md` at `a1cd1827f19ff3e30681597b0760ae45218577dc`; SHA-256 `f7abbb27cf9445a5fdd2299c46c48becaed94cabfd52bde1e94c6aa3a069591e` |
| Implementation PRD | `docs/superpowers/prds/2026-07-14-trustworthy-application-engine-prd.md` at `033d3f3c1862027e93d2c623593e520a07d83eb1`; SHA-256 `076cc40f57fcaaa1fa9c75aee1d789fb4420cd372c58ddc881a1a4473a463940` |
| Original 011 umbrella | `backlog/011-report-status-aware-editorial-advisories.md` at `f4a57352bc27d854db80cd1af36e5e008f720dde`; SHA-256 `c388ff8b3c8c633919439eb679caee772cd7dffbc4cc87d08021a1bb82dd765a` |
| Executable unit | `backlog/011b-prove-same-page-accessibility-authority.md` at `f4a57352bc27d854db80cd1af36e5e008f720dde`; SHA-256 `0931eb127479d26d83247b35c88a8d3c38839762b7094db7af3cb34bc3b90608` |
| Rejected evidence | `codex/011-editorial-advisories@b113c80d12ef2f00750705338b3f05de78a8c587`; ideas/tests only, never patch/cherry-pick/merge |
| Execution dependency | Reviewed 011a merge `6c71a00ec74ae4e61c1d77db9525ffb6865b9679`, merged unchanged to `main`; final Plan 02A1 SHA-256 `c7b9828c5a6fe61750810b4b3c82940032339975d6fcd84a2a03916e83c1924c` |

## Outcome and necessity gate

Replace the complete accessibility authority joint so the same immutable Chrome print page proves
effective body font/line-height, completely enumerates active page-margin authority, and emits the
PDF. Connect that evidence to one pure floor/preferred evaluator and the existing verifier receipt.

Reuse the existing Chrome/CDP page, verified local resource snapshot, claim-integrity inspection,
policy registry, finding disposition, receipt v1 and atomic transaction. Do not scan CSS source,
parse conditions, emulate cascade, open a second page or build a generic stylesheet framework.

This is one cohesive slice because partial accessibility cannot safely issue `ready-for-human`:
font without margin is not a floor, and a graph walker not connected to the rendered PDF is not
authority.

## Runtime contract

### One-page sequence

1. Load the already verified immutable local snapshot with print media active.
2. Await the current document/font readiness boundary.
3. Without DOM/style mutation, capture computed body font size and line height, run the capability
   preflight and complete graph walk, and capture existing rendered-claim evidence.
4. Refuse partial accessibility evidence on any capability/graph/declaration issue.
5. Send that exact page to `Page.printToPDF`; do not navigate, reload or open another target.
6. Bind the evidence and exact PDF through the existing claim-integrity/verify-pack transaction.

Computed font must be a finite positive pixel value converted by 72/96. Computed line height must
be a finite positive pixel value divided by the same computed font size. Missing, non-string,
non-pixel, non-finite or non-positive values block capability; no guessed `normal` multiplier.

### Complete CSSOM capability preflight

The production traversal returns either complete evidence or blocking issues. Every read is guarded;
throw, null, undefined, malformed shape or inconsistent repeated read blocks if it can hide a rule
or qualification.

| Surface | Required capability | Blocking absence/ambiguity |
|---|---|---|
| Root list | `document.styleSheets` has finite integer length and consistent item/index enumeration | throw, holes, early null, non-sheet, changed length/object during walk |
| Owner closure | Every enabled print-applicable declarative `style`/stylesheet `link` maps by identity to one root; `sheet.ownerNode` agrees | missing sheet, owner mismatch, duplicate owner/root, active unowned root, omitted active owner |
| Rule types | Finite numeric `CSSRule.IMPORT_RULE`, `MEDIA_RULE`, `SUPPORTS_RULE`, `PAGE_RULE`; every rule has finite numeric `type` | missing/non-numeric constants/type, unknown page/import identity |
| Rule lists | Every active sheet/group `cssRules` is non-null with finite integer `length`, callable `item`, and agreeing index/item entries | getter throw/null/undefined, non-rule-list, holes, inconsistent entries |
| Root media | Browser media value is readable and evaluated only by `matchMedia` | missing/non-string media text, missing/non-callable API |
| Media group | Non-empty string `conditionText`; evaluate only by `matchMedia` | absent/non-string/empty condition or API result not boolean-shaped |
| Supports group | Non-empty string `conditionText`; evaluate only by `CSS.supports` | absent/non-string/empty condition or API result not boolean |
| Import edge | Readable `media.mediaText`, exposed `supportsText` equal to `null`, empty string or a non-empty condition string, and `styleSheet` capability | missing/undefined/other non-string supports capability; active null/non-object child; getter throw |
| Other groups | Only a documented browser-known unconditional grouping kind may recurse | any unknown group, condition-bearing group without permitted evaluator, or unknown nested-rule capability |
| Page rule | String `selectorText`, non-null `style` | missing/non-string selector, missing/malformed style |
| Style declaration | Finite integer `length`, callable `item`/`getPropertyValue`, complete unique string property iteration with stable string values | holes, duplicates, missing methods, non-string names/values, changing reads |
| Identity/cycles | Object identity tracked in `active` stack and `complete` set | active back-edge/truncated cycle blocks; completed exact repeat deduplicates; distinct objects never URL/byte deduplicate |

An inactive root/group/import is skipped only after its applicability has been completely proven by
the browser API. It is not required to expose a child rule list. An active node must expose every
capability above. A sheet getter returning `undefined` cannot quietly become “no rules”; that exact
false-green ended the rejected branch.

Known grouping support must be an explicit minimal allowlist. Media and supports are conditional.
An unconditional layer/block group may be traversed only when Chrome identifies it unambiguously
and exposes a complete rule list. Container, scope, starting-style or future/unknown condition-
bearing groups block unless their applicability can be established through the two permitted
browser APIs; no hand-written evaluator is authorised.

### Page-rule/declaration authority

- Collect every active `CSSPageRule`; exactly one must exist.
- `selectorText.trim()` must be empty. Named pages and pseudo-page selectors block.
- Accept either one `margin` property and zero margin longhands, with one to four finite
  non-negative `mm` tokens, or all four margin longhands and no shorthand, each one finite
  non-negative `mm` token.
- Reject missing sides, mixed form, duplicates after CSSOM enumeration, CSS-wide keyword, function,
  negative, non-mm, empty or non-finite value.
- Expand the accepted shorthand deterministically only after Chrome has selected the declaration.
  Discarded source declarations are irrelevant and must not be scanned.

### Threshold/result contract

`accessibility-floor` is blocking: font <9pt, line-height <1.28, any margin <8mm, or any missing/
ambiguous capability. `accessibility-preferred` is advisory: font <10pt, line-height <1.32 or any
margin <10mm while floor evidence is complete. Capability errors appear in the floor and cannot be
human-waived into publication. Preferred failures remain `ok:false` under exact human disposition.

## Traceability and ordered steps

| Original requirement | Plan step | Expected implementation evidence |
|---|---|---|
| Spec blocking/advisory distinction; PRD FR-010 | 1. Add red pure threshold tests at every exact boundary, then add/extend the smallest evaluator in `src/gates/editorial.ts`. | 8/9/10mm, 9/10pt, 1.28/1.32 below/exact cases classify exactly; missing capability blocks. |
| Spec same rendered artefact; PRD 6.7/7 | 2. Define one accessibility evidence result on existing Chrome inspection and thread it through claim integrity without another render. | Test proves one Chrome target/page, one readiness capture and one PDF; effective body values are finite or block. |
| Spec artefact/page integrity; PRD FR-010/6.7 | 3. Implement the guarded root/owner/rule/style capability preflight and active graph walk as one production operation. | Every table row has a named failing issue; no partial margins returned; the null/undefined `cssRules` false-green is red then green. |
| Spec accessibility assumptions; PRD 6.7 | 4. Collect exactly one qualified page rule and reduce only the supported CSSStyleDeclaration grammar. | Imported-only and nested-active pass; active conflicts, qualification and grammar adversaries block. |
| Spec AC8/9; PRD FR-005/006/008 | 5. Extend existing policy v1 with exact floor/preferred gates and literal thresholds, aggregate evidence in verify-pack, and preserve receipt v1/transaction/freshness. | Incomplete policy gives direct update instruction/no output; complete policy emits both findings; blocker leaves no receipt; fresh rerun stable. |
| Spec AC13; PRD FR-017 | 6. Remove the shared-temp test race only in its test harness: give the child process an owned temp root and assert that root is empty after failure. | No global temp enumeration; parallel/full suite deterministic; production cleanup behavior unchanged. |
| Spec AC14; backlog 011 | 7. Run real Chrome and sealed generic-label field layouts, privacy, final gates and dual review. | Same-page import graph and exact PDF evidence; source hashes unchanged; no private name/bytes; no credible NOT COMPLIANT. |

## Mandatory red matrix

### Values and same-page behavior

| Measure | Below floor | Exact floor | Below preferred | Exact preferred |
|---|---:|---:|---:|---:|
| Font pt | 8.99 block | 9 floor-pass | 9.99 advisory | 10 pass |
| Line ratio | 1.279 block | 1.28 floor-pass | 1.319 advisory | 1.32 pass |
| Margin mm | 7.99 block | 8 floor-pass | 9.99 advisory | 10 pass |

Also test missing/non-string/non-pixel/non-finite/zero computed font/line-height and prove evidence
capture precedes the exact PDF without page mutation/navigation.

### Real Chrome graph

- One valid rule in active local import passes; add one active local rule and it blocks as two.
- Active import nested through active print media and true supports traverses.
- Screen media/false supports root, group and import skip without reading descendants.
- Disabled root skips. Active declarative owner with absent/mismatched sheet blocks.
- Import media/supports false with absent child skips. Active child null/undefined/non-object blocks.
- An unconditional import with an exposed `supportsText` null sentinel passes capability preflight;
  absent/undefined/other non-string values block, while non-empty strings use `CSS.supports`.
- `cssRules` getter throw, null, undefined, non-list, missing `item`, hole and inconsistent item/index
  each block even when another valid rule exists.
- Missing/non-numeric CSSRule constants; missing/non-numeric rule type; missing/non-string condition,
  selector, media/supports text; missing style methods/length/items/values each block.
- Known unconditional group traverses; unknown or condition-bearing unsupported group blocks.
- Same completed stylesheet object reached twice deduplicates. Two separate objects with same URL/
  bytes remain distinct and block when both contain rules. Active-stack repeat blocks. A finite graph
  already cut by Chrome is accepted without source reconstruction.
- Zero page rules; named/pseudo rule; multiple active rules; mixed/missing/negative/non-mm/function/
  keyword declaration block. One-to-four shorthand and four longhands pass.

At least imported-only, imported+local conflict, nested active/inactive, owner mismatch, active null
child, `cssRules` null/undefined, unknown group, identity duplicate, distinct duplicate, cycle, zero
rule and declaration grammar must execute through the real production Chrome path. Synthetic object
tests alone do not establish runtime behavior.

For browser states Chrome cannot naturally produce, use a dedicated child Chrome instance and
restore every modified property descriptor in `finally`, or exercise a pure traversal input without
changing browser/Node globals. Never monkeypatch a shared prototype in the Vitest process.

### Policy/transaction/privacy

- Old policy missing floor/preferred gates or preferred literals fails with exact update guidance
  and no staging residue/receipt.
- Missing/duplicate/extra/wrong-severity gate fails. Complete policy yields one finding per gate.
- Blocking capability/floor failure leaves no output; preferred failure may publish only as
  review-required or exact human-resolved, still false.
- Receipt schema remains v1; source/policy/evidence/output mutation makes it stale.
- Claim-integrity failure cleanup test owns a unique temp parent passed to its child process and
  checks only that parent.
- `src/no-personal-data.test.ts` runs before the full-suite claim. Execution/backlog records use
  `field-pack-a`, `field-pack-b`, counts and digests only; no prohibited private target label.

## Allowed paths and budgets

Production:

- `src/render/chrome.ts`
- `src/gates/claimIntegrity.ts`
- `src/gates/editorial.ts`
- `src/policy/verify.ts`
- `src/verify/pack.ts`

Tests/records:

- `src/render/chrome.test.ts`
- `src/gates/editorial.test.ts`
- `src/gates/claimIntegrity.cli.test.ts` (owned-temp race only)
- `src/policy/verify.test.ts` only if policy cases cannot live clearly in pack tests
- `src/verify/pack.test.ts`
- `src/verify/production.test.ts`
- `src/verify/trust.test.ts` only for the mechanical valid-policy fixture update required by the
  stricter v1 threshold schema; no corpus-trust behavior may change
- `backlog/011b-prove-same-page-accessibility-authority.md`
- one sanitised execution record under `docs/superpowers/execution/` only if needed

Ceilings: 5 production files / 360 added lines; 7 test files / 520 added lines; 2 record files / 120
added lines. Deletions from replacing the old accessibility path do not consume added-line budget.
No edit to corpus/strategy semantics, evidence resources, distinct/impact, receipt schema, CLI,
root exports, README/skill/examples or 012 files.

## Verification and field protocol

After inserting the exact reviewed 011a merge anchor, run on one final commit:

```bash
git merge-base --is-ancestor 6c71a00ec74ae4e61c1d77db9525ffb6865b9679 HEAD
npm test -- --run src/gates/editorial.test.ts src/render/chrome.test.ts src/verify/pack.test.ts src/verify/production.test.ts
npm test -- --run src/gates/claimIntegrity.cli.test.ts
npm test -- --run src/no-personal-data.test.ts
npm test -- --run
npm run build
npm pack --dry-run
git diff --check <base>...HEAD
git diff --numstat <base>...HEAD
git status --short
```

The real field run uses sealed temporary copies from the authoritative private vault. Record a
before source manifest; run generic `field-pack-a` and `field-pack-b` below/exact/between/preferred
layouts plus one local-import layout; record only gate IDs, boolean/disposition, page count, exit,
receipt existence/digest and source-manifest equality; visually inspect the exact receipt-bound PDFs
for page count, clipping, overlap, glyphs and role/employer consistency without retaining public
copies; remanifest source; require equality; delete temporary bytes.

## Non-goals

- No CSS source scan, regular-expression parser, custom media/supports evaluator, cascade engine,
  second browser/page, URL/content deduplication or generic CSSOM abstraction.
- No corpus/strategy redesign, 012 cleanup, root export, README/skill/example or package release.
- No receipt schema/version change, hidden-stage/rename redesign or success-message change.
- No private source edit, field-pack repair, human attestation/waiver/approval, publication or
  submission.
- No patch, cherry-pick or merge from the rejected 011 branch.

## Historical completion/review gate — void

Review begins only after all seven steps and the real Chrome/field protocols are complete on the
same final commit. Give both reviewers this whole plan, programme position, original source,
PRD/work unit, exact topology/dependency, diff, budgets, logs summary and sanitised evidence. One
reviewer independently checks source compliance/correctness/real behavior; the other checks the
same source plus simplicity/surgical scope. Any credible `NOT COMPLIANT` blocks. If a remediation
review again exposes fail-open capability, stop for another boundary redesign rather than patching.

This gate was attempted and final review did not approve. Do not merge 011b or mark the umbrella
done. Plan 02A3 / 011c is the only executable replacement and must receive its own whole-plan review.
