# Plan 02B — Ship the v2 public contract and field fixtures

Date: 2026-07-14
Status: historical plan; deferred and not executable
Programme position: closes the public Tailored v2 contract before the private vault binds its staging flow

> Superseded for execution by
> `docs/superpowers/prds/2026-07-14-field-first-reset.md`. Reopen only for a named external consumer
> and non-builder feedback; 011c is not a dependency and must not be resumed.

## 1. Source lineage and execution baseline

| Authority | Exact anchor | Role |
|---|---|---|
| Original specification | `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md` at commit `a1cd1827f19ff3e30681597b0760ae45218577dc`; SHA-256 `f7abbb27cf9445a5fdd2299c46c48becaed94cabfd52bde1e94c6aa3a069591e` | Product behavior and acceptance authority |
| Implementation PRD | `docs/superpowers/prds/2026-07-14-trustworthy-application-engine-prd.md`; planning SHA-256 `c3e6707d10600f398913654c87cec40bc36493d379dc73bfdbf1f3f33c52c4ec` | Closed defaults including sealed-profile accessibility authority |
| Work unit | `backlog/012-ship-the-v2-contract-and-field-fixtures.md`; planning SHA-256 `7bae61d1b61f43d79b3ac10fcef88569bb1581f9aaa85aeeaaf0378c9ad795ad` | Slice acceptance and rejection criteria |
| 011 delivery index | `docs/superpowers/plans/2026-07-14-plan-02a-status-aware-editorial-advisories.md` plus reviewed Plan 02A1 and executable Plan 02A3 | Required independent merge boundaries; retired 02A2 is not ancestry |
| Replacement accessibility plan | `docs/superpowers/plans/2026-07-14-plan-02a3-prove-sealed-profile-accessibility-authority.md`; SHA-256 `2e620245d6e51367944086a96c616101bc02d90e440d8e0b014bdc93541aca9d` | Must merge with compliant review before 012 starts |
| Programme map | the private vault's programme map | Cross-repository dependency order |
| Umbrella plan | the private vault's umbrella plan, unit 02B | Necessity, budgets and review boundary |
| Planning baseline | Tailored local `main` `d748222604fa179a328e608237da0ed7c336437f` | Contains reviewed 011a; it does not contain 011c implementation |

Authority precedence is original specification -> PRD -> this detailed plan -> implementation
evidence. A downstream layer may not weaken an upstream requirement.

## 2. Hard dependency and start gate

Tailored 012 MUST start from a fresh worktree based on local `main` only after reviewed Tailored 011a
and replacement 011c have each:

1. completed its whole-plan verification and private field evidence;
2. received source-compliant correctness and structural review verdicts;
3. merged into local `main`; and
4. been recorded `done` in their executable backlog units, with the original 011 umbrella also
   recorded `done` after 011c.

The controller SHALL record both reviewed merge commits and prove the 011c merge is an ancestor of
the 012 worktree with `git merge-base --is-ancestor <011c-merge-sha> HEAD`. Planning baseline
`d748222` is not permission to assume 011c behavior exists. If reviewed 011
differs from the PRD, stop on the authority conflict rather than designing around it in 012.

## 3. Outcome and necessity decision

Tailored 012 SHALL make the already-built v2 engine consumable and honestly documented through its
root package entry, reconcile and remove proven conflict-copy orphans, publish sanitised public
failure-class fixtures, and verify the same failure classes against private read-only copies.

The necessity order is:

1. **Connect** existing internal parsers, schemas, policies, findings, receipt/freshness and the
   reviewed 011 strategy/corpus types through the existing root export.
2. **Delete** only conflict copies whose unique content has been proved absent or reconciled.
3. **Document** one assurance vocabulary across CLI help, README, skill and house style.
4. **Add fixtures/tests** only for failure classes not already represented.
5. Add runtime code only for a missing root export or a precise compatibility/migration diagnostic.

A second DTO, compatibility wrapper, new public subpath, new verifier, renderer, policy engine,
schema version, package version, or release mechanism is forbidden. Treat the package boundary as a
flange connection: expose the reviewed load path; do not cast a second beam beside it.

