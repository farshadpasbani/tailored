---
id: "003"
title: Add the fit triage gate (tailored fit)
status: ready
depends_on: []
acceptance:
  - "`tailored fit --jd <jd.yaml> --canon <canon.yaml>` exists, validates both
    inputs, and prints a verdict: APPLY, APPLY-WITH-GAPS, or SKIP"
  - Must-have coverage is computed against the canon's full text (skills,
    projects, experience, claims), reusing the ats gate's synonym-aware
    whole-word matcher; niceToHave coverage is reported but never changes the
    verdict
  - "Verdict thresholds: APPLY at mustHave coverage >= --apply (default 0.8),
    SKIP below --floor (default 0.5), APPLY-WITH-GAPS between, listing each
    uncovered must-have"
  - Exit code 0 for APPLY and APPLY-WITH-GAPS, 1 for SKIP, so batch dispatch can
    gate on it
  - Every uncovered must-have is printed with the question to grill the candidate
    with ("does the canon genuinely lack X, or is it phrased differently?"),
    because a gap is either missing canon evidence or a real fit gap, never a
    licence to fabricate
  - The gate reads only jd.yaml and canon.yaml; nothing is written, nothing
    leaves the machine
  - "`tailored smoke` runs fit for the example candidate against
    examples/alex-rivers/jd.yaml and verdicts APPLY"
  - A jd.yaml with must-haves absent from the example canon is proven to verdict
    SKIP in a test
  - All new functions have vitest coverage; npm test green; npm run build clean
files:
  - src/gates/fit.ts
  - src/gates/fit.test.ts
  - src/cli.ts
  - skill/SKILL.md
---

## Context

Third sub-project of the "tailored as funnel optimiser" effort. The pipeline
currently spends its full cost (grill, author, render, gate, eyeball) on every
role regardless of fit; odds per application matter less than odds per hour.
`tailored fit` is the triage step that runs before anything is written: it scores
the canon against the jd.yaml the intake step already produces and tells the
candidate whether the application is worth the hour.

The skill pipeline gains a step between intake and authoring: extract jd.yaml,
run fit, and on APPLY-WITH-GAPS surface the uncovered must-haves as grill
questions before writing a word. On SKIP, stop and say why. In the batch-dispatch
workflow the exit code becomes the dispatch filter: agents are only spawned for
roles that clear the floor.

v1 is keyword-coverage only, deliberately. Seniority, location, visa, and salary
matching need jd.yaml schema enrichment and canon fields that do not exist yet;
that is a separate unit once this one proves the triage loop. Do not extend the
jd schema here beyond what the verdict needs.
