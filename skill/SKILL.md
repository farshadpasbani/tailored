---
name: tailored
description: >
  Use to tailor a job-application pack (CV and cover note) for a candidate to a
  specific role or firm. Triggers whenever a user pastes or links a job
  description and asks to tailor a CV, make a CV for a role, write a cover note
  for a vacancy, or build a job-application pack. Drives the whole pipeline: read
  the job description, load the candidate's canonical facts and IP boundaries from
  their canon.yaml, grill to fill role-specific gaps, author house-style HTML,
  render to PDF, run the deterministic gates, verify by eye, and deliver.
---

# tailored

Tailor a CV and cover note from a candidate's structured facts to a specific role.
The model proposes the prose; the gates decide what ships. The candidate's facts
live in a `canon.yaml` that stays on their machine and is never committed.

## What this skill guarantees

A stochastic language model writes the prose, but ten gates stand
between that prose and the delivered document. Nine pass or fail with an exit
code; one is an honest human-in-the-loop check.

One thing no gate can guarantee: taste. Gates are a floor, not a ceiling; a
document written *to* the gates converges on the safest prose that satisfies
every constraint, identically, for every employer. Taste comes from the
authoring step, so read `references/exemplars.md` before writing a word and
follow the voice rules in step 5.

| Gate | What it checks | How |
| --- | --- | --- |
| schema | the canon is well formed | `tailored validate canon.yaml` (deterministic) |
| fit | externally anchored employer requirements map to fit-eligible direct/transferable canon evidence or gaps; blockers stay visible | `tailored fit --requirements requirements.yaml --jd-text job-description.md --canon canon.yaml --baseline-receipt baseline-receipt.yaml --allow-candidate-attested` (deterministic) |
| ai-tell | no em dashes, double-hyphen connectors, or HTML em-dash entities | `tailored lint *.html` (deterministic) |
| page-fit | the document fits its page budget | `tailored page-fit out.pdf --max 1` (deterministic) |
| ats | the rendered CV parses and carries archive-sourced literal employer vocabulary; aliases require explicit policy and neither proves experience or fit | `tailored requirements-ats out/cv.pdf --requirements requirements.yaml --jd-text job-description.md --canon canon.yaml --baseline-receipt baseline-receipt.yaml` (deterministic) |
| impact | the CV survives the recruiter's six-second skim (readability floor, summary length, no duplicated sentences, at most one rhetorical contrast, consistent person, dated entries, bounded bullets) | `tailored impact cv.html` (deterministic) |
| ip-guard | no protected-topic leaks, prohibited claims, or incompatible structured metrics | `tailored ip-guard out.html --canon canon.yaml --metric-claims metric-claims.yaml` (deterministic) |
| trace | every number, employer, institution, and project traces to the canon | `tailored trace cv.html --canon canon.yaml` (deterministic) |
| distinct | the document is not a template: no 8+ word run reused verbatim from any prior application, no 4+ word signature phrase recurring across two or more of them | `tailored distinct cover.html <prior covers...>` (deterministic) |
| visual | the document actually looks right | read the rasterised preview yourself (agent in the loop) |

Be honest about that last row. The visual judgement is not automated. A render can
pass page-fit and still look wrong: a widow, a cramped header, a section that
breaks badly. The agent or a human reads the preview PNG and signs it off. The
other eight gates are automatic and gate the pipeline; this one is a deliberate
checkpoint.

## Prerequisites

- The `tailored` CLI on the path (`npm i && npm run build`, then run via
  `node dist/cli.js ...` or install the package and use the `tailored` bin).
- Headless Chrome or Chromium for rendering. Set `CHROME_BIN` if it is not at a
  standard path.
- poppler for page counting and preview (`pdfinfo`, `pdftoppm`).

## The candidate's canon

The candidate keeps a `canon.yaml`: their single validated source of truth. It
holds identity, summary, skills, projects, experience, education, certifications,
publications, a `claims` block (what they can and cannot speak to), and a
`protectedTopics` list (terms that must never appear in any output, such as a
confidential project name). This file is private. Keep it gitignored. Nothing in
it leaves the user's machine.

Validate it before doing anything else:

```sh
tailored validate canon.yaml
```

See `examples/alex-rivers/canon.yaml` for the shape, populated with a fictional
candidate.

## The pipeline