## 4. Requirement trace and ordered work

| Source / PRD requirement | Ordered implementation, deletion, or documentation step | Required evidence |
|---|---|---|
| Spec AC11; PRD FR-012 | Inventory actual gate IDs, finding severities, receipt state, CLI commands and reviewed 011 terminology. Define one vocabulary table, then update CLI help, README, `skill/SKILL.md` and house style from it. | Help snapshots and documentation assertions agree; no deterministic-taste or semantic-truth claim; `ready-for-human` is never called approval. |
| Spec data/command surface; PRD FR-016 | Compare internal exported schemas/types/functions with `src/index.ts`; wire only missing root exports, including reviewed 011 `StrategySchema`/`Strategy` and existing corpus/policy types. | TypeScript consumer compiles from `import ... from "tailored"`; runtime root imports resolve; no consumer or source contains `tailored/dist/` or another private subpath. |
| Spec AC12; PRD FR-013 | Freeze the v1 compatibility matrix in tests, then connect existing migration commands and precise diagnostics. | Each v1 case either follows the labelled compatibility path or fails with the exact migration command; no opaque Zod/module-resolution error. |
| Spec AC13; PRD FR-014/FR-017 | Inventory tracked conflict copies, compare each byte/AST/test assertion against its canonical peer and history, reconcile any unique content into the canonical file with its own red test, then delete only proved orphans. | Machine-readable comparison table, source commit/blame evidence, test proving retained unique behavior, final `git ls-files` conflict-copy search empty for authorised source/test copies. |
| Spec AC14; PRD FR-015 | Add minimal fictional Vendor-C/Vendor-D, Vendor-A and Vendor-B failure-class fixtures plus the additional PRD trust-boundary cases needed to exercise the shipped public workflow. | Public tests reproduce the named red failure before the corrected/complete variant passes; no fixture contains private prose, identity, URL, contact detail or source hash. |
| Spec AC14; PRD FR-015 | Replay real Vendor-A/Vendor-B packs and complete corpus only from sealed read-only source or temporary copies after public fixtures pass. | Before/after source hash manifests identical; aggregate failure kinds, gate counts and receipt digests recorded outside public Git; actionable failures before authorised repair and verified receipts after existing authorised repair evidence. |
| Spec AC13; PRD FR-014 | Build, test, self-lint, smoke, pack and scan the final tree and exact tarball in a clean clone/install context. | Full commands pass; tarball allowlist exact; reachable-tree and extracted-package privacy scans have zero unresolved matches. |
| Unit AC1 | Prove the root API is the same strict authority used internally and by the private vault. | Compile/runtime import inventories cover every supported public symbol and installed/root dependency mode. |
| Unit AC2 | Reconcile every user-facing instruction after behavior and exports are final. | CLI/help/README/skill/house-style terminology matrix is exact and skill validation passes. |
| Unit AC3 | Perform conflict-copy closure before package gates. | Unique-content proof precedes deletion; final clean clone/package contains no conflict copy. |
| Unit AC4 | Keep sanitised and private fixtures as separate evidence classes. | Public Git contains fictional fixtures only; private replay evidence stays external and sources remain unchanged. |

## 5. Public root export inventory

Before editing `src/index.ts`, the worker SHALL generate an inventory from the final merged-011 tree
and classify every symbol as `already-root-exported`, `missing-required-export`, or `internal-only`.
The required root surface is:

| Contract family | Required root surface |
|---|---|
| Package identity | `version` |
| Canon | strict/legacy canon schemas and types; load/parse/parse-v2; migration and migration result |
| Requirements | schemas/types; load/parse; canonical digest/hash; baseline/change receipt issue and validation; legacy-JD migration; verified fit and ATS analyzers/types |
| Evidence/resources | evidence schemas/types/loaders; declarative HTML parsing; resource manifest build/hash/verification and types |
| Deterministic gates | claim-integrity preflight/full verification and types; prohibited-claim/structured-metric APIs and types; rendered-document inspection types |
| Complete pack | `PackDescriptorSchema`, `PackDescriptor`, `verifyPack`, `verifyReceiptFreshness`, `assertVerifierIssuedReceipt`, `IssuedVerifyReceipt` |
| Receipt/findings | `VerifyReceiptSchema`, `VerifyReceipt`, `FindingSchema`, `PackFinding` |
| Policy | reviewed 011 policy schema, gate ID schemas/constants and `VerifyPolicy`; no parallel policy DTO |
| Corpus/trust | reviewed 011 corpus/member schemas and types; waiver/attestation schemas and types |
| Strategy | reviewed 011 `StrategySchema` and `Strategy` only; no second strategy format |

