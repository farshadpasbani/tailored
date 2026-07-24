---
id: "007"
title: Migrate canon and block forbidden claims
status: done
depends_on: []
acceptance:
  - A strict schemaVersion 2 canon models every current private-canon namespace and rejects an unknown or misspelled key with its exact path
  - The v1 compatibility loader and migrate-canon command preserve every source value, report unmapped data, generate stable unique IDs, and are deterministic and idempotent
  - claims.cannot, protected topics, metric subject/unit/timeframe conflicts, and representative OpenAI API, AWS, ANSYS, chartership/sign-off, database, tenure, and internal-IP claims fail closed
  - The Vendor-C/Vendor-D 124-commit versus 58-gate-run failure is red before implementation and blocked afterward, while the real private canon migrates and validates cleanly
files:
  - src/canon/schema.ts
  - src/canon/load.ts
  - src/canon/migrate.ts
  - src/gates/prohibitedClaims.ts
  - src/cli.ts
  - src/index.ts
  - examples/
---

## Context

Deliver the first trustworthy v2 vertical slice: a real canon can migrate,
validate, and immediately block a known semantic prohibition through the CLI.
Keep legacy reads explicit and lossless during the migration window. Remove
tracked conflict-copy sources only where this slice establishes their canonical
replacement; preserve unrelated untracked iCloud copies.

The private field fixture is
the private vault's `canon.yaml` plus the Vendor-C/Vendor-D interlock-number claims. The
public repository must use sanitised fixtures reproducing the same structure.

## Assumptions

- Candidate-attested provenance is valid provenance when labelled honestly.
- Existing human-readable sections remain; stable facts are referenced rather
  than duplicated as a second truth store.

## Does not count

- Adding `.strict()` while dropping currently ignored private namespaces does
  not count.
- Matching forbidden phrases only as exact strings while known paraphrases pass
  does not count.
- Green migration tests that never run the real private canon or the 124/58
  counterexample do not count.
