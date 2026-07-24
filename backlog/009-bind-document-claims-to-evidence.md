---
id: "009"
title: Bind document claims to evidence
status: done
depends_on: ["007"]
acceptance:
  - Every factual clause in CV and cover carries a stable HTML claim marker with an exact matching evidence.yaml record and allowed candidate or employer evidence IDs
  - Unknown, missing, duplicated, stale, empty, or unannotated claim-bearing content fails closed with artifact and location diagnostics
  - Employer/JD evidence cannot license a first-person candidate claim, and structured numbers require matching subject, unit, denominator, scale, and timeframe
  - A valid paraphrase with the correct evidence binding passes the deterministic integrity layer while the CLI no longer says arbitrary semantic truth is proved
files:
  - src/evidence/schema.ts
  - src/gates/claimIntegrity.ts
  - src/gates/trace.ts
  - src/gates/trace.test.ts
  - src/cli.ts
  - src/index.ts
---

## Context

Make provenance inspectable without freezing every application into canon
wording. HTML claim IDs and the exact evidence map form the deterministic
boundary. Semantic entailment remains a named reviewer/human responsibility and
must never be mislabelled as a code proof.

Field fixtures include the Vendor-C/Vendor-D number attachment, Vendor-A's drift and
LLM-as-judge language, Vendor-E/Vendor-F RFI claims, and an empty document.

## Assumptions

- Structural markup is part of the authored pack contract.
- Existing number/name/date extraction remains defence in depth, not the truth
  authority.

## Does not count

- Requiring a claim ID but never checking its exact rendered text or namespace
  does not count.
- Allowing employer text and candidate evidence in one undifferentiated corpus
  does not count.
- A gate that still passes empty or unannotated factual documents does not
  count.