`exports["."]` remains the sole supported runtime/type entry and `./package.json` may remain. The
package stays ESM `tailored@0.1.0`; no version bump is authorised. Root exports SHALL re-export the
exact internal symbols rather than copy their shapes. API compile tests MUST include both value and
type imports and a runtime assertion that `verifyPack` and `verifyReceiptFreshness` are callable.

## 6. Exact v1 compatibility and migration behavior

| Input/consumer | Required behavior |
|---|---|
| Unversioned/schema-v1 canon under `validate` | Read through the existing compatibility parser and print an explicit legacy warning naming `tailored migrate-canon`; verified v2 operation still requires v2. |
| `migrate-canon` | Deterministic, idempotent v1 -> strict v2 conversion; duplicate/unresolved IDs fail before output replacement. |
| Legacy `jd.yaml` | `legacy-fit` and `ats --jd` remain labelled keyword compatibility only; they MUST NOT issue verified fit. `migrate-requirements ...` is the named route to v2. |
| Legacy policy-v1 shape after reviewed 011 | Fail with the reviewed direct policy-update instruction; MUST NOT issue a new `ready-for-human` receipt when required gates or preferred thresholds are absent. Complete extended policy v1 remains supported. 012 may document/update examples but MUST NOT redesign 011 policy behavior. |
| Legacy strategy v1 missing opening/argument/anchors | Preserve reviewed 011 read compatibility and failed `review-required` advisories; never invent the missing judgement. |
| Receipt schema v1 | Remains schema v1. Changed policy, engine, source, attestation, waiver or output hashes make it stale through existing freshness authority. |
| Existing command names | Remain discoverable: `validate`, `migrate-canon`, requirement migration/freeze/fit/ATS, `claim-integrity`, `ip-guard`, `impact`, `distinct`, `render`, `verify-pack`, `verify-pack-fresh`. |
| Unsupported root/deep import | Root import works. Private `tailored/dist/...` imports are unsupported and SHALL be absent from Tailored and private-vault source. |

Compatibility errors MUST name the failed contract, detected version, and exact migration command;
normal CLI output MUST not expose stack traces or source prose.

## 7. Assurance vocabulary contract

CLI help, README, `skill/SKILL.md`, `skill/references/house-style.md`, and exemplars SHALL use these
exact concepts consistently:

- **Blocking proof:** strict schema/referential integrity, candidate/employer namespace separation,
  protected/prohibited claims, rendered claim binding, required artefact/hash integrity, PDF text and
  page integrity, corpus eligibility, and absolute accessibility floors.
- **Advisory judgement:** ATS vocabulary, AI-tell, impact, distinctness, strategy selection, evidence
  altitude, editorial naturalness, and preferred accessibility targets.
- A failed advisory remains `ok: false`; `review-required`, human `accepted`, or human `waived`
  records disposition, not deterministic truth.
- Claim bindings prove exact declared text/source relationships within supported rules; they do not
  prove arbitrary paraphrase entailment or taste.
- `tailored verify-pack` is the complete command. Success means `ready-for-human`, never `approved`,
  `published`, `send-ready`, or `submitted`.
- Absolute floors are 9pt / 1.28 / 8mm. Preferred targets are 10pt / 1.32 / 10mm. Content selection
  is preferred to compressing toward the floor.
- Fit comes from frozen requirement evidence. ATS terms remain vocabulary diagnostics and cannot
  license evidence or improve verified fit.

A single terminology snapshot/fixture SHALL feed assertions for CLI help and documentation so drift
fails visibly rather than being rediscovered by prose review.

## 8. Conflict-copy reconciliation

At planning baseline, tracked conflict-copy inventory includes:

