# Kestrel — the award travel engine

Kestrel finds award seats and hotel nights across 40+ loyalty programs, works out which bank points
to transfer (with this week's bonuses), scores every redemption in cents per point, watches routes
for you, maps live aircraft, and ships with an AI concierge that can run all of it from a sentence.

It is a full product, not a demo scaffold: production auth, billing hooks, alert cron, a community
feed, a procedural design system, and honest data provenance on every number.

## Screens

| Route | What it does |
| --- | --- |
| `/` | Landing: split-flap deal board, procedural globe, feature tour, community preview |
| `/search` | Award search across programs with wallet-aware "you can book this" plans, filters, ±day calendar strip, alerts, AI explanations |
| `/explore` | Curated deals with postcard art, 90-day availability calendars, "where can my points go" map |
| `/hotels` | Hotel award search: points vs cash per night, 5th-night-free math, compare tray, nightly breakdown |
| `/live` | Live aircraft map (OpenSky or simulator), flight status lookup, split-flap arrivals board |
| `/wallet` | Balances, CSV import, transfer reach, "bookable right now", card optimizer |
| `/transfers` | The full bank → program transfer matrix with ratios, posting times and live bonuses |
| `/programs/[id]` | 49 program guides: sweet spots, partners, bookable carriers, sample pricing |
| `/alerts` | Availability alerts with in-app + email delivery and "check now" |
| `/finds` | Community redemptions feed with likes, comments, tags and profiles |
| `/concierge` | Streaming Claude concierge with live tools (search, availability, programs, transfers, hotels, deals, wallet) |
| `/pricing`, `/settings`, `/trips`, `/login` | Plans, profile/integrations/billing, saved trips, sign-in |

## Quick start

```bash
cd kestrel
pnpm install
cp .env.example .env     # optional — everything runs with zero keys in demo mode
pnpm dev                 # http://localhost:3000
```

Demo mode is on whenever no auth provider is configured: a one-click demo sign-in, seeded community
content, and a deterministic award simulator stand in for live data. Every result carries a
`live | cached | simulated` tag and the UI shows a DEMO DATA badge whenever simulated data is on
screen.

## Going live

Add keys one at a time; each integration lights up independently (see `.env.example`).

| Capability | Provider | Env |
| --- | --- | --- |
| Award availability | seats.aero Partner API | `SEATS_AERO_API_KEY` |
| Live aircraft | OpenSky Network (anonymous works) | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` |
| Flight status | AviationStack or AeroDataBox | `AVIATIONSTACK_KEY` / `AERODATABOX_KEY` |
| Hotels + cash fares | Amadeus Self-Service | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` |
| Cash fares (alt) | Duffel | `DUFFEL_API_KEY` |
| FX | exchangerate-api | `EXCHANGERATE_API_KEY` |
| AI concierge | Anthropic | `ANTHROPIC_API_KEY` |
| Sign-in | Google, Resend magic link | `AUTH_GOOGLE_ID/SECRET`, `AUTH_RESEND_KEY`, `AUTH_SECRET` |
| Billing | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_*` |
| Database | libSQL (local file) or Turso | `DATABASE_URL`, `DATABASE_AUTH_TOKEN` |
| Alert cron | Vercel Cron (`vercel.json`) or any scheduler | `CRON_SECRET` |

Deploy to Vercel (zero config, cron included) or anywhere with the `Dockerfile`.

## Commands

```bash
pnpm check        # typecheck + lint + unit tests
pnpm test         # vitest (engines, data integrity, providers, AI parsing)
pnpm build && pnpm start
pnpm test:e2e     # Playwright smoke across every route (PW_CHROME=/path/to/chrome for a local binary)
pnpm db:generate  # after editing src/db/schema.ts
pnpm db:seed      # demo content (--force to re-seed)
```

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the stack, directory map, design language,
provider contracts and conventions.

- **Engines are pure and tested**: award charts for 36 programs, a cash-fare model, a cents-per-point
  scorer, a hotel engine with category/dynamic/fixed pricing and holiday calendars, and wallet
  affordability math (transfer ratios, bonuses, minimums).
- **Providers are swappable**: every live integration implements one interface; the registry runs
  live providers first and falls back to the simulator, recording timing and provenance.
- **Data is curated**: 455 airports, 75 airlines, 1,860 real city-pair routes, 49 programs, 102
  transfer links, 31 cards, 218 hotels across 58 cities.
- **Design is its own**: Fraunces + Geist, token-only colours, split-flap boards, boarding-pass
  cards, procedural globe/map/postcards/logos. No external images anywhere.

Award data is informational. Confirm with the program before transferring points.
