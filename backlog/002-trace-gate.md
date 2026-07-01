---
id: "002"
title: Add the evidence-trace gate (tailored trace)
status: ready
depends_on: []
acceptance:
  - "`tailored trace <html> --canon <canon.yaml>` exists, validates the canon, exits 0/1"
  - Every numeric claim in the document (percentages, currency amounts, counts,
    year ranges) must trace to a value in the canon or to the archived job
    description text (`--jd-text <job-description.md>`, optional); an orphaned
    number FAILS, listing each untraced claim with its surrounding phrase
  - Every employer, education institution, and named project in the document must
    match a canon entry; an unknown name FAILS with the offending string
  - Date ranges in experience entries must match the canon's start/end for that
    employer; a padded or shifted date FAILS
  - Numbers that are structural to the document (page CSS, font sizes, style
    attributes) are ignored; only rendered text is checked
  - The gate reads only the HTML, the canon, and the optional JD text; it
    fabricates nothing and phones nothing home
  - "`tailored smoke` runs trace on the example CV against
    examples/alex-rivers/canon.yaml and passes"
  - A doctored example (one invented metric) is proven to FAIL in a test
  - All new functions have vitest coverage; npm test green; npm run build clean
files:
  - src/gates/trace.ts
  - src/gates/trace.test.ts
  - src/gates/text.ts
  - src/cli.ts
  - skill/SKILL.md
---

## Context

Second sub-project of the "tailored as funnel optimiser" effort. The README's
core claim is that gates, not prompts, stop the model from inventing an employer
or padding a date, yet no existing gate enforces it: ip-guard stops leaks, nothing
stops inventions. "Everything must trace to the canon" currently lives in the
skill prompt, which is exactly the hope-based enforcement the project exists to
replace.

`tailored trace` makes the rule mechanical. It extracts the rendered text from the
authored HTML, harvests every checkable claim (numbers, employers, institutions,
project names, date ranges), and requires each to match a fact in the canon,
after normalisation (e.g. `40%` vs `40`, `£1.2m` vs `1200000` are the same claim;
define the normaliser in `src/gates/text.ts` alongside the existing helpers).
Claims that describe the employer rather than the candidate (a cover note quoting
the JD) trace to the archived job description instead, via `--jd-text`.

The gate is conservative by design: a false positive costs one `--jd-text` flag or
one canon addition; a false negative ships a fabricated fact. When in doubt, fail.
This unit does not attempt semantic checking of prose claims ("led a team") — that
is a later unit; v1 covers the claim types that are cheap to extract and expensive
to get wrong.
