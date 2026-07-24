---
id: "013"
title: Align the Tailored skill with current CLI lanes
status: done
depends_on: ["011"]
acceptance:
  - The skill distinguishes verified v2 fit from legacy compatibility fit with executable commands
  - The verified lane requires reviewed inputs and forbids manufacturing or impersonating a baseline receipt
  - ATS follows the selected lane and is separate from capability and fit evidence
  - Numeric claim approvals use artefact-specific files
files:
  - skill/SKILL.md
  - backlog/013-align-skill-with-current-cli-lanes.md
---

## Source and field evidence

- Planning authority: `docs/superpowers/prds/2026-07-14-field-first-reset.md` on Tailored
  `main` at `7de5c4122d18359b72a1008933d5ddbc7c709f27`.
- Companion workflow: the corresponding private-vault backlog unit, grounded on that
  repository's `main`.
- Real fixture: an untracked private comparison pack. Replaying the old documented
  `fit --jd` command failed because current `fit` accepts only the verified v2 inputs;
  `legacy-fit` ran successfully and reported the compatibility gaps.

## Necessity and scope

Documentation is sufficient. Describe the two existing CLI lanes accurately. Do not change
runtime code, schemas, receipts, fixtures, application documents, or tests.

## Verification

- Compare each documented option with the corresponding CLI help output.
- Run legacy fit and ATS against the private comparison fixture.
- Confirm the final diff changes only this work unit and `skill/SKILL.md`.

## Execution record

- 2026-07-14: current CLI help confirmed the verified and compatibility command options.
- The private comparison fixture returned `APPLY` under the legacy lane, and legacy ATS passed.
- No runtime, schema, receipt, fixture, application, or test file changed.
