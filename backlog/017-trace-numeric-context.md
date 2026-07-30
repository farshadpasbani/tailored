---
id: "017"
title: A number is traced only when its context matches, not its bare value
status: done
depends_on: ["016"]
acceptance:
  - untracedNumbers no longer grounds a document number on a bare equal value
    anywhere in the corpus; a document number counts as traced only when the
    corpus carries the same value in a comparable context (its unit or its
    immediately adjacent significant word), and a bare list enumerator or
    ordinal in prose (a digit followed by "." or ")" in list position)
    grounds nothing
  - The reproduction from the card-3 review is a regression test - a canon
    whose claims prose contains the enumerators "1. 2. 3." must NOT ground a
    document's unrelated "3", and the test fails against the pre-change
    implementation
  - Every number that becomes newly UNTRACED across the real corpus is
    enumerated with its document and its context, and each is a genuine gap
    (a figure the canon does not actually support in that sense); if any
    newly-flagged number is in fact supported and the matcher is simply too
    strict, that is a blocker, not a note
  - Numbers that legitimately stay traced are unaffected - run trace over
    every real cv.html and cover.html in a read-only copy of the downstream
    vault plus the bundled example, at merge base and HEAD, and record the
    full before/after table
  - The downstream impact is stated plainly - the downstream vault's battery
    runs trace on every pack, so if the tightening turns previously-green
    real packs red, the count and the packs are named in the handoff for the
    owner (declaring a metric claim is their remedy, not a matcher loosening)
  - The pack lane is untouched - trace still declares run: null, no receipt
    gains or loses a finding, and verify-pack over the fixture pack produces
    the same 18 findings with the same verdicts
  - npm test green; the ats warning text and every other command's output
    unchanged (CLI oracle)
convergence:
  stop_when: The enumerator reproduction is red against the old matcher and
    green now, every newly-untraced number across the real corpus is
    enumerated and justified as a genuine gap, and the pack lane is provably
    unchanged
  assurance: internal
  blockers: [acceptance-failure, over-strict-matcher, trust-regression]
  deferred:
    - chrome.ts split (card 4, running in parallel on its own branch)
    - docs generated from the registry (card 5)
    - prohibitedClaims' own numeric tokenisation (shares numeric.ts but has
      its own evidence rules - out of scope)
  max_review_waves: 2
  successor_policy: human-only
  integration: pr
files:
  - src/gates/trace.ts
  - src/gates/numeric.ts
---

## Context

Found by the card-3 review (unit 016) and referred to the owner as a scope
change; the owner authorised the fix on 2026-07-30. `untracedNumbers` builds a
Set of bare numeric VALUES from the canon and JD text, so any equal number
anywhere grounds any document number regardless of meaning. The reviewer
reproduced it: a canon whose `claims.can` prose contains the list enumerators
`1. 2. 3.` grounds a document's unrelated `3`, `24` and `30`. The same
mechanism already let "a 24 hour rota" ground "24 hours a week" before unit
016 existed.

Non-obvious constraints: this TIGHTENS a truth gate, so the risk runs the
opposite way from every other unit in this programme - the danger is not a
silent pass but a newly-noisy gate that cries wolf on legitimate documents.
Hence the two-sided acceptance: the enumerator case must stop grounding, and
every newly-flagged number must be a real gap. `numeric.ts`'s tokeniser is
shared with prohibitedClaims, which has its own evidence rules - extend the
tokeniser if needed but do not change what prohibitedClaims sees. trace is
terminal-only (`run: null`), so no receipt is at stake, but the downstream
vault's battery runs it on every pack, so a tightening is felt immediately in
the owner's daily loop. This branch stacks on 016 (PR #13); card 4 runs in
parallel on 018 and touches different files.
