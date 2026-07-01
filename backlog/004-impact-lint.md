---
id: "004"
title: Add the impact lint gate (tailored impact)
status: ready
depends_on: []
acceptance:
  - "`tailored impact <cv.html>` exists, exits 0/1, and prints every violation
    with the offending text and the check that caught it"
  - "Readability floor: the body font-size must be >= --min-font (default 9pt)
    and the @page margins >= --min-margin (default 8mm); a CV compressed below
    the floor FAILS, because page-fit must be satisfied by selection, not
    compression"
  - "Summary ceiling: the .summary paragraph must be <= --summary-max-words
    (default 60); over the ceiling FAILS"
  - "Duplicate-sentence check: no normalised sentence of 8+ words may appear
    twice in the document (the summary restating a project bullet verbatim is
    the canonical failure); duplicates FAIL, printing both locations"
  - "Rhetorical-contrast counter: at most one 'X, not Y' construction per
    document (patterns: ', not ', '; not ', ', never ' used as a contrastive
    tail); a second occurrence FAILS, because once is voice and five times is a
    template"
  - "Person consistency: the document must not mix third-person self-reference
    with first person (e.g. 'he ships' alongside 'I write'); mixing FAILS"
  - "Dated entries: every project and experience entry must contain a year
    (19xx/20xx) in its header line; an undated entry FAILS"
  - "Bullet bounds: each li must be <= --bullet-max-words (default 45) and must
    not open with a banned weak phrase ('Responsible for', 'Involved in',
    'Worked on', 'Helped to'); violations FAIL"
  - Every check is individually silenceable via a flag, but none are silenced by
    default; the gate reads only the HTML and writes nothing
  - "`tailored smoke` runs impact on the example CV and passes (fix the example
    if it violates a check, do not weaken the check)"
  - Each check has a proven-red test (a fixture that violates it and FAILS)
    alongside its passing case; npm test green; npm run build clean
files:
  - src/gates/impact.ts
  - src/gates/impact.test.ts
  - src/gates/text.ts
  - src/cli.ts
  - skill/SKILL.md
  - skill/references/house-style.md
---

## Context

Fourth sub-project of the "tailored as funnel optimiser" effort, and the first
aimed at the recruiter's six-second skim rather than the ATS parse. Motivated by
a review of two real delivered packs (Bloomberg GenAI Search and Cohere FDE,
2026-07-01), which surfaced six recurring defects that every existing gate
passed:

1. Page-fit satisfied by compression (8.5pt body, 5mm margins) instead of
   selection, producing a wall of grey with no skim landing points.
2. The summary restating a project bullet word for word ("retrieve, cite, or
   abstain" and the recall@5 sentence each appeared twice on one page).
3. The "X, not Y" rhetorical contrast used four or five times per page,
   turning a voice into a machine-detectable template.
4. A mid-sentence grammatical person switch ("operates what he ships: I write
   the agentic system").
5. Undated project entries, so neither a recruiter nor a recency-computing ATS
   can tell 2019 work from last month's.
6. Three-claim run-on bullets chaining unrelated achievements with "and".

All six are deterministic, so they belong in a gate, not in the visual
checkpoint: the agent reading the preview wrote the prose an hour earlier and is
a poor judge of its own tics; a regex has no such loyalty.

The gate parses the authored HTML (structure-aware: .summary, .entry headers,
li elements, the style block), which is acceptable coupling because
references/house-style.md is the contract for that structure; update it in the
same change so the rules and the gate agree. Reuse the sentence and
normalisation helpers in src/gates/text.ts where they fit. v1 targets the CV;
running it on cover notes (which have no .summary or entries) is out of scope.
