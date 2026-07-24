# Claim-integrity contract

The final gate reconciles four views of every claim: authored HTML markers,
Chrome-rendered markers, rendered text-unit ownership, and evidence records.
Their ID sets must match exactly. Missing, unknown, duplicated, hidden, or
multiply owned content blocks the artifact.

Claim authority has exactly two valid states: `candidate` subject with
`candidate` namespace, or `employer` subject with `employer` namespace. There
is no public/third authority state to construct accidentally. Employer evidence is restricted to
text that explicitly declares and visibly names the employer subject. Candidate
names, candidate/applicant references, passive candidate attribution, and bare
achievement fragments cannot borrow employer authority. The self-reference
classifier centrally covers subject, object, possessive and reflexive forms
(`I/me/my/mine/myself` and `we/us/our/ours/ourselves`), including contractions.

Bindings hash the complete claim and source payload, including subjects,
authority, exact text, artifact identity, and complete structured metrics.
Numeric surfaces must match their declared units: currency, duration, percent,
and count forms are not interchangeable. An absent metric dimension uses the
exact `not-applicable` literal.

Final verification reads and hashes authored HTML once, validates a strict
declarative parser allowlist, verifies the artifact's deterministic resource
manifest, and creates an immutable restrictive-CSP snapshot. Every local
stylesheet, recursive CSS import, font and image must be declared by relative
path and SHA-256 under one evidence-relative resource root. Remote, missing,
out-of-root, unused and mutated resources fail before rendering. Only those
declared bytes enter the snapshot.
Dynamic CSS substitution through `var()`, `env()`, or `attr()` is unsupported
in verified stylesheets and fails before snapshot creation. Chrome may resolve
those functions into resource URLs at runtime, which cannot be represented by
a closed static manifest.

Build that manifest through the supported package API before sealing the
evidence record:

```js
import { buildResourceManifest } from "tailored";

const manifest = buildResourceManifest(
  html,
  "/absolute/application/cv.html",
  "/absolute/application",
  ".",
);
// artifact = { ...artifact, resourceRoot: ".", ...manifest }
```

Paths are NFC-normalized and sorted by their UTF-8 bytes, so the same dependency
set produces the same manifest on every locale.

One Chrome DevTools page emulates print media before loading that snapshot,
waits for load and fonts, inspects ownership, and passes the same revision to
`Page.printToPDF`. The PDF text layer is supplemental. Print-only residue and
claims missing from print both block. Visibility
comes from every descendant text node's painted `Range` geometry, accumulated
clipping, effective opacity/transform/font, and foreground/background contrast;
an outer box alone is not evidence that its words can be read. Source-only
preflight is diagnostic and cannot produce the final verdict. Authored CV/cover
HTML is declarative: scripts, event attributes, executable URLs, active foreign
content, frames/srcdoc, embedded objects and refresh directives block before
Chrome. Visible CSS-generated text is rejected; authored
nonfactual text is limited to punctuation-only separator spans with the exact
`decorative-separator` reason.

Private replay is available through `npm run replay:private -- <vault>`. It
inventories every consumed evidence, canon, HTML and employer archive byte,
migrates/runs only temp copies, checks those copies for child-process mutation,
then re-manifests the entire original vault and fails on any delta. It prints
aggregate counts and a digest only. Private content and per-file results remain
outside the repository.