- authorised source/test candidates: `src/no-personal-data.test 2.ts`,
  `src/smoke-example.test 2.ts`, `src/smoke.test 2.ts`;
- historical backlog duplicates `backlog/001-... 2.md` through `006-... 2.md`.

This unit authorises reconciliation/deletion only of the three tracked source/test candidates. The
six historical backlog duplicates are inventory evidence and out of scope; preserving them is not a
package-contract failure. Generated `dist/* 2.*` files are not source: build/package verification
MUST run from a clean clone or cleaned generated directory and MUST prove they are absent from the
tarball, but they SHALL NOT be committed.

For each authorised candidate:

1. identify its canonical peer and record both SHA-256 hashes, sizes, and originating commits;
2. compare exact text, then AST/test names and assertions so formatting does not hide unique behavior;
3. use `git log --follow`, blame, and relevant commits to distinguish stale duplication from a later
   fix stranded in the copy;
4. if unique behavior exists, write the smallest failing test against the canonical file, port only
   that behavior in a separate commit, and make it pass;
5. only after the canonical tests cover all unique behavior, delete the copy;
6. record `deleted`, `retained-out-of-scope`, or `merged-then-deleted` with evidence in the execution
   record; and
7. prove the package tarball and clean generated tree contain no ` 2.` source/test/build names.

Delete first and investigate later -> evidence loss. Prove uniqueness first and delete second ->
safe demolition.

## 9. Sanitised public fixtures

All fixture people, employers, URLs, prose, IDs and hashes MUST be invented, not redacted private
content. Fixtures SHALL be minimal, deterministic, and named by failure class rather than real firm.

1. **Vendor-C/Vendor-D metric attachment:** canon contains both `124 commits` and `58 interlock runs`, while
   a claim attaches them across different subjects/units/timeframes. The uncorrected fixture MUST
   fail structured metric/claim integrity; a correctly bound sibling MUST pass.
2. **Vendor-A vocabulary without authority:** the JD contains literal LLM/drift terms and ATS reports
   them, but canon/requirements lack candidate fact authority. Verified fit/claim use MUST remain a
   gap or blocker while ATS alone improves.
3. **Vendor-B density split:** one layout crosses 10pt/1.32/10mm preferred targets but stays above
   9pt/1.28/8mm and produces advisory findings; a separate layout crosses an absolute floor and
   blocks.
4. Employer text attempting to license a first-person candidate claim MUST block namespace integrity.
5. Corpus fixture SHALL include current/skipped/abandoned/superseded members excluded before read and
   an approved member whose stale hash blocks eligibility.
6. Strategy fixtures SHALL cover complete, missing opening/argument/anchors, and unknown IDs.
7. Advisory disposition fixtures SHALL cover `review-required`, human `accepted`, and human `waived`
   while preserving `ok: false` and exact finding binding.

Red-first tests SHALL prove each failing fixture fails for the intended named reason before adding or
promoting its corrected sibling.

## 10. Private read-only replay

Private replay SHALL use the authoritative private vault only through a sealed source and
temporary copies. It SHALL NOT change real applications, approve, waive, publish, or submit.

1. Capture a source manifest of every consumed Vendor-A/Vendor-B/corpus file: relative path, size,
   mode and SHA-256.
2. Copy only required inputs into a temporary directory outside both repositories.
3. Run the complete verifier and full-corpus distinct flow against the copy, preserving the expected
   actionable pre-repair failure classes and the already-authorised repaired receipt path.
4. Record only aggregate counts, gate IDs, issue kinds, tool versions and receipt digests outside the
   Tailored repository. Do not record private prose, URLs, personal paths or application bytes.
5. Recompute the authoritative source manifest and require byte-for-byte equality.
6. Delete the temporary copy after representative evidence and invariants have been retained.

Public fixture success without this replay is non-compliant. A private replay that mutates its source
is a blocking incident, not a test cleanup task.

## 11. Red-first cases

Before production or documentation changes, add the smallest checks that fail on the merged-011 tree:

