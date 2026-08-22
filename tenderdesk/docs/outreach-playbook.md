# Outreach Playbook

Everything you need to go from "I have a tool" to "someone said yes." Written
for cold outreach with no track record, no logos, and no budget — because
that's the actual starting position.

## The core move: tender-specific outreach

Do not send "hi, I do bid writing." Send **one specific open tender to a
company that could win it.** It's urgent (real deadline), specific (their
trade, their city), and free to respond to. That's the whole trick.

Workflow, ~15 minutes per prospect:

1. `tenderdesk scan --live --profile <trade>.toml` → pick a strong open tender
2. `tenderdesk prospects --awards <file> --profile <trade>.toml` → companies that
   have won this kind of work before (proven bidders)
3. Find the owner's email — company website, LinkedIn, or the "contact us" form
4. Send Email 1 below, naming that tender
5. Log it in a spreadsheet: company, tender, date sent, reply

Target: **20 sent before you evaluate anything.** Fewer than that and you're
reading noise.

---

## Email 1 — the opener

Subject lines (pick one, keep it plain — no marketing voice):

- `PSPC janitorial tender, closes Sept 9 — worth a look?`
- `Federal snow contract in your area closing next week`
- `Question about the West Memorial cleaning tender`

Body:

> Hi {First name},
>
> I came across a federal tender that looks like a fit for {Company}:
>
> **{Tender title}**
> Buyer: {Department} · Closes: {Date}
> {Link}
>
> I noticed {Company} has done federal work before ({specific past contract}),
> so this is probably on your radar already — but most contractors I talk to
> skip these because a compliant response takes 30–60 hours they don't have.
>
> That's what I do. I'm {Your name}, I run TenderDesk here in Ottawa — I write
> government bid responses for small contractors. Compliance matrix, technical
> response, the whole submission package.
>
> **I'll review this tender against your company for free** and tell you
> honestly whether it's worth bidding — including if the answer is no. Takes me
> a day, costs you nothing, no obligation.
>
> Want me to run it?
>
> {Your name}
> {Phone} · {Email}

**Why this works:** it leads with something useful to them, proves you did
homework (the past contract), names the real objection (30–60 hours), and asks
for something small and free.

**Why the free review is the offer, not a discount:** you have no track record.
Nobody pays a stranger $1,500 on a first email. The free review is how you show
the work quality *before* asking for money — and it costs you about a dollar of
API credit.

---

## Email 2 — follow-up (send 4 days later, same thread)

> Hi {First name},
>
> Following up on the {tender name} — it closes {date}, so the window's getting
> short.
>
> If it's not a fit, no problem at all. If you'd like the free review, just
> reply "yes" and I'll have it to you within 24 hours.
>
> {Your name}

Send exactly one follow-up. Two is persistence; three is a nuisance.

---

## Email 3 — the "no bid" honest close

Send this when your review says they *shouldn't* bid. Counter-intuitive, but
this is the email that builds trust fastest.

> Hi {First name},
>
> I ran the review on {tender}. **My honest read: don't bid.**
>
> {Reason — e.g. "The mandatory criteria require a Secret-level facility
> clearance, which takes 6–9 months to obtain. You'd be disqualified at
> screening no matter how good the response is."}
>
> Attached is the full breakdown so you can see the reasoning.
>
> Two things that *are* worth your time in the next 60 days:
> {Tender A} — {one line why}
> {Tender B} — {one line why}
>
> If you want me to prepare either one, my rate is $1,500 flat per package,
> five business days. Happy to answer questions either way.
>
> {Your name}

---

## Email 4 — converting the good review to a sale

> Hi {First name},
>
> Review's done — **this one's worth bidding.** Attached is the full breakdown:
> every mandatory requirement, where you're strong, and the two gaps we'd need
> to close.
>
> Fit score: {X}/100. Estimated effort if you did it in-house: {N} hours.
>
> If you want me to write the response, it's **$1,500 flat**, delivered in five
> business days — compliance matrix, technical response, cover letter, past
> performance, submission checklist. You review and sign; you're the bidder of
> record.
>
> Deadline is {date}, so I'd need to start by {date minus 7} to be comfortable.
>
> Want me to go ahead?
>
> {Your name}

---

## Handling the four objections you'll actually get

**"How much?"** — $1,500 flat per bid package. For context, bid consultants
charge $2,500–$3,000 and enterprise software starts at $20,000/year. If it wins
you a $400K contract, that's a 0.4% cost of acquisition.

**"Do you guarantee we'll win?"** — No, and be careful with anyone who does. I
guarantee a compliant, professional, on-time package, and an honest no-bid call
when a tender isn't winnable. Your win rate is the number I track and report.

**"Is this AI writing my bid?"** — I use AI the way an architect uses CAD — it
does the drafting fast, I do the judgment. Every fact comes from your company
profile, nothing is invented, and I review every requirement before it reaches
you. Nothing goes out that I haven't checked line by line.

**"We've never bid federally."** — Then start with the setup: supplier
registration, safety documentation, insurance package. $1,900 one-time and
you're bid-ready in about two weeks. After that each bid is just the package.

---

## The seasonal hook (use it now)

Late August through September is **snow and ice contracting season** — every
federal property books winter service before the snow flies. Live scans in this
window surface a cluster of snow/ice tenders closing within days of each other.

That's free urgency. Lead with it:

> Three federal snow and ice contracts in the Ottawa area close in the next ten
> days. If {Company} hasn't got responses in progress, there's still time — and
> I'll review any of them against your company for free.

Other seasonal windows worth diarizing: **grounds maintenance** (Feb–April, for
the summer season), **janitorial** (rolling, often 3-year terms with option
years), **construction/trades** (Jan–March, for the build season).

---

## Tracking

One spreadsheet, six columns. Nothing fancier until you have 50 rows.

| Company | Contact | Tender sent | Date sent | Reply | Outcome |
|---|---|---|---|---|---|

The numbers that matter at this stage:
- **Emails sent** (target 20 before judging anything)
- **Reply rate** (5–10% is normal cold; below 3% means the email is wrong)
- **Reviews delivered** (your real pipeline)
- **Review → paid package conversion** (this is the number that says whether
  the business works)

## Kill criterion

If 60 tender-specific emails across two trades produce zero paid packages,
the wedge is wrong — pivot to the prequalification offer, where the buyer has
a hard compliance deadline rather than an optional opportunity.
