---
id: "008"
title: Assess fit from requirement evidence
status: done
depends_on: ["007"]
acceptance:
  - requirements.yaml freezes source quotes, requirement class and weight, eligibility impact, ATS terms, evidence fact IDs, gaps, and dated waivers against the archived JD hash
  - Fit is calculated only from the requirement-evidence map; adding literal words to a CV changes ATS but cannot change fit
  - Hard blockers remain visible regardless of aggregate score and post-freeze reclassification requires a receipt-bound waiver
  - Vendor-A and Vendor-B real fixtures separate direct evidence, transferable evidence, material gaps, sponsorship uncertainty, fit, and ATS without reproducing the prior false assurance
files:
  - src/jd/schema.ts
  - src/jd/load.ts
  - src/requirements/schema.ts
  - src/requirements/migrate.ts
  - src/gates/fit.ts
  - src/gates/ats.ts
  - src/cli.ts
---

## Context

Replace keyword coverage as the fit authority with a frozen, inspectable mapping
from employer requirements to canon fact IDs. Retain legacy `jd.yaml` behavior
behind a clearly named compatibility model; it may report keyword evidence but
cannot claim verified v2 fit.

Field-test both real Vendor-A and Vendor-B JDs. The outcome need not be APPLY;
the observable requirement is that genuine evidence, gaps, eligibility and ATS
vocabulary remain separate.

## Assumptions

- Requirement interpretation is agent-authored but becomes immutable once
  frozen; human waivers are explicit records.
- Fit output is evidence for later portfolio ranking, not an offer probability.

## Does not count

- Renaming the current keyword percentage to “evidence fit” does not count.
- Letting a high weighted total hide a hard eligibility blocker does not count.
- A synthetic JD test without Vendor-A and Vendor-B field results does not
  count.
