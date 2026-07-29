---
id: "016"
title: One canon projection, one atomic write, one threshold source
status: done
depends_on: ["015"]
acceptance:
  - One canon-to-text projection exists (canon/corpus.ts) covering the union
    of the field sets canonToText and canonCorpus read today; fit, trace, and
    distinct all call it; canonToText and canonCorpus are deleted; distinct's
    extra-identity composition either folds into the one projection or is
    named as a distinct concern in that module with a stated reason
  - Every gate verdict change caused by the projection unification is
    ENUMERATED and justified before merge - run the affected gates (fit,
    legacy-fit, trace, distinct) over the bundled examples AND over a
    read-only copy of the job-apply vault's real packs, at merge base and at
    HEAD, and record every flip with the field that caused it; a flip that
    cannot be justified as more correct is a blocker, not a note
  - One atomic-write module (fs/atomicWrite.ts) with tmp-then-rename
    semantics and an `exclusive` option replaces all three variants in cli.ts
    (the two migrate paths and the linkSync receipt path); each caller's
    observable behaviour - including refusing to overwrite where it refuses
    today - is preserved and tested
  - policy/thresholds.ts is the single source for the pack quality standards
    (font floor, margins, line height, word caps, ATS ratio, max pages);
    gates/impact.ts's defaults, the policy schema's minimums, the CLI flag
    defaults, and smoke's remaining inert 0.8 literal all read it; no
    threshold value is written twice anywhere in src/
  - Behaviour is otherwise identical - the CLI oracle (all commands, help,
    failure paths) matches the merge base except the enumerated projection
    flips, and verify-pack over the fixture pack produces the same 18
    findings in the same order with the same verdicts
  - Cross-repo field test - the job-apply vault's practice-vault battery
    (--text) and gate-test suite run GREEN against a packed install of THIS
    build in a scratch copy; the live job-apply checkout is read-only
  - npm test green on the final tree; production.test.ts unchanged; cli.ts
    sheds its fs and threshold concerns (flags in, registry call, exit out)
convergence:
  stop_when: One projection, one atomic-write module, and one threshold
    source are live; every projection-caused verdict flip is enumerated and
    justified; the fixture receipt and the CLI oracle match the merge base
    otherwise; the cross-repo battery is green; npm test passes
  assurance: internal
  blockers: [acceptance-failure, trust-regression, downstream-breakage,
    unjustified-verdict-flip]
  deferred:
    - chrome.ts split (card 4)
    - docs generated from the registry (card 5)
    - the fat GateInput and the duplicated packResults call (card 1 review)
    - gate.ts re-deriving commander's option-name rule (card 1 review)
  max_review_waves: 2
  successor_policy: human-only
  integration: pr
files:
  - src/canon/corpus.ts
  - src/gates/fit.ts
  - src/gates/trace.ts
  - src/gates/distinct.ts
  - src/fs/atomicWrite.ts
  - src/policy/thresholds.ts
  - src/policy/verify.ts
  - src/gates/impact.ts
  - src/cli.ts
---

## Context

Architecture card 3 (2026-07-27 walk; decisions in CONTEXT.md "Thresholds").
Card 1 already took the per-command formatting out of cli.ts (629 to 342) and
moved its inline canon flattening into the distinct gate. What remains of the
card: three incompatible canon-to-text projections (fit's canonToText,
trace's canonCorpus, and distinct composing canonToText with extra identity
fields), three divergent atomic-write implementations in cli.ts, and
threshold values written in several places at once.

Non-obvious constraints: the projection unification is the one change here
that can move a gate's verdict, because a fact traceable through one field
set is not traceable through another - hence the enumerate-and-justify
acceptance rather than a bare identity requirement. The receipt path's
linkSync variant exists because it must FAIL when the target exists; the
unified helper must keep that (the `exclusive` option), not silently
overwrite a receipt. Threshold values are a compatibility surface: existing
policy.yaml files carry them, so the schema's shape and its accepted ranges
must not change - only the DEFAULTS get one home. The job-apply vault consumes
this CLI (battery.sh calls commands by name; its ats-decisions gate greps the
ats command's warning text verbatim), so the cross-repo field test stands.
This branch stacks on 015 (PR #10, awaiting the owner's review); if 015
merges first, rebase onto main.
