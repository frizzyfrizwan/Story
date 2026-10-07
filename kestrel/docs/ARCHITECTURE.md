# Kestrel — architecture & contributor brief

Kestrel is an award-travel engine: live award seat search across loyalty programs, transfer-partner
intelligence, hotel awards, live flights, alerts, a community "Finds" feed and an AI concierge.

## Stack

| Layer      | Choice                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, React 19, TypeScript strict, Turbopack dev)     |
| Styling    | Tailwind v4 with design tokens in `src/app/globals.css` (no default UI) |
| Fonts      | Fraunces (display), Geist Sans (UI), Geist Mono (data) — all self-hosted|
| Motion     | `motion` (Framer Motion v12)                                            |
| Data       | Drizzle ORM + libSQL (`file:` locally, Turso in production)             |
| Auth       | Auth.js v5 — Google, Resend magic link, demo credentials (JWT sessions) |
| AI         | `@anthropic-ai/sdk` — `claude-opus-5-5` primary, `claude-sonnet-5-5` fast|
| Maps       | d3-geo + world-atlas (procedural globe, no tile server needed)          |
| Fetching   | TanStack Query on the client, route handlers + server actions on server |
| Tests      | Vitest (engines/data), Playwright (e2e smoke, Chromium)                 |

## Directory map

```
src/
  app/                 routes (App Router). Each feature owns its folder.
    api/               route handlers (JSON) — thin, validate with zod, call lib/
  components/
    ui/                design-system primitives (Button, Input, Panel, SplitFlap, Globe…)
    shell/             app chrome (header, mobile tab bar)
    brand/             logo & marks
    <feature>/         feature components (search/, explore/, hotels/, live/, wallet/, finds/, ai/)
  data/                curated reference data (programs, transfers, cards, airports, airlines, routes, hotels)
  lib/
    types.ts           domain types — the contract
    utils.ts           formatting, dates, hashing, seeded random
    api.ts             route-handler helpers, rate limiting
    awards/            award charts + pricing/scoring engine
    hotels/            hotel award engine
    providers/         live integrations + simulator + registry
    ai/                Anthropic client, intent parser, concierge tools
    wallet/            balances, transfer math, "what can I afford"
  db/                  drizzle schema + client (lazy, migrates on first use)
  env.ts               env contract + integrationStatus()
drizzle/               generated SQL migrations (do not hand-edit)
e2e/                   Playwright tests
scripts/               seed + maintenance scripts
```

## Design language — "flight deck at dusk"

- Dark by default; light "paper" theme via `data-theme="light"` on `<html>`.
- Tokens only: `bg`, `bg-elev-*`, `panel`, `fg`, `fg-muted`, `signal` (CTA orange), `aurora`
  (availability teal), `rose` (peak/warning), `violet` (AI), `gold` (first class), `sky` (info).
  Use Tailwind classes like `bg-bg-elev-2 text-fg-muted border-panel-border`.
- Signature pieces: split-flap departure boards, boarding-pass result cards with perforated edges,
  a slowly rotating procedural globe with glowing route arcs, availability heat calendars, grain
  overlays (`.grain`), aurora backdrops (`.aurora-bg`).
- Typography: `font-display` for headlines (Fraunces), `font-mono` / `.tnum` for every number.
- Motion: `animate-rise` on mount, `animate-flap` for board tiles, keep it under 600 ms.
- Accessibility: visible focus rings, 44 px touch targets on mobile, `aria-*` on interactive bits.

## Data & integrations

Every external source is a provider implementing `src/lib/providers/types.ts`. The registry
(`src/lib/providers/index.ts`) tries live providers first and falls back to the deterministic
simulator, tagging every result with `source: "live" | "cached" | "simulated"`. The UI shows a
DEMO DATA badge whenever simulated data is on screen.

