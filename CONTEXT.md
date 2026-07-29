# Domain glossary

Vocabulary for tailored's architecture. Terms here are used exactly — in code,
docs, and reviews. Started 2026-07-27 during the gate-registry design walk.

## Gate

A check that inspects a pack artefact (HTML, PDF, or text) and returns a
**Finding**. Every gate satisfies one interface:

```ts
interface Gate {
  id: GateId
  severity: "blocking" | "advisory"
  run(input: GateInput): Promise<Finding>
  command: GateCommand | null
}
```

Bespoke result structs (verdict strings, multi-field analyses) are gate
implementation, not interface. A gate that wants to expose rich detail exports
a separate analysis function; the gate lane only speaks Finding.

`run` and `command.run` may reach different verdicts from the same document; the
receipt lane and the terminal lane are separate contracts, and neither is derived
from the other. What they share is the analysis function underneath.

## Finding

The one shape a gate verdict takes: `{ id, ok, messages[] }`. The CLI's exit
code, verify-pack's receipt entries, and smoke all derive from Findings — no
caller re-derives a verdict from gate internals.

## Receipt provenance

Every verify-pack receipt names the dependency set that produced it:
`production` (real Chrome + poppler) or `injected` (test adapters). Freshness
verification refuses non-production receipts. Decision 2026-07-27: this field
replaces the parallel test implementation (`pack.testing.ts`) as the guard
against test-minted authority — the seam is `ProductionDependencies` (render,
inspect, pdfText, pageCount; fs/hashing/staging always real).

## Renderer / Inspector

Two modules currently glued into `render/chrome.ts`. The **renderer** is
`render(html) → pdf` — Chrome discovery, args, spawn are implementation. The
**inspector** is `inspect(html) → DocumentEvidence` over CDP (single
transport; the DOM-dump path is retired). Decision 2026-07-27: DocumentEvidence
speaks the domain (text units, claim markers, source markers, generated
content); CSS selectors and pseudo-element names are opaque debug locators,
not contract. The injected inspection source is generated from typed,
Node-unit-tested algorithm functions plus a thin DOM-walk shell.

## Thresholds

The quality standards for a pack (font floor, margins, word caps, ATS ratio)
live in `policy/thresholds.ts` — one source; gates, smoke, CLI defaults, and
the policy schema import it. Docs' gate tables are generated from the registry
into marked regions; CI fails on drift.

## Gate registry

The single module that owns the gate set: which gates exist, their IDs,
severities, and ordering. `policy/verify.ts`'s ID enums derive from the
registry, not the other way round. Named gate-sets (e.g. the smoke set) are
declared here. Decision 2026-07-27: adding a gate = one gate file + one
registry entry; anything more is a regression.
