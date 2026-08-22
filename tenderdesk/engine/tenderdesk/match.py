"""Deterministic tender-to-profile matching.

This is the free, fast first pass: score every open tender against the
company profile so only plausible fits are sent to the (paid) Claude
qualification step. Scores are transparent — every point has a reason.

Feed format note: CanadaBuys prefixes every value with ``*`` and separates
multiple values with newlines (``*Ontario (except NCR)\\n*Quebec (except NCR)``),
so all multi-value columns go through :func:`split_values` before comparison.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from .profile import CompanyProfile
from .tenders import Tender

WEIGHT_KEYWORD_TITLE = 3.0
WEIGHT_KEYWORD_DESCRIPTION = 1.0
WEIGHT_UNSPSC = 4.0
WEIGHT_GSIN = 3.0
WEIGHT_REGION = 2.0
WEIGHT_CATEGORY = 1.5
PENALTY_NEGATIVE_KEYWORD = -6.0

# Feed values meaning "deliverable anywhere", after normalization.
_NATIONWIDE = {"canada", "worldwide", "national"}


def split_values(raw: str) -> list[str]:
    """Split a CanadaBuys multi-value cell into clean values.

    Handles the feed's ``*`` prefixes and newline separators, plus the
    comma-separated form used by some columns and other portals.
    """
    values = []
    for line in raw.replace("\r", "\n").split("\n"):
        for piece in line.split(","):
            cleaned = piece.strip().lstrip("*").strip()
            if cleaned:
                values.append(cleaned)
    return values


def normalize_region(value: str) -> str:
    """Reduce a region name to a comparable form.

    ``"Ontario (except NCR)"`` and ``"Ontario"`` must compare equal — the feed
    qualifies province names with NCR carve-outs that profiles don't write out.
    """
    value = re.sub(r"\(.*?\)", " ", value.lower())
    value = re.sub(r"[^a-z ]", " ", value)
    value = " ".join(value.split())
    # "Nunavut Territory" -> "nunavut"; keeps multi-word names like
    # "national capital region" and "british columbia" intact.
    return value.removesuffix(" territory")


def _regions_of(tender: Tender) -> set[str]:
    return {
        normalize_region(region)
        for raw in (tender.regions_opportunity, tender.regions_delivery)
        for region in split_values(raw)
    } - {""}


@dataclass
class MatchResult:
    tender: Tender
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)
    # True once the tender matches on substance (keyword or commodity code).
    # Region/category alone must never produce a match.
    content_relevant: bool = False
    # True when the tender names regions and none of them are ones the
    # company serves — a hard exclusion, not a scoring penalty.
    out_of_region: bool = False

    def add(self, points: float, reason: str, *, content: bool = False) -> None:
        self.score += points
        self.reasons.append(f"{'+' if points >= 0 else ''}{points:g} {reason}")
        if content and points > 0:
            self.content_relevant = True


def score_tender(tender: Tender, profile: CompanyProfile, today: date | None = None) -> MatchResult:
    result = MatchResult(tender=tender)
    title = tender.title.lower()
    description = tender.description.lower()

    for keyword in profile.negative_keywords:
        if keyword.lower() in title or keyword.lower() in description:
            result.add(PENALTY_NEGATIVE_KEYWORD, f"negative keyword '{keyword}'")

    for keyword in profile.keywords:
        needle = keyword.lower()
        if needle in title:
            result.add(WEIGHT_KEYWORD_TITLE, f"keyword '{keyword}' in title", content=True)
        elif needle in description:
            result.add(
                WEIGHT_KEYWORD_DESCRIPTION, f"keyword '{keyword}' in description", content=True
            )

    tender_unspsc = split_values(tender.unspsc)
    for prefix in profile.unspsc_prefixes:
        if any(code.startswith(prefix) for code in tender_unspsc):
            result.add(WEIGHT_UNSPSC, f"UNSPSC prefix {prefix}", content=True)
            break

    # Note: GSIN is populated on fewer than 5% of live notices, so this rarely
    # fires — it stays as a bonus signal, never a requirement.
    tender_gsin = split_values(tender.gsin)
    for prefix in profile.gsin_prefixes:
        if any(code.startswith(prefix) for code in tender_gsin):
            result.add(WEIGHT_GSIN, f"GSIN prefix {prefix}", content=True)
            break

    if profile.regions:
        tender_regions = _regions_of(tender)
        wanted = {normalize_region(r) for r in profile.regions} - {""}
        if not tender_regions:
            # ~15% of live notices name no region. Unknown is not a match —
            # award nothing and let the content signals decide.
            pass
        elif tender_regions & _NATIONWIDE or tender_regions & wanted:
            result.add(WEIGHT_REGION, "region match")
        else:
            result.out_of_region = True

    if profile.categories:
        tender_categories = {c.upper() for c in split_values(tender.category)}
        matched = tender_categories & {c.upper() for c in profile.categories}
        if matched:
            result.add(WEIGHT_CATEGORY, f"category {'/'.join(sorted(matched))}")

    return result


def rank_tenders(
    tenders: list[Tender],
    profile: CompanyProfile,
    today: date | None = None,
    min_score: float = 3.0,
) -> list[MatchResult]:
    """Score open, still-biddable tenders and return matches, best first."""
    results = []
    for tender in tenders:
        if not tender.is_open:
            continue
        days = tender.days_to_close(today)
        if days is not None and days < profile.min_days_to_close:
            continue
        result = score_tender(tender, profile, today)
        if result.out_of_region:
            continue
        if result.content_relevant and result.score >= min_score:
            results.append(result)
    results.sort(key=lambda r: r.score, reverse=True)
    return results
