# House style for tailored CV and cover documents

This is the visual and editorial standard for documents the `tailored` skill
produces. It is generic: it carries no personal facts. The candidate's data lives
in their own `canon.yaml`. Author every document in this language, then run the
gates.

## The one rule that is not negotiable

No em dashes. No double-hyphen used as a sentence connector. No HTML em-dash
entity (the named character reference for an em dash). These are the strongest
"written by a machine" tells, and the product's whole promise is that a human
cannot tell. En dashes in numeric ranges (`2022–Present`) and hyphens in compound
words (`low-carbon`, `event-driven`) are fine. The `tailored lint` gate enforces
this; do not rely on your own eyes.

Use British spelling throughout (`behaviour`, `optimise`, `programme`).

## A4 skeleton

Every CV and cover note shares this CSS skeleton. Populate the content from the
canon; keep the tokens.

```css
@page { size: A4; margin: 10mm 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.32;
  color: #2c3640;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
a { color: #0e7490; text-decoration: none; }

/* header */
.name { font-size: 25pt; font-weight: 700; color: #16212b; line-height: 1.05; }
.role { font-size: 11.5pt; font-weight: 600; color: #0e7490; margin-top: 2px; }
.contact { font-size: 8.8pt; color: #5a6571; margin-top: 4px; }

/* sections */
h2 {
  font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px;
  color: #16212b; border-bottom: 1px solid #dde3e8;
  padding-bottom: 3px; margin: 13px 0 6px;
}

/* skills: fixed-width key, flexible value */
.skill { display: flex; }
.skill .k { flex: 0 0 150px; font-weight: 700; color: #16212b; padding-right: 8px; }
.skill .v { flex: 1; }

/* entries */
.entry { margin-bottom: 8px; }
.eh { display: flex; justify-content: space-between; align-items: baseline; }
.title { font-weight: 700; color: #16212b; }
.tag { font-style: italic; color: #5a6571; }
.meta { color: #5a6571; white-space: nowrap; }
.links { font-size: 8.6pt; }
.edu { break-inside: avoid; }
```

### Palette tokens

- Accent teal `#0e7490`, used for the role line and links.
- Ink `#16212b` for headings and names.
- Body `#2c3640`.
- Muted `#5a6571` for meta and taglines.
- Hairline `#dde3e8` for the section rule.

## Section order for a CV

Summary, then Technical Skills, then Selected Projects, then Experience, then
Education, then Publications and Certifications. Aim for one page. Use a colon to
separate a project title from its tagline, never a dash.

Every entry under Selected Projects and Experience must carry a year in its
header line (wrap the title and a `.meta` year in an `.eh` flex row, the same
shape Experience already uses). An undated entry gives neither a recruiter nor
a recency-computing ATS a way to tell 2019 work from last month's; the
`tailored impact` gate fails it.

## Recruiter-skim discipline

The `tailored impact` gate holds the authored HTML to the six-second skim, not
just the ATS parse. Write to these rules, do not just fix them after the gate
fails:

- **Summary**: 60 words or fewer. It is a landing point, not a second cover note.
- **No verbatim repeats**: never restate a project bullet's wording in the
  summary (or anywhere else). A sentence of 8 or more words must not appear
  twice in the document.
- **One rhetorical contrast per document**: an "X, not Y" construction (or
  `; not`, `, never` used the same way) reads as voice once and a template the
  second time. Use it at most once across the whole CV.
- **One grammatical person, no exceptions**: pick first person ("I own...") or
  third-person-implied bullets ("Owns...", "Led...") and hold it. Never mix
  "he/she/his/her" with "I/my" in the same document.
- **Bullets stay bounded**: 45 words or fewer, and never open with a weak
  passive lead-in ("Responsible for", "Involved in", "Worked on", "Helped to").
  Open with the verb and the result instead.
- **Skills rows are a selection, not a dump**: each `.skill .v` value stays
  within 18 words. The ats gate scans the whole document, so a keyword can
  earn its place in a project bullet instead; a row crammed with every
  adjacent term reads as ATS bait to the human whose six seconds you are
  spending. Choose the terms this role actually asks for.
- **Editorialise once**: a bullet may carry one "because ..." clause of
  philosophy across the whole CV. State results; let the reader infer the
  worldview.
- **Every project carries an outcome metric**: at least one number about what
  the work achieved or how it operates (catch rate, hours saved, recall,
  uptime). Input metrics (test counts, lines, record volumes) are weaker but
  beat a bare claim; and when the JD itself is metric-led (benchmark,
  golden-set, eval language), every project entry MUST carry a number of some
  kind. A candidate whose thesis is measurement, citing no measurements, is
  self-refuting.
- **A number must survive the reader's denominator instinct.** Headlining an
  eval score whose set is small (under roughly 50 cases) signals not knowing
  what a real golden set looks like; describe the design instead and give the
  figure in passing with its denominator. Likewise a freshness-revealing
  count ("N commits since <last month>") advertises recency; state operating
  facts without a start date that undercuts them. An eval-literate reader
  runs these checks instinctively, and a metric that fails them converts a
  strength claim into a depth doubt.
- **The header never outruns the body.** The role line must not assert a
  title or identity the Experience section contradicts; a recruiter is
  trained to catch exactly this, and LinkedIn settles it in thirty seconds.
  Claim the domain ("Agentic Systems, Evaluation & Delivery"); let the
  Experience entries carry the titles.
