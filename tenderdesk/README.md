# TenderDesk

**The AI bid desk for small Canadian suppliers.** Government buyers in Canada spend
~$200B/year and — since July 2026 — must design every federal purchase between $10K and $5M
around small businesses. Most small firms still can't afford the 30–60 hours a compliant bid
takes. TenderDesk closes that gap: match the right tenders, call bid/no-bid honestly, and
deliver a submission-ready response package in days, not weeks.

Built to be run by one founder with Claude doing ~99% of the production work.

## What's in this repo

| Path | What it is |
|---|---|
| [`docs/market-scan.md`](docs/market-scan.md) | The evidence: Canada 2026–2031 outlook, the procurement gap, seven niches scored, why this one wins |
| [`docs/business-plan.md`](docs/business-plan.md) | Offer & pricing, unit economics, the $10K budget, 90-day go-to-market, scaling path, guardrails |
| [`engine/`](engine/) | Working MVP: Python CLI that ingests the live CanadaBuys open-data feed, ranks tenders against a client profile, gets a structured bid/no-bid verdict from Claude, and drafts the full bid package |
| [`site/`](site/) | Landing page (static, deploy free on Cloudflare Pages/Netlify) |

## Quick start

```bash
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python3 -m pytest tests/ -q                      # offline test suite

# Free, offline demo against bundled sample data
tenderdesk scan --csv data/sample_tenders.csv --profile profiles/example_contractor.toml

# The real thing: today's open federal tenders
tenderdesk scan --live --profile profiles/example_contractor.toml

# With ANTHROPIC_API_KEY set: verdict + full bid package
tenderdesk qualify --csv data/sample_tenders.csv --profile profiles/example_contractor.toml --ref TD-2026-004
tenderdesk draft   --csv data/sample_tenders.csv --profile profiles/example_contractor.toml --ref TD-2026-004
```

## Status

- [x] Market research (3 parallel deep-dives, sources in docs)
- [x] Engine MVP: ingest → match → qualify → draft, 16 offline tests passing
- [x] Landing page
- [ ] Register tenderdesk.ca (verify availability), incorporate, insurance
- [ ] First live scan + 20 tender-specific outreach emails
- [ ] SEAO (Québec) + Alberta + Toronto feeds
- [ ] Web app on top of the engine
