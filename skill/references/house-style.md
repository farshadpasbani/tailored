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
.skill .k { flex: 0 0 150px; font-weight: 700; color: #16212b; }
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

## Cover note

Same header (name, role, contact). Then an `h1` with the role title, a short
opening, three or four paragraphs each opening with a bold lead-in phrase, and a
sign-off. Keep it to one page.

## Page-fit and break discipline

One page is the target for a CV and a hard requirement for a cover note. When a
document spills onto a second page, tighten in this order before cutting content:

1. Trim verbose summary or bullet wording (shorter is usually better anyway).
2. Reduce `header` and `h2` margins by a point or two.
3. Nudge `line-height` down slightly (stay readable, around 1.28 to 1.32).

Wrap any block that must not split across a page in a container with
`break-inside: avoid` (the `.edu` rule already does this).

## Render and verify loop

Render with headless Chrome and verify with poppler. The `tailored` CLI wraps
both, so you never hand-write a Chrome invocation.

```sh
# render to PDF
tailored render cv.html out/cv.pdf

# deterministic gates: page count, AI tells, protected topics
tailored page-fit out/cv.pdf --max 1
tailored lint cv.html cover.html
tailored ip-guard cv.html --canon canon.yaml

# one-shot example check (renders the bundled example and gates it)
tailored smoke
```

To eyeball the result, rasterise page one and look at it:

```sh
pdftoppm -png -r 150 -f 1 -l 1 out/cv.pdf out/cv-preview
```

The page-fit, AI-tell, schema, and protected-topic checks are deterministic and
pass or fail with an exit code. The visual judgement of whether the document
looks right is the one step a machine should not sign off alone: read the
rasterised preview yourself.
