# Dossier

**Everything about a home before you sign for it.**

Type in what a listing shows. Dossier adds the public-record layers, grades the home on seven dimensions, models what it costs to own for ten years, and lists what will come up before closing, in years 1 to 3, years 3 to 10, and years 10 to 30, each with the document or inspection that settles it.

It was built around a real question: a 1963 two-bedroom condo on Pompano Beach's barrier island, asking $299,900 with a $175 HOA fee. The researched dossier for that unit ships as the sample (`data/samples/3204-colony-club-rd-6.json`) and as a written report (`reports/3204-colony-club-rd-apt-6.md`).

## What a report contains

| Section | What it answers |
|---|---|
| Verdict and grades | Price, cost to own, building, association, hazards, location, resale and financing. A to F with the reason. |
| What will come up, and when | 30-odd items on four horizons, severity-coded, each with *why* and *do*. Unknown facts become questions, not guesses. |
| Cost to own | Monthly stack at your down payment and rate (adjustable), homestead vs non-homestead taxes, a 10-year projection with a special-assessment scenario, rental yield and cash flow. |
| Building and association | Every fact that matters, with the unknowns highlighted. |
| Location, hazards, neighborhood | Evacuation zone, FEMA zone, elevation, sea-level trend, walkability, schools, demographics, crime. |
| Market and comps | City and county condo stats, comparable sales on the street, nearby development. |
| History | Building and area timeline. |
| Checklist | The questions to ask before you waive contingencies, with who answers each. Ticks persist in the browser. |
| Sources | Every source used, plus which live layers answered. |

## Run it

```bash
cd Dossier
npm test                 # unit tests for the rules engine and cost model
npm start                # http://localhost:8787
node bin/dossier.js data/samples/3204-colony-club-rd-6.json          # text brief in the terminal
node bin/dossier.js data/samples/3204-colony-club-rd-6.json --json   # full report JSON
node bin/build-site.js   # writes site/index.html, a single self-contained file for any static host
```

No dependencies. Node 20 or newer.

### Live public layers

When the server is running, a new report calls these free services and merges what comes back:

- US Census Geocoder (coordinates)
- FEMA National Flood Hazard Layer (flood zone, base flood elevation)
- USGS Elevation Point Query Service (ground elevation)
- US Census ACS 5-year profile (median age, income, owner share, vacancy for the ZIP)
- OpenStreetMap Overpass (supermarkets, pharmacies, schools, beaches, parks, transit stops within a mile)
- NOAA sea-level trend stations (local table)

A layer that fails is reported as unavailable in the Sources section; the report still builds.

### Optional analyst narrative

Install `@anthropic-ai/sdk` and provide credentials (`ANTHROPIC_API_KEY`, or `ant auth login`). `POST /api/report` then adds four paragraphs written from the structured report by Claude Opus 5.5 with server-side refusal fallbacks enabled. Everything else is deterministic.

## Layout

```
Dossier/
├── server.js                 # static files + /api/enrich, /api/report, /api/sample
├── bin/dossier.js            # CLI
├── bin/build-site.js         # single-file build for GitHub Pages
├── src/
│   ├── report.js             # pipeline: facts -> report; live enrichment; listing-form -> facts
│   ├── narrative.js          # optional Claude narrative
│   ├── engine/rules.js       # watch items on a time horizon
│   ├── engine/costs.js       # mortgage, Florida taxes, insurance ranges, projection, rental math
│   ├── engine/score.js       # grades and verdict
│   ├── knowledge/florida.js  # millage, condo statutes, lending rules, sea level, lifecycles
│   ├── knowledge/checklist.js
│   └── adapters/public.js    # the free public layers
├── data/samples/             # researched facts files
├── reports/                  # written reports
├── web/                      # the app (plain HTML, CSS, ES modules)
└── test/
```

## Adding a market

`src/knowledge/florida.js` holds the Florida-specific rules and a millage table keyed by city. Another state needs its own knowledge file (tax mechanics, condo statutes, evacuation scheme) and a line in `report.js` to pick it by `property.state`. The rules engine reads only the facts shape, so it carries over as is.

## Honesty rules

- Planning figures (insurance, utilities, growth rates) are labeled as estimates in the UI and carry ranges in the knowledge file.
- An unknown fact never becomes a guess. It becomes a watch item that names what to ask for.
- Every researched sample lists its sources with dates.
