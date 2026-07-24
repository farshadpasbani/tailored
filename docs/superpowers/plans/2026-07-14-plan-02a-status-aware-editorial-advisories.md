# Plan 02A — Tailored 011 delivery index

Date: 2026-07-14
Status: historical delivery record; not executable
Programme position: Tailored 007–010 -> 011a(done); 011b/011c retired; 012 deferred

> Superseded for execution by
> `docs/superpowers/prds/2026-07-14-field-first-reset.md`. Plan 02A3 must not be dispatched.

## Authority

| Source | Immutable anchor | Role |
|---|---|---|
| Original specification | `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md` at `a1cd1827f19ff3e30681597b0760ae45218577dc`; SHA-256 `f7abbb27cf9445a5fdd2299c46c48becaed94cabfd52bde1e94c6aa3a069591e` | Final product and compliance authority |
| Implementation PRD | `docs/superpowers/prds/2026-07-14-trustworthy-application-engine-prd.md`; planning SHA-256 `c3e6707d10600f398913654c87cec40bc36493d379dc73bfdbf1f3f33c52c4ec` | Sealed input and closed stylesheet profile |
| Original 011 umbrella | `backlog/011-report-status-aware-editorial-advisories.md`; planning SHA-256 `f48d134a130788a066360c5cd1b336614905fc092c9bd05ff0393625c6282384` | Preserved source-unit acceptance |
| Executable 011c | `backlog/011c-prove-sealed-profile-accessibility-authority.md`; SHA-256 `aa5edeb68298de86053c94cca458d385a45006a22f79dcdf29cba56079083b74` | Replacement acceptance boundary |
| Detailed Plan 02A3 | `docs/superpowers/plans/2026-07-14-plan-02a3-prove-sealed-profile-accessibility-authority.md`; SHA-256 `2e620245d6e51367944086a96c616101bc02d90e440d8e0b014bdc93541aca9d` | First dependency-valid execution plan |
| Tailored baseline | `main` at `d748222604fa179a328e608237da0ed7c336437f` | Contains reviewed 011a and accessibility planning only |

The original specification wins over every downstream document. A changed source hash or a base
that does not descend from the named baseline stops production work until the plan is reconciled.

## Historical reason the replacement was proposed

`codex/011-editorial-advisories@b113c80` is rejected evidence. Its final review found a fail-open
CSSOM case (`cssRules` returning null/undefined could hide an active rule), a privacy record that
made the claimed full-suite pass false, and a nondeterministic shared-temp test. Earlier reviews
had already forced two accessibility boundary resets. More local repair would be crack injection
around an unproved joint: lots of resin, no design confidence.

That branch MUST NOT be patched, merged or cherry-picked.

The later `codex/011b-accessibility-authority@d83a0b5` reimplementation also failed after its one
remediation. Its property ledger did not cover rule classification: nominal font-face/keyframes
leaves could expose hidden nested rules, and a prototype swap could change `instanceof` while every
recorded property stayed stable. It is retired evidence. Plan 02A3 returns to the smallest coherent
joint: sealed declarative input plus the field-proven one-root/top-level profile.

## Exact DAG

```text
Tailored 010 reviewed main
  -> 011a corpus/status + strategy/editorial authority (Plan 02A1, done)
  -> 011b open-ended CSSOM approach (Plan 02A2, retired evidence)
  -> 011c sealed-profile accessibility authority (Plan 02A3)
  -> mark original 011 umbrella done
  -> 012 public contract/fixtures (Plan 02B)
  -> private-vault lifecycle adapter work
```

`011c` is the first dependency-valid Tailored plan. It starts in a fresh worktree from exact
post-planning main. Work may continue in parallel only in the independent private-vault repository;
Tailored ancestry remains serial.

## Slice contracts

| Unit | What becomes live | Explicitly unchanged/excluded | Detailed plan |
|---|---|---|---|
| 011a (done) | Status filtering before read, physical corpus trust, strategy schema/diagnostics, deterministic editorial advisories, receipt-bound findings | Accessibility, CLI and public docs | `2026-07-14-plan-02a1-connect-status-aware-editorial-authority.md` |
| 011b (retired) | No live outcome; failed open-ended graph/classification evidence | Never execute, repair, merge or copy implementation | `2026-07-14-plan-02a2-prove-same-page-accessibility-authority.md` |
| 011c (ready) | Sealed declarative renderer, one synchronous same-page observation, closed one-root/top-level CSSOM profile, floor/preferred policy and receipt connection | Corpus/strategy semantics, import/group support, source parsing, alternate renderer, receipt schema, public docs | `2026-07-14-plan-02a3-prove-sealed-profile-accessibility-authority.md` |
| 012 | Root API, compatibility/docs/skill, sanitised fixtures, conflict-copy closure and package evidence | Any redesign of 011 behavior | `2026-07-14-plan-02b-ship-v2-contract-and-fixtures.md` |

## Shared execution law

- Apply the necessity gate first: reuse and connect existing modules before adding code.
- One concern per commit; no speculative framework, adjacent cleanup, package release or version bump.
- Preserve Tailored `.DS_Store` and all untracked private-vault application/specification artefacts.
- Private field sources are sealed/read-only; retain aggregate generic-label evidence only.
- No agent authors human attestation, waiver, approval, publication or submission.
- Run the deterministic no-personal-data gate before recording a full-suite pass.
- No reviewer during red/green work. After the implementer claims the complete slice, dispatch two
  independent final reviewers against the original specification, real behavior, and simplicity.
- Any credible `NOT COMPLIANT` blocks merge. A second failed remediation ends patching and requires
  a new boundary decision.

## Branch disposition

- `codex/011-editorial-advisories@b113c80`: retired evidence; never integrate.
- `codex/009-claim-evidence-public@8fbcf47`: retired; never integrate.
- `codex/011b-accessibility-authority@d83a0b5`: retired after failed remediation review; no third patch.
- 011a: reviewed `6c71a00` is on main. 011c: fresh worktree/branch from exact post-planning main.

There is no user-only blocker to starting 011c. The Tailored-side plan records an owed private-vault
programme-map cross-anchor refresh; Job main must not move while its independent A1a1 review is in
flight. Human action remains necessary only for semantic
acceptance/waivers, application or package publication, and the final external-use feedback gate.
