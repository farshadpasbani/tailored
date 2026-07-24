# Plan 02A1 — Connect status-aware corpus and editorial authority

Date: 2026-07-14
Work unit: Tailored `011a`
Dependency: reviewed Tailored 010 ancestry; execution base must descend from `f4a57352`

## Immutable authority

| Source | Anchor |
|---|---|
| Original trustworthy-engine specification | `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md` at `a1cd1827f19ff3e30681597b0760ae45218577dc`; SHA-256 `f7abbb27cf9445a5fdd2299c46c48becaed94cabfd52bde1e94c6aa3a069591e` |
| Implementation PRD | `docs/superpowers/prds/2026-07-14-trustworthy-application-engine-prd.md` at `d69d3ca70e98e2c81f50d7564b8e1412f0e1626d`; SHA-256 `0142c0c3e41294f2a89b2256c1079f0224d94eaabab641848fee9e2d53837358` |
| Original 011 umbrella | `backlog/011-report-status-aware-editorial-advisories.md` at `f4a57352bc27d854db80cd1af36e5e008f720dde`; SHA-256 `c388ff8b3c8c633919439eb679caee772cd7dffbc4cc87d08021a1bb82dd765a` |
| Executable unit | `backlog/011a-connect-status-aware-editorial-authority.md` at `f4a57352bc27d854db80cd1af36e5e008f720dde`; SHA-256 `45d645ddf2f2775609e86a6f001dc0499d3dd2c11c5f5848bdba61a9655a95be` |
| Rejected evidence | `codex/011-editorial-advisories@b113c80d12ef2f00750705338b3f05de78a8c587`; never patch/cherry-pick/merge |

## Outcome and necessity gate

Make the existing `verify-pack` transaction consume only trustworthy final corpus members and emit
explicit strategy/editorial advisory findings. Reuse the current descriptor, snapshot, distinct,
impact, finding-disposition, receipt and atomic exposure machinery. The only new standalone modules
permitted are the missing strategy schema/evaluator and small editorial evaluator.

This slice does not touch accessibility. The current `accessibility` advisory and existing policy
thresholds remain byte-identical, so partial main is coherent and does not claim FR-010. The 011
umbrella and 012 remain blocked.

## Ownership and invariants

- Caller owns lifecycle status. Tailored owns strict parse, eligibility, physical containment,
  exact hash enforcement and receipt binding.
- Only `approved` and `submitted` members are eligible. Every other status is excluded before path
  resolution, `lstat`, `realpath`, read or hash.
- The v1 trust base is the real non-symlink parent of the pack directory. Every descriptor and
  eligible member remains beneath it with no symlink component.
- Current-pack exclusion uses physical path identity only. A separate byte-identical final remains
  eligible and must collide.
- Strategy v1 may read legacy missing fields, but clean strategy requires opening, argument,
  non-empty unique anchor fact IDs and selected project IDs. Missing judgement is never invented.
- V1 metadata can report reference/fact-quality problems but cannot prove role-relative semantic
  altitude. `evidence-altitude` stays failed/review-required unless an exact human record resolves
  it; resolution never changes `ok:false`.
- Findings and messages are stable-sorted. No advisory licenses a claim or changes blocking truth.

## Traceability and ordered steps

| Original requirement | Plan step | Expected implementation evidence |
|---|---|---|
| Spec approach 6, AC10; PRD FR-007 | 1. Add strict lifecycle values and implement eligibility-before-I/O plus one physical trust root in the existing snapshot walk. | Red/green tests prove non-finals are unread even when missing/outside; eligible missing/stale/escape/symlink/cycle/duplicate/case-collision blocks before output. |
| Spec approach 6, AC10; PRD FR-007 | 2. Bind only eligible document bytes, exclude exact current physical paths, retain distinct byte twins, sort corpus inputs deterministically and preserve descriptor/member hashes in receipt freshness. | Complete-pack tests show current path absent, twin collision present, permutation-stable findings, and stale mutation keys. |
| Spec advisory boundary; PRD FR-008/FR-009 | 3. Extract the existing internal strategy shape to one schema/evaluator and add opening, argument and anchor facts compatibly. | Complete strategy and every legacy/unknown/duplicate/empty case produce exact stable diagnostics; no inferred replacement values. |
| Spec goal/approach 5; PRD FR-009 | 4. Add the smallest pure editorial evaluator by composing existing impact signals, and connect strategy/editorial/distinct diagnostics once through `authoritativeFindings`. | Receipt contains deterministic density, selection, self-reference, natural-language and collision messages; accepted/waived failures remain false. |
| Spec AC8/9/13; PRD FR-005/006/017 | 5. Prove the unchanged transaction, resolution binding and freshness path on the final tree. | Blocking corpus errors expose no candidate/receipt; interrupted/concurrent/malformed cases remain green; accessibility/policy/render diffs are empty. |
| Spec AC10/14; PRD FR-011 | 6. Replay the authoritative corpus from a sealed temporary copy and record only generic labels/counts/digests. | Source before/after manifest identical; expected 8-pack/16-document denominator, 0/8 cover-to-cover and 3/8 cover-to-all, or a precise detector/hash delta. |
| Whole source specification | 7. Run final-tree gates, privacy scan, budgets and dual independent review. | Clean scoped diff, all commands on one final commit, no credible NOT COMPLIANT. |

