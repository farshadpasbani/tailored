---
id: "006"
title: Gate ideas from the 2026-07-10 adversarial field reviews
depends_on: []
status: done
acceptance:
  - "distinct gains a cross-pack phrase-frequency budget: a canon-exempt phrase reused in N of the last M exported covers is reported even though each use is individually legal (the mail-merge tell rides in on the canon exemption)."
  - "A comma-splice / appositive-chain lint runs after the ai-tell gate: a document whose dash-shaped joints are uniformly bare commas is flagged (dash surgery leaves a rhythm a picky reader hears)."
  - "impact (or a new gate) enforces metrics-when-JD-is-metric-led: given --jd, if the JD contains benchmark/golden-set/eval language, every project entry must carry at least one number."
  - "A stack-language coverage check: for each language named in the JD stack, if the canon has a project in that language and the CV omits it, warn (selection error, not keyword error)."
  - "An export-time consistency check: assertions in review.md (e.g. phone omitted) must not contradict the rendered PDFs."
  - "A small-denominator lint: an X/Y or N-case eval figure where the denominator is under ~50 is flagged for description-not-headline treatment."
  - "A header-parity check: the .role line must not assert a title the Experience entries contradict (compare noun phrases deterministically where possible)."
  - "A letter-self-reference lint: cover sentences describing the letter's own production process are flagged (allowed only with an explicit waiver)."
  - "A jd.yaml completeness check: every capitalised tool name in job-description.md should appear in jd.yaml's term lists or a written waiver."
  - "A forbidden-claims lint (ip-guard sibling): the canon grows a forbiddenPhrases list (e.g. 'signed off', chartership implications) scanned like protectedTopics; a June 2026 pack shipped 'I have signed off engineering' in direct contradiction of claims.cannot, which no current gate reads."
files:
  - src/gates/distinct.ts
  - src/gates/impact.ts
  - src/gates/aiTell.ts
---

## Context

Two independent adversarial reviews of a real pack (2026-07-10) each found
defect classes the current gates structurally cannot see: batch-level tells
that are per-document legal (canon-fact reuse, uniform splice rhythm), and
JD-conditional standards (metric-led JDs demand metrics). All five ideas are
currently covered by prose rules in house-style.md; this item is about making
the cheap ones deterministic. The prose rules stay either way; gates are
floors, not ceilings.
