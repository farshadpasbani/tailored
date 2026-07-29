---
id: "015"
title: One Gate interface and one registry own the gate set
status: done
depends_on: ["014"]
acceptance:
  - A Gate interface exists - `{ id, severity, run(input) => Promise<Finding> }`
    with `Finding = { id, ok, messages[] }` - and a registry module owns the
    gate set (IDs, severities, ordering, named sets); every gate module
    exports its Gate; bespoke result structs stay as internal implementation
    or separate exported analysis functions, never as the gate lane's shape
  - policy/verify.ts's BlockingGateIdSchema / AdvisoryGateIdSchema DERIVE
    from the registry (z.enum over registry ids) - the gate-ID vocabulary has
    one owner; every ID string and severity is byte-identical to today's, so
    existing policy.yaml files and receipts parse unchanged
  - verify/pack.ts's authoritativeFindings assembles its findings from the
    registry instead of the hardcoded array; the two runtime count-assertions
    become structurally impossible and are removed; a verify-pack run over
    the repo's fixture pack produces a receipt with the same finding IDs,
    severities, and verdicts as at the merge base
  - Every per-gate CLI command remains (same names, same flags, same exit
    semantics) but becomes a thin caller - parse flags, run via the registry,
    print through ONE shared findings formatter, exit from Finding.ok; the
    hand-written per-command formatting loops are gone
  - smoke runs a named gate-set declared in the registry; its inline
    threshold copies are deleted (it reads the same defaults the gates
    themselves use)
  - The one intended behaviour change is enumerated and proven - the impact
    command's exit code now always agrees with the analysis verdict (at the
    merge base, `--skip-min-font` with a failing font printed an error but
    exited 0); everything else is behaviour-identical, evidenced per command
  - Adding a gate is provably one file plus one registration - a test
    registers a synthetic gate and asserts it reaches CLI dispatch, policy
    derivation, and verify-pack assembly with no other edits
  - Cross-repo field test - the job-apply vault's practice-vault battery
    (--text) and its gate-test suite run GREEN against THIS build of
    tailored, via a packed install into a scratch copy; the live job-apply
    checkout is not touched
  - npm test green on the final tree; production.test.ts unchanged
convergence:
  stop_when: cli, smoke, and verify-pack all drive gates through the
    registry; the synthetic-gate test proves one-file-plus-registration; the
    fixture receipt matches the merge base; the cross-repo battery is green;
    npm test passes
  assurance: internal
  blockers: [acceptance-failure, trust-regression, downstream-breakage,
    behaviour-change-beyond-the-enumerated-fix]
  deferred:
    - thresholds single source (card 3 owns policy/thresholds.ts)
    - cli.ts canon-projection/atomic-write extraction (card 3)
    - chrome.ts split (card 4)
    - docs generated from the registry (card 5 - the registry this unit
      builds is its prerequisite)
  max_review_waves: 2
  successor_policy: human-only
  integration: pr
files:
  - src/gates/registry.ts
  - src/gates/*.ts
  - src/policy/verify.ts
  - src/verify/pack.ts
  - src/cli.ts
  - src/index.ts
---

## Context

Architecture card 1 (2026-07-27 walk; decisions in CONTEXT.md "Gate",
"Finding", "Gate registry"). Sixteen gates expose five different pass/fail
conventions and the gate set is restated in four places (policy enum, pack's
hardcoded array, twenty CLI commands, smoke's inline sequence); adding a gate
is an eight-file shotgun edit. After this unit: one interface, one registry,
three thin callers.

Non-obvious constraints: the CLI's flag surface and observable behaviour are
a de-facto contract for the job-apply vault - its battery.sh invokes tailored
commands by name and its ats-decisions gate CONSUMES the ats command's
warning output text, so the ats lane's printed warnings must survive
verbatim. The exit-0-with-error fix is the single sanctioned behaviour
change; per-command before/after evidence is required for the rest (drive
each command over the example/fixture corpus at merge base and HEAD, diff
stdout+exit). CODEOWNERS pins src/gates, src/verify, src/policy - the PR
needs the owner's review regardless. Public API stays: existing index.ts
exports remain; the registry is additive there.
