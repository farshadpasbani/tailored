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

A stochastic language model writes the prose, but nine gates stand
between that prose and the delivered document. Eight pass or fail with an exit
code; one is an honest human-in-the-loop check.

| Gate | What it checks | How |
| --- | --- | --- |
| schema | the canon is well formed | `tailored validate canon.yaml` (deterministic) |
| fit | the canon covers the job's must-haves well enough to be worth writing anything | `tailored fit --jd jd.yaml --canon canon.yaml` (deterministic) |
| ai-tell | no em dashes, double-hyphen connectors, or HTML em-dash entities | `tailored lint *.html` (deterministic) |
| page-fit | the document fits its page budget | `tailored page-fit out.pdf --max 1` (deterministic) |
| ats | the CV parses for ATS and covers the job's must-have keywords | `tailored ats out/cv.pdf --jd jd.yaml` (deterministic) |
| impact | the CV survives the recruiter's six-second skim (readability floor, summary length, no duplicated sentences, at most one rhetorical contrast, consistent person, dated entries, bounded bullets) | `tailored impact cv.html` (deterministic) |
| ip-guard | no protected topic leaks into the output | `tailored ip-guard out.html --canon canon.yaml` (deterministic) |
| trace | every number, employer, institution, and project traces to the canon | `tailored trace cv.html --canon canon.yaml` (deterministic) |
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
   Write the keywords to an inspectable `jd.yaml` (`role`, `mustHave`,
   `niceToHave`, optional `synonyms`); the model proposes the set, the user can
   correct it, and the ats gate decides. A keyword the CV is missing is either
   real canon evidence to surface in the document or a genuine fit gap to raise
   with the candidate, never a licence to fabricate a skill. See
   `examples/alex-rivers/jd.yaml` for the shape.

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

3. **Triage fit before writing anything.** Run `tailored fit --jd jd.yaml --canon
   canon.yaml`. The odds per application matter less than the odds per hour, so
   this gate spends nothing on a role the canon plainly cannot cover:

   ```sh
   tailored fit --jd jd.yaml --canon canon.yaml
   ```

   On **SKIP**, stop and tell the user why, listing the uncovered must-haves.
   On **APPLY-WITH-GAPS**, surface each uncovered must-have as a grill question
   before authoring a word: either the canon genuinely lacks it (a real fit gap
   to raise with the candidate) or it is phrased differently (canon evidence to
   surface), never a licence to fabricate. On **APPLY**, continue.

4. **Grill the gaps.** Where the role needs something the canon does not yet
   state, ask the user rather than guessing. Fill the gap in the canon, do not
   fabricate it in the document.

5. **Author the documents.** Write `cv.html` and `cover.html` in the house style
   (see `references/house-style.md`). Match the role's language to the
   candidate's real evidence. British spelling. No AI tells. CV to one page.

6. **Run the gates.**

   ```sh
   tailored render cv.html out/cv.pdf
   tailored render cover.html out/cover.pdf
   tailored lint cv.html cover.html
   tailored page-fit out/cv.pdf --max 1
   tailored page-fit out/cover.pdf --max 1
   tailored ats out/cv.pdf --jd jd.yaml
   tailored impact cv.html
   tailored ip-guard cv.html --canon canon.yaml
   tailored ip-guard cover.html --canon canon.yaml
   tailored trace cv.html --canon canon.yaml
   tailored trace cover.html --canon canon.yaml --jd-text job-description.md
   ```

   `trace` makes "everything must trace to the canon" mechanical instead of a
   prompt-only hope: it fails on a fabricated number, an employer or institution
   or project name not in the canon, or a padded or shifted date range. A claim
   that describes the employer rather than the candidate (a cover note quoting
   the JD) traces against `--jd-text` instead. A failure is either a genuine
   canon gap (go add the fact) or an invented claim (cut it); it is never a
   licence to loosen the gate.

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
