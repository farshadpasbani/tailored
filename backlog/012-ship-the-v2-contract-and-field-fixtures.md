---
id: "012"
title: "Deferred: public v2 contract and fixtures"
status: blocked
depends_on: ["007", "008", "009", "010", "011"]
acceptance:
  - A named external consumer or release decision establishes which public surface is actually needed
  - Public documentation describes only behavior exercised by that consumer
  - Sanitised fixtures reproduce observed failure classes without private data
  - Existing private imports and real pack generation remain working while the public surface is assessed
files: []
---

## Disposition

Deferred. The private workflow already consumes Tailored's public package entry. Expanding and
polishing a generic v2 contract before another person or product needs it creates compatibility
obligations without product evidence.

Do nothing now. Do not clean conflict copies, broaden exports, invent fixtures, publish a package,
or rewrite documentation merely to complete the old programme shape.

## Revisit trigger

Reopen only after both conditions are true:

1. an explicit external consumer or release decision names the required surface; and
2. a non-builder has used the current workflow and supplied feedback that the change can answer.

Then prefer documentation and connection of existing exports before any runtime code.
