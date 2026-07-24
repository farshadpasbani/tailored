# Plan 02A3 — Prove sealed-profile same-page accessibility authority

Date: 2026-07-14
Status: implementation-ready
Work unit: Tailored `011c`
Programme position: reviewed 007–010 -> reviewed 011a -> **011c** -> close 011 -> 012

## 1. Immutable authority and execution baseline

| Authority | Exact anchor | Role |
|---|---|---|
| Original specification | `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md` at `a1cd1827f19ff3e30681597b0760ae45218577dc`; SHA-256 `f7abbb27cf9445a5fdd2299c46c48becaed94cabfd52bde1e94c6aa3a069591e` | Final product and compliance authority |
| Implementation PRD | `docs/superpowers/prds/2026-07-14-trustworthy-application-engine-prd.md`; planning content SHA-256 `c3e6707d10600f398913654c87cec40bc36493d379dc73bfdbf1f3f33c52c4ec` | Closed input/profile/threshold contract |
| Original 011 umbrella | `backlog/011-report-status-aware-editorial-advisories.md`; planning content SHA-256 `f48d134a130788a066360c5cd1b336614905fc092c9bd05ff0393625c6282384` | Preserved source-unit acceptance |
| Executable unit | `backlog/011c-prove-sealed-profile-accessibility-authority.md`; planning content SHA-256 `aa5edeb68298de86053c94cca458d385a45006a22f79dcdf29cba56079083b74` | Slice acceptance and rejection criteria |
| Reviewed dependency | `011a` reviewed tip `6c71a00ec74ae4e61c1d77db9525ffb6865b9679`; tree `67a2a10bf87863627cf371facc7a6c4142dd9ce6`; Plan 02A1 SHA-256 `c7b9828c5a6fe61750810b4b3c82940032339975d6fcd84a2a03916e83c1924c` | Frozen corpus/editorial behavior |
| Execution base | local `main` `d748222604fa179a328e608237da0ed7c336437f` or its docs-only planning descendant | Only authorised implementation ancestry |
| Retired implementation evidence | `codex/011b-accessibility-authority@d83a0b5b39cc182a09db531d10b7c3c5753948df`; tree `71e5a886609eca0b13bf397a804fee42bd3bcf1f` | Tests/ideas only; never patch, merge, cherry-pick or copy code |

Authority precedence is original specification -> PRD -> work unit -> this plan -> implementation
evidence. A changed source/work-unit hash or a base that does not contain `6c71a00` stops production
until the controller reconciles the plan.

## 2. Topology and branch disposition

At planning baseline, local main is 116 commits ahead of `origin/main`, has only preserved untracked
`.DS_Store`, and is an ancestor of the five-commit failed 011b branch. Existing 007–009, rejected
011, reviewed 011a, failed 011b and recovery worktrees are separate evidence estates; some contain
their own preserved `.DS_Store` or untracked `node_modules`. Do not modify or clean any of them.

`codex/011-editorial-advisories@b113c80`, `codex/009-claim-evidence-public@8fbcf47` and failed
011b are non-ancestral evidence for new implementation. Create a fresh 011c worktree from the exact
post-planning main. Reimplement from the current tree. No third remediation of 011b is permitted.

## 3. Outcome and necessity decision

Make the accessibility floor live in the complete-pack transaction: the same immutable Chrome page
must supply effective body font, line height, the sole global page margin, claim evidence and the
exact PDF; capability ambiguity blocks, while preferred targets remain advisory.

Necessity order:

1. **Reuse** the existing parse5 declarative parser, restrictive CSP, resource manifest/snapshot,
   one CDP print page, claim-integrity result, editorial threshold evaluator, policy v1, receipt v1
   and atomic verifier transaction.
2. **Restrict** ready-for-human styles to the exact one-root/top-level shape already carried by all
   159 inventoried current CV/cover artefacts.
3. **Delete from the design** imports, groups, recursion, cycle tracking, classification ledgers and
   hostile-JavaScript object defence.
4. Add only the inspection result and minimal gate/policy wiring that current main lacks.

Documentation alone cannot prove real computed values or exact PDF margins, so executable code is
unavoidable. An open-ended CSSOM framework is not. Narrow the supported load path -> proof; widen
the type system -> another review archaeology site.

## 4. Closed authority algorithm

### 4.1 Input sealing