| Capability         | Live provider                         | Env vars                                   |
| ------------------ | ------------------------------------- | ------------------------------------------ |
| Award availability | seats.aero Partner API                | `SEATS_AERO_API_KEY`                       |
| Live aircraft      | OpenSky Network                       | optional `OPENSKY_CLIENT_ID/SECRET`        |
| Flight status      | AviationStack or AeroDataBox          | `AVIATIONSTACK_KEY` / `AERODATABOX_KEY`    |
| Hotels & cash fares| Amadeus Self-Service                  | `AMADEUS_CLIENT_ID/SECRET`                 |
| Cash fares (alt)   | Duffel                                | `DUFFEL_API_KEY`                           |
| FX                 | exchangerate-api                      | `EXCHANGERATE_API_KEY`                     |
| AI                 | Anthropic                             | `ANTHROPIC_API_KEY`                        |
| Email              | Resend                                | `AUTH_RESEND_KEY`                          |
| Billing            | Stripe                                | `STRIPE_*`                                 |

## Conventions

- Server-only modules import `"server-only"`. Client components start with `"use client"`.
- Route handlers: `export const GET = handler(async (req) => { … return ok(data) })`.
- Never hardcode colours; never import images from the network (all artwork is procedural SVG/CSS).
- Numbers are always formatted via `fmtInt`, `fmtUsd`, `fmtCpp`, `fmtDuration`.
- Dates are `YYYY-MM-DD` strings in the domain; parse with `parseISODate` (local, no UTC drift).
- Every list/async view has a loading skeleton and an empty state.
- Tests live next to code as `*.test.ts`.

## Commands

```
pnpm dev          # http://localhost:3000
pnpm check        # typecheck + lint + unit tests
pnpm build && pnpm start
pnpm test:e2e     # Playwright against a production build
pnpm db:generate  # after editing src/db/schema.ts
pnpm db:seed      # demo content (finds, bonuses)
```

## Program ids (canonical — use these strings everywhere)

Bank currencies: `amex-mr`, `chase-ur`, `citi-ty`, `capital-one`, `bilt`, `wells-fargo`.

Airline programs: `aeroplan` (AC), `united-mileageplus` (UA), `ana-mileage-club` (NH), `singapore-krisflyer` (SQ),
`avianca-lifemiles` (AV), `turkish-miles-smiles` (TK), `eva-infinity` (BR), `thai-royal-orchid` (TG),
`asiana-club` (OZ), `lufthansa-miles-more` (LH), `american-aadvantage` (AA), `british-airways-club` (BA),
`qatar-privilege-club` (QR), `cathay-asia-miles` (CX), `jal-mileage-bank` (JL), `alaska-mileage-plan` (AS),
`qantas-frequent-flyer` (QF), `iberia-plus` (IB), `finnair-plus` (AY), `aer-lingus-aerclub` (EI),
`delta-skymiles` (DL), `flying-blue` (AF/KL), `virgin-atlantic-flying-club` (VS), `korean-air-skypass` (KE),
`aeromexico-rewards` (AM), `etihad-guest` (EY), `emirates-skywards` (EK), `jetblue-trueblue` (B6),
`southwest-rapid-rewards` (WN), `virgin-australia-velocity` (VA), `copa-connectmiles` (CM), `latam-pass` (LA),
`air-india-maharaja` (AI), `air-new-zealand-airpoints` (NZ), `sas-eurobonus` (SK), `tap-miles-go` (TP).

Hotel programs: `world-of-hyatt`, `marriott-bonvoy`, `hilton-honors`, `ihg-one-rewards`, `accor-all`,
`choice-privileges`, `wyndham-rewards`.

Metro codes: NYC (JFK, EWR, LGA), LON (LHR, LGW, LCY, STN), PAR (CDG, ORY), TYO (NRT, HND), CHI (ORD, MDW),
WAS (IAD, DCA, BWI), SFO-area is BAY? no — use SFO/OAK/SJC individually, MIL (MXP, LIN), ROM (FCO, CIA),
SEL (ICN, GMP), OSA (KIX, ITM), BUE (EZE, AEP), SAO (GRU, CGH), BKK (BKK, DMK), JKT (CGK), MOW (SVO, DME), STO (ARN).
