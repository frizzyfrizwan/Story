# TenderDesk Engine

The core pipeline: **ingest → match → qualify → draft**. This is what lets one
person run a bid desk that would otherwise take a team.

| Stage | What it does | Cost |
|---|---|---|
| `scan` | Pulls the CanadaBuys open-tender feed (or a local CSV) and ranks every open tender against a client profile with transparent, deterministic scoring | Free, no API key |
| `qualify` | Claude reads one tender + the client profile and returns a structured bid/no-bid verdict: fit score, mandatory requirements, red flags, effort estimate, buyer questions | ~1 cent |
| `draft` | Claude produces the full working bid package: compliance matrix, cover letter, technical response draft, past-performance mapping, pricing + submission checklists | under $1 |

## Setup

```bash
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export ANTHROPIC_API_KEY=sk-ant-...   # only needed for qualify/draft
```

## Usage

```bash
# Rank the bundled sample tenders against the example client — free, offline
tenderdesk scan --csv data/sample_tenders.csv --profile profiles/example_contractor.toml

# Rank today's real open federal tenders (downloads the live CanadaBuys CSV)
tenderdesk scan --live --profile profiles/example_contractor.toml

# Machine-readable output for piping into other tools
tenderdesk scan --live --profile profiles/example_contractor.toml --json

# Bid/no-bid verdict on one tender
tenderdesk qualify --csv data/sample_tenders.csv \
    --profile profiles/example_contractor.toml --ref TD-2026-004

# Full drafted bid package -> out/TD-2026-004.md
tenderdesk draft --csv data/sample_tenders.csv \
    --profile profiles/example_contractor.toml --ref TD-2026-004
```

## Client profiles

One TOML file per client (`profiles/*.toml`) holds everything the AI is allowed
to say about them: capabilities, certifications, past performance, regions,
keywords, and commodity-code prefixes. Qualification and drafting use **only**
facts from the profile — anything missing becomes a `[FILL: ...]` placeholder
in the draft, never an invented claim. That discipline is the product: an AI
hallucination in a government bid is a disqualification (or worse), so the
human reviews and closes every placeholder before submission.

## Data sources

- **Live feed**: [CanadaBuys open tender notices CSV](https://canadabuys.canada.ca/en/support/opendata),
  published daily under the Open Government Licence — no key, no scraping.
  A "new notices" variant refreshes every ~2 hours (see `tenderdesk/ingest.py`).
- **Sample data**: `data/sample_tenders.csv` mirrors the real feed's schema
  (UTF-8 BOM, bilingual column names) so everything runs offline.
- Next feeds on the roadmap: SEAO (Québec, OCDS JSON), Alberta Purchasing
  Connection (JSON API), City of Toronto (OData) — all free.

## Model

Defaults to `claude-opus-5`; override per call with `--model` or globally with
the `TENDERDESK_MODEL` environment variable.

## Tests

```bash
python3 -m pytest tests/ -q
```

Everything up to the API boundary is tested offline — CSV parsing (including
the feed's BOM), scoring, filters, and prompt grounding. No test makes a
network call.
