---
id: "014"
title: Retire pack.testing.ts; test the real verifyPack through injected dependencies
status: done
depends_on: []
acceptance:
  - src/verify/pack.testing.ts is deleted; verifyPackForTest,
    TestPackDependencies, and TestVerifyReceiptSchema exist nowhere in the
    tree
  - verifyPack accepts an optional dependencies override matching the
    existing ProductionDependencies shape (verifyAndRender, extractText,
    pageCount); filesystem, hashing, snapshot capture, and the staging
    transaction always run real — they are not injectable
  - The receipt payload gains `dependencies: "production" | "injected"`,
    written by the transaction and bound by receiptSha256; a receipt produced
    with any override carries "injected"
  - Freshness verification rejects a receipt whose dependencies is not
    "production", and a test proves the rejection
  - Receipts written before this change (no dependencies field) still parse
    and verify as production; a test with a pre-change receipt fixture proves
    it
  - Every scenario currently in src/verify/pack.test.ts runs against the real
    verifyPack with injected fakes and passes; src/verify/production.test.ts
    is unchanged
  - Guard tests are updated, not weakened - no test-only verify entry point
    is exported from the package, and a published install contains no
    test-only verify module
  - Field test on a Chrome+poppler machine - the CLI verify-pack lane over the
    examples/alex-rivers pack produces a green receipt carrying
    dependencies "production"
  - npm test is green on the final tree
convergence:
  stop_when: pack.test.ts exercises the production verifyPack end to end with
    injected fakes, the clone is deleted, and the example-pack CLI run yields
    a production-marked receipt
  assurance: internal
  blockers: [acceptance-failure, trust-regression, legacy-receipt-breakage]
  deferred:
    - gate registry (architecture card 1)
    - cli.ts extraction (card 3)
    - chrome.ts split (card 4)
    - docs generation (card 5)
  max_review_waves: 2
  successor_policy: human-only
  integration: pr
files:
  - src/verify/pack.ts
  - src/verify/pack.testing.ts
  - src/verify/pack.test.ts
  - src/verify/receipt.ts
  - src/index.test.ts
  - src/evidence/packageReplay.test.ts
---

## Context

Architecture card 2 (2026-07-27 walk; decisions in CONTEXT.md "Receipt
provenance"). pack.testing.ts is a hand-maintained re-implementation of the
pack transaction; 15 of 16 pack tests exercise the clone while the only test
of the real verifyPack skips on machines without Chrome+poppler. Three guard
tests currently defend the duplication; this unit replaces the wall with data
(receipt provenance) and deletes the clone.

Non-obvious constraints: the clone's dependency surface is deliberately wider
than the production seam (it lets tests inject the gates themselves via
blockingChecks/advisoryChecks) — that width dies with the clone; ported tests
drive real gates and fake only render/inspect/pdf-text/page-count. The
receipt schema change must not invalidate receipts already in the wild:
the field is optional on parse (absent = production) and receiptSha256
binding prevents stripping it from an injected receipt.
