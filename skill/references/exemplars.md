# Exemplars: what good reads like

Read this before authoring. The gates catch wrongness; this file is the only
place the pipeline says what *good* is. All examples use the fictional Alex
Rivers (a data engineer who came from cartography). Imitate the moves, never
the sentences: every sentence here would fail the distinct gate if it
appeared in a real document, and that is the point.

## The one-argument cover note (imitate this shape)

> **Data Engineer, Fieldfare Logistics**
>
> Your posting says the routing engine re-plans 40,000 deliveries a night and
> that the team is drowning in schema drift from carrier feeds. I have spent
> two years on exactly that unglamorous seam. At Ordnance House I owned the
> ingest layer for 130 council map feeds, each with its own idea of what a
> road is, and the lesson that stuck was that the fix is never a cleverer
> parser. It is a contract the upstream can actually keep, enforced where the
> data lands.
>
> That is what I would bring to the carrier-feed problem first: not a new
> pipeline, but a boring, versioned schema registry with failure budgets per
> carrier, so drift shows up as a ticket instead of a 3am page.
>
> I keep a small habit that your on-call rota might appreciate: every incident
> I have caused has a public write-up in my repo. The worst one (I dropped a
> partition of Northumberland) is the first thing pinned.
>
> Alex Rivers

Why this works, move by move:

- **One argument.** The whole letter is "your schema-drift pain, my ingest
  scar tissue." The flagship project appears only as evidence for that
  argument, not as a tour stop. Nothing else from the canon was invited.
- **The opening is about them, in their words**, and it earns the pivot to
  the candidate within two sentences. It is not a maxim, a manifesto, or an
  observation about the industry.
- **Specifics carry the charm.** "130 council map feeds", "a partition of
  Northumberland". Concrete nouns do the work adjectives and rhetoric would
  otherwise fake.
- **One vulnerable beat** (the pinned incident write-up) instead of a closing
  boast. Warmth comes from plainness, not from exclamation.
- **No construction repeats.** One colon, one "not X but Y". Used once,
  these read as thought; twice, as a tic.

## The same letter, written by the failure mode (never this)

> The hard part of logistics data is never the pipeline; it is the schema
> drift nobody owns. Most teams learn this the expensive way. I learned it
> building ingest for 130 map feeds, where a wrong road is the costly one.
> My flagship, RouteForge, validates every feed; my registry, DriftGuard,
> catches what slips; both are open source and live at my site. Whether a
> cartographer can ship production data engineering is a fair question. Have
> a look.

Same facts, no taste. The tells: it opens with a portable maxim that could
front any letter to any company; "never X; it is Y" and "the costly one" are
voice-as-template constructions; it tours three artefacts instead of arguing
one point; the company has vanished by sentence two; and the closing is a
rhetorical move it has clearly made before. Every sentence survives the
mechanical gates. That is why this file exists.

## CV summary: landing point, not thesis

Good (34 words):

> Data engineer specialising in high-volume geographic ingest. Built and ran
> the pipeline serving 130 council map feeds at Ordnance House; now applies
> the same contract-first discipline to carrier data. Python, dbt, Postgres.

Bad (same length): "Data engineer who believes the hard part is never the
model but the contract...", a summary that argues a worldview instead of
stating what the person is, does, and has shipped. Save the worldview for the
cover note's one argument, if it earns its place there.

## Skills row: selection as signal

Good: `Data platforms: Python, dbt, Postgres, Airflow, schema registries
(Confluent), data contracts`

Bad: `Data platforms: Python (pandas, polars), dbt, Postgres, MySQL,
Airflow, Dagster, Prefect, Kafka, schema registries, data contracts, data
quality, observability, lineage, governance, CDC, ELT/ETL`

The bad row is what the ats gate would love and a human skims past. Listing
only what this role needs *is* the signal: it says the candidate read the
posting and knows which of their tools this job is about. Coverage for a
stray keyword belongs in the project bullet where it actually happened.

## Bullets: result first, philosophy at most once

Good: "Cut carrier-feed incidents from 14 to 2 a month by moving validation
to ingest, with per-carrier failure budgets."

Acceptable once per CV: appending "...because drift caught at landing costs a
ticket, not a page" to the single bullet where the reasoning is the
achievement.

Bad: every bullet carrying its own "because ..." worldview clause. One
editorial aside is a person; five are a manifesto wearing a CV.
