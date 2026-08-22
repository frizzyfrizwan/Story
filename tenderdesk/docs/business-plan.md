# TenderDesk — Business Plan

*One founder, $10K CAD, Claude doing ~99% of the production work. Drafted August 20, 2026.*

## The business in one paragraph

TenderDesk is a done-for-you bid desk for small Canadian contractors and suppliers
(roughly $500K–$10M revenue: janitorial, snow removal, HVAC, construction trades, security,
IT services, light manufacturing). Clients get matched government tenders they can actually
win, a blunt bid/no-bid verdict on each, and — for tenders worth chasing — a complete,
compliance-first bid response delivered in days at a tenth of what a human consultant
charges. The engine (in `engine/`) does matching, qualification, and drafting; the founder
does sales, quality review, and the client relationship. Start as a productized service to
generate cash and case studies; the same engine becomes the SaaS later.

## Why now (the 90-day sales pitch, verbatim)

> "Since July 2026 the federal government must design every purchase between $10K and $5M
> around small businesses like yours, and Buy Canadian rules now favour you over foreign
> bidders. There has never been a better time to bid — and you don't have to write a word.
> Send me a tender; if I say bid, you get a submission-ready package in five days for
> $1,500. First compliance review is free."

## Offer & pricing

| Offer | Price | What they get | Fulfilment cost |
|---|---|---|---|
| Tender Watch | $149/mo | Weekly matched-tender digest + bid/no-bid verdicts on up to 10 tenders/mo | ~$1 API + minutes of review |
| Bid Package | $1,500 flat (launch price; $2,500 later) | Full response draft: compliance matrix, technical narrative, cover letter, past-performance mapping, submission checklist — 5-day turnaround | <$1 API + 2–4 hrs founder QA |
| Bid Desk Retainer | $750/mo + $950/bid | Watch + up to 2 packages/mo + prequal upkeep (COR/ISNetworld/Avetta renewals, clearance tracker) | ~4–6 hrs/mo |
| Prequal Setup (bundle wedge) | $1,900 one-time | Get bid-ready: supplier registrations (CanadaBuys/SAP Ariba, provincial portals), safety-program documentation, insurance/WSIB package assembly | AI-drafted docs + 3–5 hrs |

Anchor against the alternatives the buyer already knows: consultants at $2,450–2,900/bid,
30–60 hours of their own time, or not bidding at all on a six-figure contract.

**Unit economics:** a Bid Package bills $1,500 against roughly $1 of Claude API cost
(qualification ≈ 6K input + 2K output tokens ≈ $0.08; a full drafted package ≈ 30K input +
20K output on `claude-opus-5` at $5/$25 per MTok ≈ $0.65) plus 2–4 founder hours of review —
a ~97% gross margin on the AI work, effectively $375–750/hr for the founder's QA time.
Ten retainer clients ≈ $90K/yr base + per-bid fees ≈ **$150–250K/yr solo run-rate**.

## The $10K budget

| Item | CAD |
|---|---|
| Ontario/federal incorporation + basic legal (service agreement template, E&O insurance quote) | $1,200 |
| Domain (tenderdesk.ca — verify at registration; fallback biddraft.ca), Google Workspace, hosting (Cloudflare Pages is free) | $400 |
| Claude API credits (covers ~1,000 full bid packages — effectively unlimited at MVP scale) | $700 |
| E&O / professional liability insurance, year one | $1,500 |
| Marketing: 90 days of targeted outreach — trade-association memberships (1–2 local construction/contractor associations), LinkedIn Sales Navigator, 500 direct-mail letters to past unsuccessful bidders* | $2,700 |
| Case-study buffer: do 3 launch bids at $500 to land logos + testimonials fast | (revenue forgone, $0 cash) |
| Accounting/bookkeeping setup + GST/HST registration | $500 |
| Contingency | $3,000 |
| **Total** | **$10,000** |

*Highest-leverage list: federal contract award notices are public data — every company that
*lost* a bid recently is a proven bidder with a budget and a bruise. The engine's award-notice
feed can generate this outreach list automatically.

## Go-to-market: first 90 days

1. **Days 1–14 — Legitimacy.** Incorporate, insurance, tenderdesk.ca live (site in `site/`),
   register the business itself as a supplier on CanadaBuys (dogfooding = screenshots + you
   can bid on the government's own bid-writing/admin tenders).
2. **Days 7–30 — Pick one vertical, one region.** Facilities/trades contractors in
   Ontario (the example profile in the engine). Run `tenderdesk scan --live` daily; when a
   strong match appears, cold-email the 10–20 local firms that plausibly fit it: *"This
   $800K janitorial tender at CFB Kingston closes Oct 15 and looks like your company. Want my
   free compliance review?"* Tender-specific outreach converts because it's urgent, specific,
   and free to start.
3. **Days 30–60 — Three $500 launch bids.** Deliver fast, collect testimonials and (win or
   lose) referrals to the firms' subcontractor networks. Join the local construction
   association; offer a free "How to win government work under the new small-business rules"
   lunch talk — the 2026 policy changes make this topical.
4. **Days 60–90 — Convert to retainers.** Every package client gets offered the $750/mo Bid
   Desk. Target: 4 retainers + 4 one-off packages by day 90 ≈ $9K MRR-equivalent. Reinvest in
   the second vertical (IT services under ProServices/TBIPS) and Québec (SEAO feed + bilingual
   packages — a real moat, since US tools can't do it).

## Scaling path (when "add more money" applies)

- **$25K stage:** part-time VA for intake/formatting; add SEAO + Ontario + Alberta feeds
  (code stubs already planned in the engine); productize the weekly digest into
  self-serve $149/mo SaaS with Stripe.
- **$50–100K stage:** web app on the same engine (profiles → matches → packages), 2–3
  contract bid reviewers (retired procurement officers are ideal and available), defense
  subcontracting vertical — primes' RFQ flow cascades from the $180B/10yr defence ramp and
  the ITB policy, and the same drafting engine answers primes' RFQs.
- **Exit optionality:** the discovery-feed startups (Publicus, MapleTenders et al.) need
  exactly this fulfillment layer; a services book with software margins and win-rate data is
  an acquisition target.

## Guardrails (what keeps this defensible and safe)

- **No fabrication, ever.** The engine hard-codes it: anything not in the client profile
  becomes a `[FILL: ...]` placeholder. The founder closes every placeholder with the client
  before submission. One fabricated reference in a federal bid ends the business.
- **Human signs every deliverable.** TenderDesk sells *working documents*; the client
  remains the bidder of record. The service agreement states this.
- **No success-fee pricing on federal bids** (contingency-fee arrangements are restricted
  in federal procurement — bill for deliverables, not outcomes).
- **Track the win rate honestly.** The whole moat at year one is a truthful case-study
  number no discovery-feed competitor can show.

## KPIs

Week 1 forward: outreach emails sent, free reviews delivered, review→package conversion,
packages delivered on time, placeholder-closure rate (quality), client win rate, MRR.
Kill/pivot criterion: if 60 tender-specific outreach emails across 2 verticals produce zero
paid packages by day 60, the wedge is wrong — pivot the same engine to the prequal bundle
(Framework AI has validated demand there and has ~10 customers).
