---
id: "018"
title: Split the renderer from the evidence inspector; test the inspection algorithms
status: done
depends_on: ["016"]
acceptance:
  - render/chrome.ts is split into two modules - a renderer whose interface is
    essentially render(html, pdf) with Chrome discovery, argument building and
    spawning as implementation, and an inspector whose interface is
    inspect(html) returning document evidence; each module states in one line
    what it owns
  - The inspector's returned evidence speaks the domain (text units, claim
    markers, source markers, generated content) and no longer obliges callers
    to understand Chrome's DOM vocabulary; CSS selector strings and
    pseudo-element names survive only as opaque debug locators, documented as
    such, and no caller branches on their shape
  - The algorithms inside the injected inspection source - relative luminance
    and contrast ratio, the overflow/clip visibility walk, painted-text
    geometry - are typed TypeScript functions unit-tested in Node WITHOUT a
    browser; the injected source is generated from them plus a thin DOM-walk
    shell, so the maths is no longer an untyped string
  - Every algorithm test states the case it pins in domain terms (a
    light-grey-on-white field is unreadable; a field clipped by nested
    overflow is invisible; a field at the page edge is still visible), and at
    least the contrast cases are checked against known WCAG ratio values
  - One transport - the CDP path is the only one; the --dump-dom/base64 route
    and the window.__TAILORED_CDP__ fork are deleted, and
    inspectAndPrintDocument (the function the authoritative verifier depends
    on, which had zero direct tests) gains direct coverage
  - The six test-only injection points on RenderOpts (fetchImpl,
    webSocketFactory, handshakeTimeoutMs, exists, platform, env) are no longer
    part of the public interface; whatever the timeout tests need is reached
    through the split modules' own seams
  - Behaviour is preserved where it counts - verify-pack over the fixture pack
    produces the same 18 findings with the same verdicts and messages; the
    ip-guard and claim-integrity CLI lanes produce identical output on the
    bundled example; the CLI oracle is otherwise unchanged
  - Cross-repo field test - the downstream vault's practice-vault battery
    (--text) and gate-test suite run GREEN against a packed install of THIS
    build in a scratch copy; the live downstream checkout is read-only
  - npm test green on the final tree with real Chrome; production.test.ts
    still passes unchanged
convergence:
  stop_when: Two modules exist with the stated interfaces, the inspection
    algorithms are typed and unit-tested without a browser, one transport
    remains, inspectAndPrintDocument has direct tests, and the fixture
    receipt plus the cross-repo battery are unchanged
  assurance: internal
  blockers: [acceptance-failure, trust-regression, downstream-breakage,
    chrome-unavailable]
  deferred:
    - docs generated from the registry (card 5)
    - the fat GateInput and the duplicated packResults call (card 1 review)
    - gate.ts re-deriving commander's option-name rule (card 1 review)
    - pack.ts's own tmp-then-rename, the fourth instance (card 3 review)
  max_review_waves: 2
  successor_policy: human-only
  integration: pr
files:
  - src/render/renderer.ts
  - src/render/inspector.ts
  - src/render/inspection/algorithms.ts
  - src/render/chrome.ts
  - src/gates/claimIntegrity.ts
  - src/cli.ts
  - src/index.ts
---

## Context

Architecture card 4 (2026-07-27 walk; decisions in CONTEXT.md
"Renderer / Inspector"). chrome.ts glues a small deep renderer to a ~430-line
evidence inspector: seven exported functions and six evidence types totalling
roughly forty-six fields, all of which a caller must understand, and 160 lines
of the file are an untyped String.raw JavaScript blob injected into the page.
That blob implements the real algorithms - sRGB relative luminance, contrast,
overflow and clip-path visibility walking, painted-text geometry - with no
unit tests, reachable only through two browser-gated end-to-end cases. The
function the authoritative verifier depends on, inspectAndPrintDocument, has
no direct test at all.

Non-obvious constraints: this is the deepest untested logic in the codebase
and it decides whether a claim is VISIBLE, which is what makes ip-guard and
claim-integrity meaningful - a wrong answer here silently passes a hidden
claim. So the acceptance asks for the algorithms as typed functions with named
domain cases, not merely a file split. Chrome is required for the full suite;
if no Chrome is available, stop and report blocked rather than certifying on
skipped tests. One adapter exists today, so the seam stays hypothetical - split
for depth and testability, not for a speculative second browser. This branch
stacks on 016 (PR #13); unit 017 runs in parallel and touches gates/trace.ts
and gates/numeric.ts only.
