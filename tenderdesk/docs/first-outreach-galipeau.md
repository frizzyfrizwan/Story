# First Outreach: Groupe Multi-Services Galipeau

Your first cold email, built entirely from verified data. Every claim below
traces to either the federal award history or the live CanadaBuys tender feed —
nothing is invented, because the credibility of the first email is the only
asset you have.

## Why this company first

| Fact | Source |
|---|---|
| 14 employees | Award history, `supplierEmployeeCount` |
| 637 Center Street, Ottawa K1K 2N8 (Vanier) | Award history, supplier address |
| 4 federal contracts, $3,575,560 total (~$894K average) | Award history, aggregated |
| Won **EJ196-241423, Snow and Ice Removal, Parliament Hill** | Award history, description |
| Most recent award: **2026-04-02** | Award history, `contractAwardDate` |
| Scope spans snow/ice *and* building & facility maintenance | Award history, UNSPSC descriptions |

**The read:** a 14-person shop winning Parliament Hill snow contracts is bidding
regularly and winning some — which means it is *losing* several for every win.
At 14 people there is no full-time proposal writer; the owner is doing it at
night. That's the pain you're selling into. They're active (April 2026 award),
local, and the right size.

**One thing to check first:** the business name and the Vanier postal code both
suggest a francophone company. Have the French version ready — leading in
French, or at minimum offering it, is a real advantage here.

## Live tenders that fit them

Verify each is still open before sending — run `tenderdesk scan --live` the
morning you send.

| Tender | Buyer | Closes | Why it fits |
|---|---|---|---|
| **W6889-270214** Priority Parking Snow and Ice Control Operations | PSPC | Sept 10 | Direct match to their Parliament Hill snow work |
| **cb-660-38052142** Corelands Maintenance Management Services | NCC | Sept 14 | Grounds/facility maintenance, their second line |
| **EJ196-261270** Janitorial Cleaning Services, West Memorial Building | PSPC | Sept 9 | Same buyer prefix (EJ196) as a contract they already won |

Lead with the **NCC Corelands** one — it closes latest, so the timeline is
comfortable, and NCC is a different buyer from their usual PSPC work, which
makes it genuinely new information rather than something they've already seen.

---

## Email — English

**Subject:** `NCC maintenance tender, closes Sept 14`

> Hi [NAME],
>
> I came across a National Capital Commission tender that looks like a fit for
> Galipeau:
>
> **Corelands Maintenance Management Services** — closes September 14
> [LINK FROM YOUR SCAN]
>
> I noticed you handled the snow and ice removal contract on Parliament Hill
> (EJ196-241423), so grounds and facility maintenance for NCC is squarely in
> what you already do.
>
> I'm [YOUR NAME] — I run TenderDesk here in Ottawa. I write federal bid
> responses for small contractors: compliance matrix, technical response, past
> performance, the full submission package.
>
> **I'll review this tender against your company for free** and tell you
> honestly whether it's worth bidding — including if my answer is don't. One
> day, no cost, no obligation.
>
> If it's useful, my rate after that is $1,500 flat per package, delivered in
> five business days.
>
> Want me to run the review?
>
> [YOUR NAME]
> [PHONE] · [EMAIL]

---

## Courriel — Français

**Objet :** `Appel d'offres CCN, clôture le 14 septembre`

> Bonjour [NOM],
>
> J'ai repéré un appel d'offres de la Commission de la capitale nationale qui
> correspond bien à Galipeau :
>
> **Services de gestion de l'entretien des terrains** — clôture le 14 septembre
> [LIEN]
>
> J'ai vu que vous aviez obtenu le contrat de déneigement et de déglaçage de la
> Colline du Parlement (EJ196-241423) — l'entretien des terrains et des
> installations pour la CCN s'inscrit donc directement dans vos activités.
>
> Je m'appelle [VOTRE NOM] et je dirige TenderDesk, ici à Ottawa. Je rédige les
> soumissions fédérales pour les petits entrepreneurs : grille de conformité,
> réponse technique, expérience pertinente, dossier complet.
>
> **J'analyserai cet appel d'offres pour votre entreprise gratuitement** et je
> vous dirai honnêtement s'il vaut la peine de soumissionner — y compris si ma
> réponse est non. Un jour, sans frais ni engagement.
>
> Si cela vous convient, mon tarif est ensuite de 1 500 $ forfaitaire par
> dossier, livré en cinq jours ouvrables.
>
> Souhaitez-vous que je fasse l'analyse ?
>
> [VOTRE NOM]
> [TÉLÉPHONE] · [COURRIEL]

---

## Phone script (better odds than email at this size)

A 14-person contractor answers the phone. Owner-operators often prefer it.

> "Hi, I'm looking for whoever handles your government bids — is that you?
>
> Great. My name's [NAME], I run a bid-writing service here in Ottawa. Quick
> reason for the call: the NCC has a grounds maintenance tender closing
> September 14, and given you did the Parliament Hill snow contract it looked
> like a fit.
>
> I'm not selling you anything today — I'll review it against your company for
> free and tell you whether it's worth bidding. If it's not, I'll say so.
>
> Can I email you the review, and what's the best address?"

Then **send the review**. That's the whole point of the call.

## Finding the contact

In order of what works:
1. Company website → team or contact page
2. LinkedIn → search the company, look for owner/president/estimator
3. Canada411 or Google Maps → the business phone
4. Call the main line and ask who handles government bids

Address a person by name if you possibly can. "Hi there" reads like a blast.

## Follow-up (4 days later, same thread)

> Hi [NAME],
>
> Following up on the NCC maintenance tender — it closes September 14, so the
> window is getting short.
>
> If it's not a fit, no problem at all. If you'd like the free review, just
> reply "yes" and I'll have it to you within 24 hours.
>
> [YOUR NAME]

One follow-up. Not two.

## Before you hit send

- [ ] Business registered, so "I run TenderDesk" is literally true
- [ ] Real email address on your own domain — not gmail
- [ ] Tender re-verified as still open (`tenderdesk scan --live`)
- [ ] Contract reference EJ196-241423 double-checked in your prospects file
- [ ] A named contact, not "Hi there"
- [ ] You can actually deliver the review within 24 hours if they say yes

**The last box is the one that matters.** If they reply yes, run
`tenderdesk qualify` on that tender against a profile you build for Galipeau,
review every line yourself, and send it. That single delivered review is worth
more than the next fifty emails — it's your first case study, your first
reference, and the thing that turns this from an idea into a business.

## Do not

- Claim clients or results you don't have. You have zero. The free review is
  the offer precisely because it doesn't require a track record.
- Attach a brochure. One tender, one offer, one question.
- Send to twenty companies at once before the first reply teaches you
  something. Send five, read what comes back, adjust, send the next fifteen.