`inspectAndPrintDocument` itself SHALL run the existing declarative parser before Chrome. It SHALL
fail before spawning/navigating on scripts, event attributes, executable elements/URLs or active
meta behavior. In the production caller, `verifyClaimIntegrity` continues to verify the original
HTML/resource manifest and copy the exact resources, but stages the validated original declarative
HTML for the renderer; the renderer writes/loads only the parser-produced CSP snapshot with a base
pointing at that verified resource copy. No public bypass flag or “trusted” boolean is allowed.

### 4.2 One synchronous observation

After print emulation, `load` and `document.fonts.ready`, the existing trusted inspector performs
one synchronous run-to-completion read. It returns either:

```text
{ ok: true, fontPt: finite-positive, lineHeight: finite-positive,
  marginsMm: [top, right, bottom, left] }
```

or:

```text
{ ok: false, messages: non-empty stable strings[] }
```

Partial values are never consumed. On success the CDP controller sends
`Emulation.setScriptExecutionDisabled { value: true }` before `Page.printToPDF`. It does not
re-enable scripts, navigate, reload, mutate the DOM or open another page. The controller command
order is an asserted contract, not timing luck.

### 4.3 CSSOM profile

The observer accepts exactly:

1. one owner selected from `style, link[rel~="stylesheet"]`; it is an enabled inline `STYLE` with
   no non-empty media qualification;
2. one genuine `document.styleSheets` entry whose index/item, owner sheet, owner node, enabled state
   and empty browser media text agree;
3. finite distinct safe-integer `CSSRule.STYLE_RULE` and `CSSRule.PAGE_RULE` constants;
4. one completely enumerable root rule list;
5. index zero classified by numeric `type` as the sole page rule; every later item classified by
   numeric `type` as a style rule; and
6. every reached rule's optional `cssRules` capability either absent or a completely enumerable
   empty list.

No constructor, prototype, `instanceof`, brand, class name or `Symbol.toStringTag` is read. Imports,
links, all groups, all other at-rules, a second page, page after index zero, and any non-empty nested
list block immediately. There is no recursive identity/cycle algorithm because no supported node
has a child edge.

The page selector is a string empty after trimming. Its style is fully enumerable with unique
non-empty string property names and string values. Accept one `margin` shorthand with one-to-four
finite non-negative `mm` tokens and no longhands, or all four margin longhands with one token each
and no shorthand. Other declarations such as `size: A4` may coexist. Missing/mixed/negative/
non-mm/function/keyword/non-finite margins block.

Body computed font and line-height are positive finite `px` strings from one computed style object.
Font converts by 72/96; line ratio divides by that same font. `normal` and every missing/malformed
shape block.

## 5. Requirement trace and ordered implementation

| Original source / PRD requirement | Ordered step | Expected final-tree evidence |
|---|---|---|
| Spec hard floors and exact PDF integrity; PRD FR-010/6.7 | 1. Add red renderer-entry cases, then connect the existing declarative parser so direct and verify-pack render paths reject executable input before Chrome. | Spawn/page probe remains unused; no PDF/output; parser names the declarative failure. |
| Spec same rendered artefact; PRD FR-005/FR-010 | 2. Replace the old separate print call on current main with one CDP page that captures existing claim evidence plus the accessibility result, disables scripts, then prints. | One target/load/page/readiness; asserted CDP order; exact receipt-bound PDF comes from that page. |
| Spec blocking accessibility; PRD FR-010/6.7 | 3. Implement the one-root/profile observer with numeric type classification and empty-nested-list check. | Real Chrome accepts a field-shaped style and rejects every owner/root/list/type/nesting/profile adversary; no recursive walker or class ledger. |
| Spec floor/preferred distinction; PRD FR-010/8 | 4. Add/extend the smallest pure threshold evaluator and policy-v1 gate requirements. | Exact below/equal/between/equal targets produce blocking floor versus false advisory precisely. |
| Spec AC8/9/13; PRD FR-005/006/017 | 5. Thread complete evidence through claim integrity and verify-pack; keep receipt v1 and transaction semantics. | Incomplete capability blocks with no output; preferred only is ready-for-human/review-required; unchanged rerun is stable and mutations stale. |
| Spec AC14 and “invented only does not count”; PRD FR-015/017 | 6. Run real Chrome and sealed generic-label two-pack field matrices, then final gates and whole-plan dual review. | Source manifests equal; exact PDFs/receipts visually and mechanically match; no private bytes/names; both reviewers COMPLIANT. |

## 6. Mandatory red-first matrix

### 6.1 Seal and same-page sequence

- `<script>`, SVG/MathML handlers, ordinary event attributes, executable URL/data URL, iframe/
  object/embed/meta refresh each fail before Chrome navigation; a direct renderer call cannot bypass.
