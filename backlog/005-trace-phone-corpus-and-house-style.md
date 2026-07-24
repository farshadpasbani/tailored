---
id: "005"
title: trace phone-in-corpus fix + house-style drift rules
status: done
acceptance:
  - "canonCorpus() in src/gates/trace.ts includes identity.phone, identity.email, and identity.location (currently omits all three), proven by a unit test."
  - "The Alex Rivers example carries a phone number in canon (examples/alex-rivers/canon.yaml) and in the CV header (examples/alex-rivers/cv.html), and `tailored trace examples/alex-rivers/cv.html --canon examples/alex-rivers/canon.yaml` PASSES."
  - "A trace vitest proves phone-digit tracing: the phone's digit-groups are extracted as numeric claims and trace only because identity.phone is now in the corpus (test is red without the canonCorpus change, green with it)."
  - "skill/references/house-style.md states the three rules the real packs drifted from: (a) experience/education title line is 'Title, Org' only — location belongs in the .meta div (e.g. 'Location · Dates'); (b) project entries use <div class=\"title\">Name: tagline</div> (a div.title, name and tagline joined by a colon), not <div><span class=\"title\">…</span>:; (c) bullets must stay within the impact bound of 45 words."
  - "All existing tests stay green (npm test)."
  - "No real candidate canon or pack data is committed; the fixture is the fictional Alex Rivers example only."
files:
  - src/gates/trace.ts
  - src/gates/trace.test.ts
  - examples/alex-rivers/canon.yaml
  - examples/alex-rivers/cv.html
  - skill/references/house-style.md
---

## Context

The trace and impact gates (merged 2026-07-01) fail on real candidate packs. Grounding
against the Alex Rivers example (which the parsers were written against) proved the gates
and the documented house-style are CORRECT — the example passes both. The real packs fail
for two distinct reasons:

1. **One genuine gate bug (this task's code fix):** `canonCorpus()` builds its trace corpus
   from name/role/summary/skills/projects/experience/education/certs/pubs but OMITS
   `identity.phone` (also email and location). So a phone number in a CV header — e.g.
   "+44 7XXX XXXXXX" — has its digit-groups ("44" and the rest) extracted as numeric
   claims by `extractNumericClaims`/`CLAIM_RE`, and they cannot trace, producing spurious
   "untraced claim" failures. The Alex Rivers example never exposed this because it has no
   phone number. Fix: include identity.phone/email/location in `canonCorpus`, and add a
   phone to the Alex Rivers example so the path is covered by a regression test.

2. **Pack drift from the house-style (NOT fixed here — separate per-pack re-author):** the
   real packs put "Org · Location" on the experience title line (parser captures the whole
   thing as the org, so it never matches canon's org), use `<div><span class="title">Name</span>:`
   for projects instead of `<div class="title">Name: tagline</div>` (parser extracts no
   project name → structural failure), and run 55–70-word bullets against the impact bound
   of 45. The gates are right; the packs must be re-authored to conform. This task only makes
   those rules explicit in house-style.md so the re-author has a crisp contract and future
   packs stop drifting. It does NOT change the packs (they live in a separate private repo).

Scope discipline: this is the phone-in-corpus bug + regression fixture + a house-style doc
clarification. Do not loosen any gate. Do not touch impact.ts or the trace name/date/project
parsers — those are correct; the packs are wrong. Ungoverned repo → this backlog file is the spec.