1. a root-only consumer cannot import each required reviewed-011 strategy/corpus/policy symbol;
2. a repository search catches a private `tailored/dist/` consumer;
3. each v1 input receives an opaque/wrong compatibility message instead of the exact migration path;
4. CLI help, README, skill or house style diverges on blocking/advisory/ready-for-human vocabulary;
5. a conflict-copy unique assertion is absent from its canonical test or a copy enters the tarball;
6. each sanitised fixture fails to reproduce its named failure class;
7. a personal-data canary placed in a temporary package tree is detected by tree and tarball scans;
8. an installed consumer importing only `tailored` cannot compile or execute the documented root API;
9. `npm pack --dry-run` includes an undeclared file, generated conflict copy, or private fixture; and
10. a private replay source-hash mutation is detected and blocks completion.

Documentation snapshots SHOULD assert semantic terms and command examples, not whitespace wrapping.
Do not manufacture tests for unchanged 007–010 internals; their existing suites are regression gates.

## 12. Allowed paths, budgets, and non-goals

### Allowed paths

Production/configuration:

- `src/index.ts`
- `src/cli.ts` only for a missing precise compatibility/help message
- `package.json` only for package files/exports needed by an acceptance check; no version change

Documentation/skill:

- `README.md`
- `skill/SKILL.md`
- `skill/references/house-style.md`
- `skill/references/exemplars.md`

Tests/fixtures/records:

- exact public-root, CLI/help, v1 compatibility, fixture, package and privacy tests under `src/`
- `examples/` for sanitised fixtures only
- the three authorised tracked `src/* 2.ts` conflict copies for reconciliation/deletion
- `backlog/012-ship-the-v2-contract-and-field-fixtures.md`
- this plan's execution record

No 011 path, backlog file, implementation note, or behavior may be edited in 012. If 011 is defective,
return the defect to 011 and re-review that unit before resuming 012.

### Circuit-breaker budgets

- Runtime production: at most 3 files / 120 added lines.
- Tests plus sanitised fixtures: at most 6 files / 500 added lines.
- README/skill/reference documentation: at most 4 files / 420 added lines.
- Status/execution records: at most 2 files / 100 added lines.
- Deletions do not consume added-line budget but require the unique-content proof above.

The budget is a ceiling, not a shopping list. If exceeded, remove duplicate fixtures/docs, connect
existing exports, or split the change; do not raise the number.

### Non-goals

No package publication, version bump, remote push, branch visibility change, private-vault edit, private
fixture commit, real-pack repair, application approval/submission, new schema/DTO/public subpath,
prose generator, LLM review, taste blocker, alternate renderer, dependency upgrade, 007–010 refactor,
011 remediation, or deletion of historical backlog duplicates.

## 13. Verification commands and evidence gates

Run targeted checks during red/green work, then run all final commands on the final tree from a clean
worktree/clone. Exact targeted filenames SHALL be recorded after tests are created.

```bash
npm test -- --run <root-api-test> <compatibility-test> <fixture-test> <package-test>
npm test -- --run
npm run build
npm run lint:self
npm run replay:private
npm pack --dry-run
npm pack --json
python ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skill
rg -n 'tailored/dist/|tailored/src/' src skill README.md examples
git ls-files | rg '(^|/)src/.* 2\.(ts|js|d\.ts)$'
git diff --check <merge-base>...HEAD
```

Additional required gates:

- compile a disposable TypeScript consumer against the packed tarball using only root value/type
  imports, then execute its runtime import probe;
- install the tarball in a fresh empty project with `npm install <tarball>` and rerun the root probe;
- compare `npm pack --json` paths to the exact package allowlist (`dist`, `skill`, `examples`,
  `docs/claim-integrity.md`, replay script, README, LICENSE, package metadata) and extract/scan the
  actual tarball rather than trusting dry-run text;
- scan `git ls-files`, the final working tree, all paths/blobs from `git rev-list --objects --all` plus
  `git cat-file --batch`, and the extracted tarball for secrets, personal data, private paths/URLs,
  binary metadata, archives and conflict-copy names;
- prove the package contains no private field bytes, build caches, `.DS_Store`, or unlisted generated
  output; and
- run private replay with exact before/after source manifests and external sanitised evidence.

