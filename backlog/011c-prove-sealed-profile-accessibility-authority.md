---
id: "011c"
title: "Retired: sealed-profile accessibility authority"
status: blocked
depends_on: ["011a"]
acceptance:
  - The rejected implementation remains evidence only and is never merged, cherry-picked, copied, or patched
  - Existing PDF verification and human visual review remain the active control
  - Any future change starts from a reproduced failure in a real generated PDF
files: []
---

## Disposition

Retired after final review. The implementation branch
`codex/011c-sealed-profile-accessibility` at `5425e2f` allowed authored scaling to make PDF text
materially smaller than the computed body-font evidence while still passing the stated floor.

The right response is not another wider proof engine. There is no recorded user failure, the
current house style is already constrained, and the exact PDF is visually reviewed. Continuing
would spend product time strengthening a test rig that has not yet carried a new application.

## Revisit trigger

Never resume this branch. If a real pack exposes an uncaught readability defect, define a new
surgical unit against that exact fixture and the smallest responsible boundary.
