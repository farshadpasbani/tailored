---
id: "010"
title: Verify and receipt a complete pack
status: done
depends_on: ["008", "009"]
acceptance:
  - tailored verify-pack stages and renders a complete declared pack, runs all blocking and advisory checks, and writes a versioned machine-readable receipt without publishing partial output
  - The receipt hashes canon, JD snapshot, requirements, evidence, strategy, research, preferences, HTML, exact PDFs, policy, engine revision, reviewer attestations, corpus descriptor, and every corpus member
  - Blocking failures exit non-zero and cannot produce ready-for-human state; advisory findings remain present with explicit dispositions rather than being reported as passes
  - Any bound input, output, policy, corpus, waiver, or attestation change makes the old receipt stale; interrupted/missing-Chrome/missing-Poppler paths leave no visible candidate
files:
  - src/findings/
  - src/policy/
  - src/verify/
  - src/gates/run.ts
  - src/render/chrome.ts
  - src/cli.ts
  - src/index.ts
---

## Context

Create the single authoritative command the vault can call. It is a transaction:
prepare in a temporary versioned location, produce the exact PDFs and receipt,
then expose the candidate only if all blocking checks succeeded. The receipt
states what was proved and what still requires judgement.

The real field run stages Vendor-A and Vendor-B and then deliberately mutates
each input class to prove freshness invalidation.

## Assumptions

- Advisory severity is policy-driven and the policy hash is an input.
- Receipts contain hashes and IDs, never private canon contents.

## Does not count

- A shell script that runs commands but cannot emit one complete receipt does
  not count.
- A manifest without PDF, policy, corpus, evidence, JD, canon and preference
  hashes does not count.
- Green unit tests without injected mid-render/interrupted-write failures and
  real-pack staging do not count.