Final evidence SHALL report command, exit status, test counts, package path inventory/digest,
root-import symbols checked, privacy scan counts, fixture failure classes, and private source hash
equality. Do not paste private logs into the repository.

## 14. Commit and review boundary

One reviewable concern per commit:

1. `test(contract): pin root exports and v1 migration behavior` — red tests only where separation is
   practical, followed by the minimal root/CLI connection in the same reviewed concern.
2. `docs(contract): align public v2 workflow vocabulary` — README, skill, house style and exemplars.
3. `test(fixtures): publish sanitised v2 failure classes` — fictional fixtures and their assertions.
4. `chore(package): reconcile conflict copies and close package gates` — unique-content record,
   authorised deletions, package/privacy checks and 012 execution record/status.

Do not mix 011 remediation into any commit. Before every commit, compare with the 012 merge base using
`git diff --name-only`, `git diff --numstat`, and the budgets above. Generated `dist` and tarballs are
verification artefacts and MUST NOT be committed.

The whole slice receives one dual-review wave only after the implementer reports every plan step
complete. Review packet SHALL include:

- original specification, PRD, backlog 012, this plan and reviewed 011 merge SHA;
- final diff and per-commit concerns;
- public-root inventory and v1 compatibility matrix;
- conflict-copy comparison/deletion evidence;
- sanitised fixture map and private replay aggregate evidence;
- clean-clone/package/privacy/reachable-tree results;
- actual versus budget metrics and all deviations;
- reviewer non-goals and explicit instruction to check source compliance, correctness, privacy,
  simplicity and surgical scope independently.

One reviewer checks source/PRD compliance and real behavior; one checks structure, simplicity,
package/privacy boundary and deletion safety. Any credible `NOT COMPLIANT`, correctness, privacy, or
simplicity blocker returns the complete slice to implementation and a new final review. Reviewers do
not approve package publication or a remote push.

## 15. Autonomous post-review merge condition

After both reviewers return compliant/pass verdicts, the controller MAY merge the reviewed 012 branch
into local Tailored `main` without another plan-approval stop only when all of these remain true:

1. the branch tip is exactly the reviewed tip and contains reviewed 011 ancestry;
2. local `main` has not advanced, or the branch has been rebased and the complete final gates/reviews
   were rerun on the new tree;
3. working tree and index are clean except explicitly preserved pre-existing untracked `.DS_Store` or
   separately authorised planning artefacts;
4. all final commands, public/private fixtures, package inventory and privacy scans remain green;
5. no blocker or unresolved reviewer disagreement exists; and
6. the merge is local only: no package publish, version bump, remote push, release, visibility change,
   human attestation, approval, or submission occurs.

If any condition fails, stop at a merge-ready branch and report the exact blocker. After local merge,
set backlog 012 `done` only if the reviewed status change is part of the approved diff, then preserve
release/push as a separate human decision.

## 16. Does-not-count gates

### Original specification — verbatim

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

### Backlog 012 — verbatim

- Publishing new APIs while the skill still instructs agents to use the old
  unsafe battery does not count.
- Deleting conflict copies without reconciling unique content does not count.
- Passing only sanitised fixtures while the real private packs still fail for a
  different reason does not count.

Every reviewer SHALL cite these exclusions. A result matching any exclusion is `NOT COMPLIANT`
regardless of green unit tests.

## 17. Execution record

The worker SHALL append concise final evidence here; bulky logs remain outside controller context.

- Reviewed 011a merge SHA: `6c71a00ec74ae4e61c1d77db9525ffb6865b9679`
- Reviewed 011c merge SHA: pending
- 012 worktree/branch and merge base: pending
- Necessity check against merged 011: pending
- Red-first cases and observed failures: pending
- Root export inventory/result: pending
- v1 compatibility matrix/result: pending
- Conflict-copy comparison and deletion decisions: pending
- Sanitised fixture outcomes: pending
- Private replay source hashes and aggregate outcomes: pending
- Final commands/test counts/package digest/privacy scan: pending
- Actual production/test/docs/deletion metrics: pending
- Deviations: none recorded
- Dual-review verdicts and reviewed tip: pending
- Merge result or blocker: pending