- **A sparse entry is worse than a covered gap.** An employment line with an
  anonymous employer and no content reads as padding or concealment and
  invites the question it was meant to close. Either name it with one line of
  substance, or fold it into a single "Earlier career" phrase.
- **Certifications only if they raise the ceiling.** Platform-course
  certificates and anything "(in progress)" on a senior CV signal
  junior-upskiller; keep only credentials with independent weight, or cut the
  section.
- **Cover the JD's stack languages with artifacts, not adjectives**: for each
  language the JD's stack line names, surface the strongest canon artifact IN
  that language. Omitting an existing Python project from a Python-shop CV is
  a selection error no keyword can repair.
- **No silent gaps**: any employment gap longer than 12 months gets a covering
  line (study, relocation, practice), and each education entry carries exactly
  one date. A recruiter's gap-detector fires on holes and on ambiguous dates.
- **Contact block carries a phone number** when the canon has one; some ATS
  forms require it and some recruiters still call. Omitting it is a deliberate
  waiver, not a default.

## Cover note

Same header (name, role, contact). Then an `h1` with the role title, a short
opening, three or four paragraphs, and a sign-off. Keep it to one page.

The prose standard lives in `exemplars.md` (read it before writing): one
argument per letter, an opening move chosen fresh for this company, and no
phrase you have used in a previous application. The `tailored distinct` gate
enforces the letter of that rule; the exemplars carry its spirit.

Four prose rules no gate enforces:

- **Never open mirror-and-claim** ("you want X, and that is exactly what I
  do"). It is the most common cover-letter opening in existence and reads as
  flattery, not evidence.
- **Voice is the residue of visible judgement**, not the volume of the claim.
  Show how the candidate thinks through one concrete decision; do not assert
  what they are.
- **Prefer a real number to an adjective** wherever the canon offers one, and
  give each role or project entry one signature specific, a fresh and memorable
  detail, never a flourish reused from another entry or application.
- **One flourish per letter.** A clever line earns its place once; a second
  performs. And a syntactic construction repeated across applications ("X,
  because whatever Ys must Z") is a fleet fingerprint even when no words
  repeat; vary the sentence shapes, not just the vocabulary.
- **Never refer to the letter's own production process.** "This letter
  passed through my pipeline" tells a recruiter drowning in generated mail
  exactly what they suspect of everyone. If the candidate consciously wants
  the meta-move for a company where it is on-theme, that is their bet to
  place, at most one clause, never the default.
- **One paragraph only this letter could contain.** Beyond the argument,
  include one concrete sentence anchored in the company's own world (a named
  product, customer, or scenario from research). A letter whose every
  sentence could be re-aimed at another employer by swapping the nouns reads
  as a skeleton wearing research.
- **Rotate the anchor receipts.** The distinct gate exempts canon facts, so a
  favourite canon phrase ("binding codes under professional indemnity") can
  legally appear in every letter, and that is still a mail-merge tell to two
  recruiters who compare notes. A canon receipt used in one cover gets fresh
  wording in the next; rotate which facts anchor which letters.
- **No comma-splice as dash surgery.** When a dash is excised, the joint gets
  a colon, a full stop, or a conjunction, never a bare comma. A document of
  uniformly comma-spliced appositives reads as a model with its em dashes
  filed off, which is exactly what it would be.

## Page-fit and break discipline

One page is the target for a CV and a hard requirement for a cover note. When a
document spills onto a second page, tighten in this order before cutting content:

1. Trim verbose summary or bullet wording (shorter is usually better anyway).
2. Reduce `header` and `h2` margins by a point or two.
3. Nudge `line-height` down slightly (stay readable, around 1.28 to 1.32).

Do not reach for a fourth step of shrinking the body `font-size` below 9pt,
the `@page` margin below 8mm, or the body `line-height` below 1.28. Page-fit
has to come from selecting less content, not from compressing what stays;
`tailored impact` enforces all three floors (font-size, margin, and
line-height, which must be declared unitless on `body`).

Wrap any block that must not split across a page in a container with
`break-inside: avoid` (the `.edu` rule already does this).

## Render and verify loop

Render with headless Chrome and verify with poppler. The `tailored` CLI wraps
both, so you never hand-write a Chrome invocation.

```sh
# render to PDF
tailored render cv.html out/cv.pdf

# deterministic gates: page count, AI tells, recruiter-skim discipline, protected topics
tailored page-fit out/cv.pdf --max 1
tailored lint cv.html cover.html
tailored impact cv.html
tailored ip-guard cv.html --canon canon.yaml --metric-claims metric-claims.yaml

# anti-template gate: compare against every prior application's counterpart
# (--canon exempts canon-verbatim facts; prose elements only are scanned)
tailored distinct cover.html ../*/cover.html --canon canon.yaml

# one-shot example check (renders the bundled example and gates it)
tailored smoke
```

To eyeball the result, rasterise page one and look at it:

```sh
pdftoppm -png -r 150 -f 1 -l 1 out/cv.pdf out/cv-preview
```

The page-fit, AI-tell, impact, schema, and protected-topic checks are
deterministic and pass or fail with an exit code. The visual judgement of
whether the document looks right is the one step a machine should not sign off
alone: read the rasterised preview yourself. While looking, check two things
gates miss: the gap between each skills-row label and its value (a collision
reads cheap), and a `pdftotext` round trip whose output order should match the
reading order (a flex layout can extract scrambled, which is what an ATS
ingests).
