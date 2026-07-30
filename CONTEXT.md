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

Two public modules under `render/`, split out of `render/chrome.ts` in card 4.
The **renderer** is `render(html, pdf)` — Chrome discovery, args, spawn are
implementation. The **inspector** is `inspect(html) → DocumentEvidence` over CDP
(single transport; the DOM-dump path is retired), plus
`inspectAndPrint(html, pdf)` for the one case that must print the exact revision
it inspected.

Decision 2026-07-27: DocumentEvidence speaks the domain (text units, claim
markers, source markers, generated content); CSS selectors and pseudo-element
names are opaque debug locators, not contract. The injected inspection source is
generated from typed, Node-unit-tested algorithm functions plus a thin DOM-walk
shell.

`render/inspection/**` is the inspector's implementation and package-internal —
nothing outside `render/` imports it. `algorithms.ts` is the pure maths (sRGB
contrast, the clipping fold, painted geometry), `source.ts` owns the scripts
Chrome runs inside the page, `cdp.ts` owns the transport.

`render/chrome.ts` survives as the machine probe both public modules share:
where the binary is, and the flags every headless invocation uses. It is
deliberately not a compatibility shim — a renderer and an inspector both need to
know those two things, and neither owns them.

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

## Canon corpus

The one canon-to-text projection, `canon/corpus.ts`. Three gates flattened a canon
their own way until card 3; a fact was evidence to one and invisible to another.
The corpus is the union of what `fit` and `trace` read, and it is the only
flattening the gate layer has.

Decision 2026-07-29: `facts` and `numbersThatStand` stay OUT, permanently. They
carry approved figures, and admitting them would let a keyword sweep declare a
number grounded because the canon states it somewhere. Proving a figure is
`claim-integrity`'s job, against an evidence file that binds the claim to a
source. Rendered link URLs and per-entry locations stay out for the same reason: a
digit inside a URL is not evidence. The `distinct` gate adds those back for its own
**exemption** corpus, which is a separate concern — exemption only proves "this
recurrence is a fact, not a voice tic", so widening it can only silence a false
flag, where widening the evidence corpus would launder an unproven number.

## Atomic write

`fs/atomicWrite.ts` — the one durable-write primitive: bytes land in a sibling
temporary, then one filesystem operation publishes them, and the temporary is
removed whether the write returned or threw. A reader therefore sees the old file
or the whole new one, never a half-written one.

Decision 2026-07-29: the difference between a write that replaces and one that
refuses is the `exclusive` option, not a second implementation. Exclusive links
rather than renames, because rename replaces silently while link fails on an
existing target — that is what stops a re-issued trust anchor overwriting the
anchor already on disk.
