"""Render a qualification verdict as a client-facing review document.

This is the free deliverable — the thing a prospect actually reads. It is
deliberately not the internal bid package: short, plain, and honest enough
that a "don't bid" answer still reads as worth paying for next time.
"""

from __future__ import annotations

from datetime import date

from .profile import CompanyProfile
from .qualify import BidDecision
from .tenders import Tender

_VERDICT_HEADING = {
    "bid": "Worth bidding",
    "bid_with_partner": "Worth bidding — with a partner",
    "no_bid": "Do not bid",
}


def render_review(
    decision: BidDecision,
    tender: Tender,
    profile: CompanyProfile,
    prepared_by: str = "TenderDesk",
    today: date | None = None,
) -> str:
    """Return a client-ready Markdown review of one tender."""
    verdict = _VERDICT_HEADING.get(decision.recommendation, decision.recommendation)
    stamp = (today or date.today()).isoformat()
    closes = tender.closes[:16] if tender.closes else "see notice"

    lines = [
        f"# Tender Review — {tender.title}",
        "",
        f"**Prepared for {profile.name}** · {prepared_by} · {stamp}",
        "",
        "| | |",
        "|---|---|",
        f"| **Solicitation** | {tender.solicitation or tender.reference} |",
        f"| **Buyer** | {tender.entity} |",
        f"| **Closes** | {closes} |",
        f"| **Selection** | {tender.selection_criteria or 'see notice'} |",
        "",
        "---",
        "",
        f"## Verdict: {verdict}",
        "",
        f"**Fit: {decision.fit_score}/100.** "
        f"Preparing a compliant response would take roughly "
        f"**{decision.estimated_effort_hours} hours** of your team's time.",
        "",
        decision.rationale,
        "",
    ]

    if decision.red_flags:
        lines += ["## What stands in the way", ""]
        lines += [f"- {flag}" for flag in decision.red_flags]
        lines += [""]

    if decision.mandatory_requirements:
        lines += [
            "## What the tender requires",
            "",
            "Every one of these must be satisfied or the bid is set aside before "
            "price is even looked at.",
            "",
        ]
        lines += [f"- {req}" for req in decision.mandatory_requirements]
        lines += [""]

    if decision.questions_for_buyer:
        lines += [
            "## Questions worth putting to the buyer",
            "",
            "Submit these in writing before the enquiry deadline — the answers are "
            "published to every bidder, and they often change the economics.",
            "",
        ]
        lines += [f"{i}. {q}" for i, q in enumerate(decision.questions_for_buyer, 1)]
        lines += [""]

    lines += [
        "---",
        "",
        "## What happens next",
        "",
    ]
    if decision.recommendation == "no_bid":
        lines += [
            "We are not recommending this one. If you would like, we will keep "
            "watching for tenders that fit your crew, equipment and service area, "
            "and flag the ones worth your time.",
            "",
        ]
    else:
        lines += [
            "If you would like us to prepare the response, we deliver a complete "
            "submission package — compliance matrix, technical response, cover "
            "letter, past performance and submission checklist — in five business "
            "days. You review, sign, and remain the bidder of record.",
            "",
        ]
    lines += [
        "---",
        "",
        f"*This review was prepared from the public tender notice and {profile.name}'s "
        "federal contract record. It is advice on whether to bid, not legal advice, "
        "and the full solicitation documents should be read before any bid decision "
        "is final.*",
        "",
    ]
    return "\n".join(lines)