1. **Intake the job description.** Read the role the user pasted or linked. Pull
   out the must-haves, the nice-to-haves, and the language the employer uses.
   Freeze them in `requirements.yaml` against the archived posting hash. Each
   record carries the exact source quote/location, hard or preferred class,
   span, bounded weight, eligibility impact, archive-sourced literal ATS terms, and
   direct/transferable canon fact IDs or an explicit gap. The canonical baseline
   gets a persisted digest and a separately stored trusted freeze receipt; the requirements file keeps only its digest. Later changes stay in `changes[]`
   and require a prior receipt binding the exact before/after transition. The model proposes
   the map; the user can correct it before freeze. Include EVERY tool and
   product-domain term the posting names. A synonym maps genuinely equivalent
   forms ("CI/CD" for "continuous integration"), never a different concept: a
   mapping like "langchain: framework-agnostic" converts a real fit gap into a
   silent pass, and a screener greps the literal string. The ats gate warns on
   any term covered only via synonym; every such warning goes to the candidate
   as add-or-waive; a stack-pillar term (the JD's named tools) at zero literal
   hits needs a written waiver reason in the pack, not a silent pass on a
   nice-to-have. A keyword the CV is missing is either
   real canon evidence to surface in the document or a genuine fit gap to raise
   with the candidate, never a licence to fabricate a skill. See
   `examples/alex-rivers/requirements.yaml` for the shape. Legacy `jd.yaml`
   remains available through `legacy-fit` and `ats`, but cannot claim verified fit.

   Also save the full posting text verbatim to `job-description.md` and render it
   to an archival PDF, so the delivered folder is self-contained (you can always
   see what was applied to). The CLI cannot fetch a login-walled link itself, so
   capture the text yourself, then render:

   ```sh
   tailored jd-pdf job-description.md out/job-description.pdf \
     --title "Role title" --company "Company" --location "City, UK" \
     --source "https://..." --date 2026-06-27
   ```

2. **Load the canon.** Run `tailored validate canon.yaml`. Read the candidate's
   facts, their `claims`, and their `protectedTopics`. Everything you write must
   trace to a fact in the canon. Do not invent employers, dates, metrics, or
   results.

3. **Triage fit before writing anything.** Run the frozen requirement-evidence gate. The odds per application matter less than the odds per hour, so
   this gate spends nothing on a role the canon plainly cannot cover:

   ```sh
   tailored fit --requirements requirements.yaml --jd-text job-description.md --canon canon.yaml --baseline-receipt baseline-receipt.yaml --allow-candidate-attested
   ```

   This verified lane requires all four reviewed inputs: strict v2 canon,
   archived JD text, frozen requirements, and a baseline receipt. Never create
   or impersonate a receipt merely to proceed. For an existing legacy pack,
   use the explicit compatibility lane instead:

   ```sh
   tailored legacy-fit --jd jd.yaml --canon canon.yaml
   ```

   On **BLOCKED**, stop and surface every hard blocker even when the weighted
   score is high. On **WEAK** or **MIXED**, surface the material gaps and
   transferable evidence before authoring. On **STRONG**, continue while still
   reporting eligibility uncertainty. Literal ATS wording never upgrades fit.
   Candidate-attested evidence is an explicit policy choice. Facts that are
   disputed, unverified, below confidence policy, confidential, missing `fit`
   from `allowedUses`, or from a disallowed provenance type earn zero weight.
   Compatibility verdicts are **SKIP**, **APPLY-WITH-GAPS**, or **APPLY**; label
   them `legacy compatibility`, never `verified fit`.

4. **Grill the gaps.** Where the role needs something the canon does not yet
   state, ask the user rather than guessing. Fill the gap in the canon, do not
   fabricate it in the document.

5. **Author the documents.** Write `cv.html` and `cover.html` in the house style
   (see `references/house-style.md`), with `references/exemplars.md` open beside
   it. Match the role's language to the candidate's real evidence. British
   spelling. No AI tells. CV to one page.

   Voice rules for this step, in priority order:

   - **The artifact is not a chat reply.** Any global response-style
     preferences the user has set for conversation (CLAUDE.md, user rules:
     analogies, rhetorical contrasts, humour) govern how you talk *to the
     user*, never how the CV or cover note reads. The moment your favourite
     conversational construction appears in a deliverable, it will appear in
     every deliverable, and fifteen recruiters will each read your one weird
     trick. Author from the exemplars and the canon, not from your own groove.
   - **One argument per cover note.** Pick the single strongest bridge between
     this role and the canon and spend the whole letter on it. A letter that
     tours three projects belongs to everyone and persuades no one.
   - **Start from what you would NOT say to this company.** Before writing,
     name the opening move and flagship framing your previous application
     used, and choose differently. The distinct gate will catch verbatim
     reuse; sameness of structure it can only catch you caring about.
   - **Pre-empt the obvious doubt.** Name the candidate's most attackable
     risk for this role (a career pivot, a seniority stretch, a stack gap) once
     in the cover, welded to a receipt. A doubt the reader discovers unaided
     reads worse than one the letter owns.
   - **Evidence must match the title's altitude.** For a senior or lead role,
     the strongest item in the pack must be employer-shipped, customer-facing,
     or carry operating numbers. Call a personal project "production" only with
     load evidence (runs, users, uptime, catches); otherwise say what it is.
   - **Engage the product, not just the posting.** The cover must use at least
     one noun from the company's product domain that is not in the JD's stack
     list; a letter that never touches what the company sells was written to
     the posting, and reads like it.
   - **One page by omission, not compression.** Select fewer skills rows,
     fewer bullets, fewer projects. The impact gate holds the floor
     (font-size, margins, line-height, skills-row density); if the page does
     not fit, cut content rather than whitespace.

6. **Run the gates.**

   ```sh
   tailored render cv.html out/cv.pdf
   tailored render cover.html out/cover.pdf
   tailored lint cv.html cover.html
   tailored page-fit out/cv.pdf --max 1
   tailored page-fit out/cover.pdf --max 1
   # Choose exactly one ATS lane matching the fit lane used above:
   tailored requirements-ats out/cv.pdf --requirements requirements.yaml \
     --jd-text job-description.md --canon canon.yaml \
     --baseline-receipt baseline-receipt.yaml
   # OR legacy compatibility:
   tailored ats out/cv.pdf --jd jd.yaml
   tailored impact cv.html
   tailored impact cover.html
   tailored ip-guard cv.html --canon canon.yaml --metric-claims cv-metric-claims.yaml
   tailored ip-guard cover.html --canon canon.yaml --metric-claims cover-metric-claims.yaml
   tailored trace cv.html --canon canon.yaml
   tailored trace cover.html --canon canon.yaml --jd-text job-description.md
   tailored distinct cover.html ../*/cover.html --canon canon.yaml
   tailored distinct cv.html ../*/cv.html --max-shared 2 --canon canon.yaml \
     --ignore-section education --ignore-section certifications
   ```

   `distinct` is the anti-template gate: it compares the new document against
   every prior application's counterpart (adjust the glob to wherever prior
   application folders live; the document under test is skipped
   automatically). It scans prose only (paragraphs and bullets), because
   house-style structure (headings, title lines, links, meta) is identical
   across documents by design. `--canon` exempts a recurring phrase found
   verbatim in the canon: a fact may recur across applications; a voice tic
   may not. A cover note must be fully fresh (`--max-shared 0`). A flagged
   phrase has exactly two honest exits: quote the canon's wording of the fact,
   or write a fresh one for this role. Copying a PRIOR APPLICATION'S
   rewording of it is the template residue this gate exists to catch. Never
   raise the ceiling to pass.

   `trace` makes "everything must trace to the canon" mechanical instead of a
   prompt-only hope: it fails on a fabricated number, an employer or institution
   or project name not in the canon, or a padded or shifted date range. A claim
   that describes the employer rather than the candidate (a cover note quoting
   the JD) traces against `--jd-text` instead. A failure is either a genuine
   canon gap (go add the fact) or an invented claim (cut it); it is never a
   licence to loosen the gate.

   ATS checks vocabulary coverage; they do not prove capability or repair a fit
   gap. Metric-claim files are artefact-specific so approval of a number in one
   document cannot silently authorise it in another.

   Any non-zero exit stops the pipeline. Fix the document and re-run. Do not edit
   the gate to pass; the gate is the spec.

7. **Verify by eye.** Rasterise and look:

   ```sh
   pdftoppm -png -r 150 -f 1 -l 1 out/cv.pdf out/cv-preview
   ```

   Read the preview. Check the header, the spacing, the line breaks, and whether
   the tailoring actually lands. This is the human-in-the-loop gate.

8. **Deliver.** Hand over the PDFs, the CV and cover note alongside the archived
   `job-description.pdf`, all in the same folder. The rendered output and the
   canon stay on the user's machine.

## Privacy

The candidate's data never leaves their machine. The canon is gitignored. The
gates run locally. The only thing this project ships publicly is the fictional
Alex Rivers example, which exists so the pipeline can be demonstrated without a
real person's facts.
