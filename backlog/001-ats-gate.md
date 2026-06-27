---
id: "001"
title: Add the ATS gate (tailored ats)
status: in-review
depends_on: []
acceptance:
  - "`tailored ats <pdf> --jd <jd.yaml>` exists, validates the jd, exits 0/1"
  - A CV PDF with no text layer FAILS with a clear no-text-layer message
  - A CV missing a must-have keyword FAILS, listing the missing term(s)
  - A CV that parses and meets --min coverage PASSES, printing coverage %
  - niceToHave never affects the exit code
  - The gate fabricates nothing and reads nothing personal (only the PDF text and jd.yaml)
  - "`tailored smoke` renders the example CV and the ats gate passes against examples/alex-rivers/jd.yaml"
  - All new functions have vitest coverage; npm test green; npm run build clean
files:
  - src/jd/schema.ts
  - src/jd/load.ts
  - src/gates/run.ts
  - src/gates/pageFit.ts
  - src/gates/ats.ts
  - src/cli.ts
  - examples/alex-rivers/jd.yaml
  - skill/SKILL.md
---

## Context

First sub-project of the "tailored as funnel optimiser" effort (goal: raise a
candidate's chance of landing the job, not just produce a tidy PDF). The ATS
keyword/parse screen is the funnel's biggest hard filter; most online applications
die there before a human reads them.

Adds a deterministic `tailored ats` gate that fails a CV before sending if it would
not survive an ATS: no text layer, missing contact/headings, or must-have keyword
coverage below `--min` (default 0.8). The agent extracts the JD's keywords into an
inspectable `jd.yaml` (model proposes); the gate deterministically decides. The
gate checks keyword presence only and never licenses fabrication: a missing
must-have is either real canon evidence to surface, or a genuine fit gap (a later
sub-project), never an invented skill.
