# Tailored field-first backlog reset

Date: 2026-07-14
Status: current planning authority; no implementation authorised
Branch base: `main` at `e06de37216e118c915d8308e3fdc738553d3e225`

## Authority and purpose

This reset governs the disposition of unfinished work. It does not erase the original product
specification at `docs/superpowers/specs/2026-07-12-trustworthy-application-engine.md`, anchored at
`a1cd1827f19ff3e30681597b0760ae45218577dc`. That specification remains design history and a source
of future requirements; this document decides which of those requirements are necessary now.

The prior implementation PRD and detailed plans remain audit evidence only. They are not executable
instructions unless a later human-approved field-derived unit explicitly reactivates a requirement.

## Product outcome now

Generate honest, role-specific CV and cover packs from the canonical facts; run the existing
deterministic checks; render exact PDFs; and leave those PDFs for human visual and semantic review.
No agent approves, publishes, or submits an application.

## Current usable baseline

- 001–010 are complete on `main`: ATS, evidence trace, fit, impact, canon, requirement evidence,
  claim binding, and complete-pack verification.
- 011a is complete on `main`: status-aware corpus selection and receipt-bound editorial advisories.
- The private vault already imports Tailored through its public package entry.
- The established house style, PDF checks, and human review are adequate controls until a real pack
  shows otherwise.

## Necessity gate

Before any future work unit is made executable, answer:

1. What real failure was observed, on which exact pack, and by whom?
2. What is the cost of doing nothing?
3. Can existing behavior, configuration, documentation, deletion, or human review solve it?
4. Does the change unblock a real application or an identified external user?
5. Does it touch rendering, receipt, claim, approval, publication, or privacy boundaries?
6. What concrete event will prove the work is now worth doing?

No observed failure plus no blocked user means defer. Human review that already controls the risk
means document. A real failure with no adequate workaround permits the smallest responsible change.

## Backlog disposition

| Unit | Decision | Reason / trigger |
|---|---|---|
| 001–010 | Complete | Working foundation; do not reopen without field evidence. |
| 011 / 011a | Complete | Corpus and editorial outcome is live and reviewed. |
| 011b | Retire | Open CSSOM authority failed review and is unnecessary for current use. |
| 011c | Retire | Sealed-profile authority failed real behavior review; visual review already controls the risk. |
| 012 | Defer | Revisit only for a named external consumer plus non-builder feedback. |

## Branch evidence

- `codex/009-claim-evidence-public@8fbcf47`: retire; do not integrate reflexively.
- `codex/011-editorial-advisories@b113c80`: rejected evidence; do not integrate.
- `codex/011b-accessibility-authority@d83a0b5`: rejected evidence; do not integrate.
- `codex/011c-sealed-profile-accessibility@5425e2f`: rejected evidence; do not integrate.

## Next product load

Use the current engine to generate and compare a fresh real application pack. Record any defect
against the exact source and output bytes. Only that evidence may create a new implementation unit.
