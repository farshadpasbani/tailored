---
id: "011"
title: Report status-aware editorial advisories
status: done
depends_on: ["010"]
acceptance:
  - Exact-hash approved or submitted corpus documents are selected before reading, while non-final and stale entries are excluded
  - Strategy, distinctness, density, selection, self-reference, and natural-language findings are receipt-bound advisories rather than fabricated truth
  - The supplied private corpus reproduces the reviewed aggregate baseline without private content entering Git
  - Existing house style, deterministic PDF checks, and human visual review remain the accessibility control until real use demonstrates a gap
files:
  - src/verify/trust.ts
  - src/strategy/schema.ts
  - src/gates/editorial.ts
  - src/verify/pack.ts
---

## Disposition

Delivered by backlog 011a and independently reviewed at
`6c71a00ec74ae4e61c1d77db9525ffb6865b9679`. The reviewed implementation is on `main`.

The later browser-authority redesigns were not necessary to deliver the product outcome. They tried
to mechanically prove every possible stylesheet mutation although the current product uses a stable
house style, deterministic PDF checks, and human review of the actual PDF. Units 011b and 011c are
therefore retired evidence, not missing parts of this completed unit.

## Revisit trigger

Reopen accessibility behavior only when a real receipt-bound PDF is unreadable or materially
mis-rendered and the existing visual-review path fails to catch or prevent it. Start a new, small,
field-derived work unit; never resume either failed branch.

## Does not count

- Rebuilding a browser/CSS authority model without an observed user failure does not count.
- Treating an editorial advisory as deterministic truth does not count.
- Writing private corpus content or human attestations into Git does not count.
