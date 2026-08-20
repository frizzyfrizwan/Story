"""Deterministic tender-to-profile matching.

This is the free, fast first pass: score every open tender against the
company profile so only plausible fits are sent to the (paid) Claude
qualification step. Scores are transparent — every point has a reason.
"""

from __future__ import annotations

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

# Region values in the feed that mean "anyone can bid / deliver anywhere".
_NATIONWIDE = {"", "canada", "national capital region", "worldwide"}


@dataclass
class MatchResult:
    tender: Tender
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)
    # True once the tender matches on substance (keyword or commodity code).
    # Region/category alone must never produce a match.
    content_relevant: bool = False

    def add(self, points: float, reason: str, *, content: bool = False) -> None:
        self.score += points
        self.reasons.append(f"{'+' if points >= 0 else ''}{points:g} {reason}")
        if content and points > 0:
            self.content_relevant = True


def _split_codes(raw: str) -> list[str]:
    return [code.strip() for chunk in raw.split(",") for code in chunk.split("*") if code.strip()]


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

    tender_unspsc = _split_codes(tender.unspsc)
    for prefix in profile.unspsc_prefixes:
        if any(code.startswith(prefix) for code in tender_unspsc):
            result.add(WEIGHT_UNSPSC, f"UNSPSC prefix {prefix}", content=True)
            break

    tender_gsin = _split_codes(tender.gsin)
    for prefix in profile.gsin_prefixes:
        if any(code.startswith(prefix) for code in tender_gsin):
            result.add(WEIGHT_GSIN, f"GSIN prefix {prefix}", content=True)
            break

    if profile.regions:
        tender_regions = {
            region.strip().lower()
            for raw in (tender.regions_opportunity, tender.regions_delivery)
            for region in raw.split(",")
        }
        if tender_regions & _NATIONWIDE or tender_regions & {r.lower() for r in profile.regions}:
            result.add(WEIGHT_REGION, "region match")

    if profile.categories and tender.category.strip().upper() in {
        c.upper() for c in profile.categories
    }:
        result.add(WEIGHT_CATEGORY, f"category {tender.category}")

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
        if result.content_relevant and result.score >= min_score:
            results.append(result)
    results.sort(key=lambda r: r.score, reverse=True)
    return results