## Red matrix

### Corpus

- Each of `current`, `draft`, `skipped`, `abandoned`, `superseded`, and `withdrawn` points to a
  missing, escaping or permission-denied path; verification proves no filesystem operation occurs.
- Eligible missing, unreadable, stale-hash, absolute/relative escape, symlink base/descriptor/parent/
  member, malformed nested descriptor and active cycle each block `corpus-eligibility`.
- Duplicate/case-colliding IDs and physical paths block before distinctness.
- Exact current physical path is excluded. A different approved/submitted path with the same bytes
  remains bound and yields a collision.
- Declaration permutations yield identical included-member and finding order.

### Strategy/editorial/disposition

- Complete valid strategy; each missing new field; all missing; empty/duplicate/unknown project or
  fact IDs; selecting every project; low-confidence/sensitive/disallowed/incomplete-metric anchors.
- Fact-quality diagnostics may disappear when corrected, but semantic altitude remains failed under
  schema v1 until exact human resolution.
- Density, weak phrasing, overlong skill rows, undated entries, duplicate sentences, excess
  rhetorical contrast, mixed candidate person and mandatory human natural-language review.
- `review-required`, exact human `accepted`, exact human `waived`, stale/wrong/multiple resolution;
  every resolved failed advisory retains `ok:false`.

### Transaction/regression

- Corpus blocker, malformed strategy and stale resolution leave no output or receipt.
- Source mutation before exposure aborts. Re-run into an empty destination preserves bound hashes
  and findings; policy/corpus/strategy/output mutations make freshness stale.
- Existing font/margin/line-height implementation, policy gate IDs/thresholds, Chrome inspector,
  claim-integrity and CLI help have no diff.

## Allowed paths and budgets

Production:

- `src/verify/trust.ts`
- `src/strategy/schema.ts`
- `src/gates/editorial.ts`
- `src/verify/pack.ts`

Tests/record:

- `src/verify/trust.test.ts`
- `src/strategy/schema.test.ts`
- `src/gates/editorial.test.ts`
- `src/verify/pack.test.ts`
- `backlog/011a-connect-status-aware-editorial-authority.md`
- one sanitised execution record under `docs/superpowers/execution/` only if needed

Ceilings: 4 production files / 300 added lines; 4 test files / 360 added lines; 2 record files / 120
added lines. Read-only regression paths include `src/gates/distinct.ts`, `src/gates/impact.ts`,
`src/policy/verify.ts`, `src/render/chrome.ts`, `src/gates/claimIntegrity.ts`,
`src/verify/receipt.ts`, `src/cli.ts`, and all 012 documentation.

If the production ceiling cannot hold a readable implementation, stop with a proposed smaller
trust joint. Do not hide code in tests or create an abstraction merely to move the line count.

## Verification and field protocol

Run on the same final commit:

```bash
git merge-base --is-ancestor f4a57352bc27d854db80cd1af36e5e008f720dde HEAD
npm test -- --run src/verify/trust.test.ts src/strategy/schema.test.ts src/gates/editorial.test.ts src/verify/pack.test.ts
npm test -- --run src/gates/distinct.test.ts src/gates/impact.test.ts src/verify/production.test.ts
npm test -- --run src/no-personal-data.test.ts
npm test -- --run
npm run build
npm pack --dry-run
git diff --check <base>...HEAD
git diff --numstat <base>...HEAD
git status --short
```

For the private corpus: generate a before path/size/mode/SHA-256 manifest from the authoritative Job
Apply estate; copy only required bytes outside both repositories; build the supplied manifest from
authoritative lifecycle inventory, never a glob; run; record generic `field-corpus` counts, gate IDs,
exit codes and digests; remanifest source; require exact equality; delete the copy. Never record
private prose, employer names, URLs, personal paths or receipts containing source content.

## Non-goals

- No font, line-height, page-margin, Chrome, claim-integrity or policy change.
- No root export, README, skill, exemplar, public fixture, conflict-copy or package-release work.
- No semantic scorer, prose generator, model reviewer, corpus crawler or alternate receipt schema.
- No private pack repair, human resolution authorship, approval, publication or submission.
- No commit or merge from either rejected evidence branch.

## Completion/review gate

The implementer supplies the complete plan, anchored source, final diff, exact test summary,
sanitised field record and budget count only after all seven steps. Then dispatch one reviewer for
source compliance/correctness/real behavior and one for simplicity/surgical scope. A credible
`NOT COMPLIANT` blocks merge. After both approve, merge 011a, mark it done, and start 011b from that
exact merge. No user-only blocker exists before that point.