- Command-order test proves observation success -> script execution disabled -> print; print never
  occurs after an observation failure or disable failure.
- A page cannot navigate/reload/open a second target between evidence and PDF. Claim evidence,
  accessibility evidence and PDF are produced by one target and one load.
- Missing body/fonts readiness, computed API/style, non-string/non-pixel/zero/non-finite font or line
  values block with no partial evidence.

### 6.2 All six failed-011b families at the new boundary

1. **Whitespace import supports:** a browser-native import blocks because imports are unsupported;
   the old getter-mutation script is rejected before Chrome.
2. **CSSStyleRule masquerading as a group:** real CSS nesting produces a non-empty nested list and
   blocks; a script that adds `cssRules` to a style rule is rejected before Chrome.
3. **Group identity/cycles:** native media/supports/layer/container/scope groups block by numeric
   type without descent; a script-built duplicate/back-edge graph is rejected before Chrome.
4. **Changing decision reads:** getter/owner/media/type/style/computed mutations require authored
   script and are rejected; keyframes are unsupported; script execution is disabled before print.
5. **Leaf with hidden children:** font-face and keyframes block by type and are never trusted as
   leaves; any reached style/page rule with non-empty nested capability blocks.
6. **Prototype/`instanceof` flip:** prototype/constructor mutation script is rejected and a source
   search/test proves the accessibility classifier contains no `instanceof`, constructor,
   prototype, brand, class-name or `toStringTag` decision.

These are regression families, not permission to overfit six strings. The invariant is: only
browser-created objects from a sealed declarative page, only two numeric rule types, and no child
edge.

### 6.3 Materially different profile/capability cases

- Zero/two style owners; stylesheet link; disabled owner; non-empty owner media; missing/mismatched
  sheet/owner; zero/two roots; malformed root list/item/index/length; non-empty root media.
- Missing/non-numeric/equal style/page constants; missing/non-numeric rule type; unknown/future type;
  import, media, supports, layer, container, scope, font-face, keyframes, counter-style and property.
- Zero page rules; page not first; named/pseudo page; two pages; page/style nested rules; malformed
  nested-list capability. Invalid CSS discarded by Chrome is irrelevant only when it has no CSSOM
  rule and therefore no print effect; no source interpretation is allowed.
- Style declaration getter throw, null/undefined, malformed length/item/value, holes, duplicate names,
  mixed shorthand/longhand, missing side, negative/non-mm/function/keyword and one-to-four shorthand.

### 6.4 Threshold, transaction and policy

| Measure | Below floor | Exact floor | Below preferred | Exact preferred |
|---|---:|---:|---:|---:|
| Font pt | 8.99 block | 9 floor-pass | 9.99 advisory | 10 pass |
| Line ratio | 1.279 block | 1.28 floor-pass | 1.319 advisory | 1.32 pass |
| Margin mm | 7.99 block | 8 floor-pass | 9.99 advisory | 10 pass |

- Old/missing/duplicate/extra/wrong-severity policy gates block with direct guidance and no output.
- Capability/floor blocker leaves no candidate or receipt. Preferred-only remains `ok:false` with
  review-required or exact human resolution; no agent authors a resolution.
- Receipt schema stays v1. Policy/source/evidence/output mutation makes it stale; concurrent or
  interrupted verification exposes no partial candidate and removes only its owned temporary root.

## 7. Allowed paths and surgical budgets

Production:

- `src/render/chrome.ts`
- `src/gates/claimIntegrity.ts`
- `src/gates/editorial.ts`
- `src/policy/verify.ts`
- `src/verify/pack.ts`

Tests/records:

- `src/render/chrome.test.ts`
- `src/gates/editorial.test.ts`
- `src/gates/claimIntegrity.cli.test.ts` only if an existing cleanup fixture needs the stricter policy
- `src/policy/verify.test.ts` only for policy cases that cannot live clearly in pack tests
- `src/verify/pack.test.ts`
- `src/verify/production.test.ts`
- `backlog/011c-prove-sealed-profile-accessibility-authority.md`
- one generic execution record under `docs/superpowers/execution/` only if the backlog record cannot
  hold the sanitised evidence concisely

Circuit breakers: at most 5 production files / 300 added lines; 6 test files / 450 added lines; 2
record files / 120 added lines. Deleting/replacing a current-main separate render path does not
consume added-line budget. Do not raise the ceiling: first remove traversal, ledgers, adapters,
duplicate fixtures and test-only configurability; if still over, redesign before committing.

Every changed path/line must trace to a row in Section 5. No edit to corpus/strategy/distinct/impact,
receipt schema, CLI, root exports, README/skill/examples, package version/dependencies, 012 behavior,
the private vault, private packs or any retired branch/worktree.

## 8. Real Chrome and sealed field protocol

Real Chrome tests MUST exercise the production path, not only a synthetic object evaluator. At
minimum run: valid field-shaped profile; each exact threshold; one-to-four margin shorthand/four
longhands; link/import/group/nesting/font-face/keyframes/unknown type; root/owner/list/declaration
malformation that Chrome can naturally expose; executable-input rejection; one-page script-lock
command order; no-output transaction.

For states real CSS cannot create without JavaScript-object tampering, test rejection at the
declarative boundary. Do not monkeypatch a shared browser prototype, add a hostile-object framework,
or claim that a pure fake proves Chrome behavior.

Field replay uses sealed temporary copies of generic `field-pack-a` and `field-pack-b` from the
authoritative private vault. Capture before manifests; run below-floor, exact-floor,
between-targets, exact-preferred and valid field-shaped layouts for both CV/cover; record only gate
IDs, booleans/dispositions, page counts, receipt existence/digests, Chrome version and source
manifest equality. Visually inspect the exact receipt-bound PDFs for clipping, overlap, glyphs and
role/employer consistency. Remanifest sources, require equality, then delete copies/PDFs/PNGs/logs.
Do not repair, approve, waive, publish or submit anything.

## 9. Final-tree verification

Run targeted red/green checks during implementation, then all of the following on one final commit:

```bash
git merge-base --is-ancestor 6c71a00ec74ae4e61c1d77db9525ffb6865b9679 HEAD
npm test -- --run src/render/chrome.test.ts src/gates/editorial.test.ts src/verify/pack.test.ts src/verify/production.test.ts
npm test -- --run src/gates/claimIntegrity.cli.test.ts src/policy/verify.test.ts
npm test -- --run src/no-personal-data.test.ts
npm test -- --run
npm run build
npm pack --dry-run
rg -n 'instanceof|prototype|constructor|Symbol\.toStringTag' src/render/chrome.ts
git diff --check <merge-base>...HEAD
git diff --numstat <merge-base>...HEAD
git status --short
```

The `rg` command must have no accessibility-classification hit; unrelated existing marker-visibility
`instanceof Element` is recorded and manually distinguished rather than deleted. Report exact test
counts, package inventory, path/line budgets, command exit status, Chrome field matrix, receipt/PDF
invariants and source-manifest equality. Run the no-personal-data test before claiming the full
suite; logs remain outside controller context and Git.

## 10. Non-goals and “does not count”

- No source scan, CSS parser, condition evaluator, import/group traversal, cycle/identity graph,
  repeated-read ledger, prototype/brand classifier, generic CSSOM abstraction, second page or
  alternate renderer.
- No support for stylesheet links/imports, conditional/layer/container/scope/nested rules,
  font-face, keyframes or future at-rules in ready-for-human.
- No receipt/schema/version/success-message redesign, package release, dependency change, 012
  cleanup, public docs, private repair, human resolution, approval, publication or submission.
- Reusing a failed-branch implementation hunk, green fake-object tests without real Chrome, a
  script lock after print, or a partial font-without-margin result does not count.
- Passing sanitised layouts while the sealed two-pack replay differs or mutates source does not count.

## 11. Whole-plan review and merge boundary

The implementer reports completion only after all six steps, exact final-tree commands, sealed field
evidence, source trace and budget comparison pass on one tip. Dispatch no reviewer for planning,
commits, red/green loops or a partial accessibility joint. Then dispatch two independent reviewers:

1. original-spec compliance, correctness and real Chrome/PDF behavior; and
2. original-spec compliance, simplicity, surgical scope and absence of an open-ended type system.

Both receive this whole plan, original spec, PRD, work unit, programme position, topology, final
diff, generic evidence and non-goals. Any credible `NOT COMPLIANT`, correctness or simplicity
blocker stops merge. One remediation review is allowed for this new unit; a second failure requires
another coherent redesign, not a patch loop.

After both approve, fast-forward the exact reviewed tip to local main, mark 011c and the 011 umbrella
done, refresh Plan 02B anchors, and begin 012 from that exact ancestry. Do not auto-merge remotely,
push, publish or start 012 from ambiguous/unmerged ancestry.
