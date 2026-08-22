"""Claude-powered bid/no-bid qualification for a single tender.

Returns a structured, validated verdict so downstream code (CLI, future
web app) never has to parse free text.
"""

from __future__ import annotations

import os

import anthropic
from pydantic import BaseModel, Field

from . import DEFAULT_MODEL
from .profile import CompanyProfile
from .tenders import Tender

SYSTEM_PROMPT = """You are a Canadian government-procurement bid strategist advising a small \
business. You know CanadaBuys, provincial portals, mandatory-criteria evaluation, security \
clearances, bonding, and the July 2026 Small Business Procurement Program. Be blunt: a wrong \
"bid" recommendation wastes 30+ hours of a small company's time. Judge only from the tender \
text and company profile given — never assume capabilities the profile does not state."""


class BidDecision(BaseModel):
    fit_score: int = Field(ge=0, le=100, description="Overall fit, 0-100")
    recommendation: str = Field(description="One of: bid, bid_with_partner, no_bid")
    rationale: str = Field(description="2-4 sentences explaining the recommendation")
    mandatory_requirements: list[str] = Field(
        description="Mandatory criteria the response must prove, quoted or paraphrased from the tender"
    )
    red_flags: list[str] = Field(
        description="Disqualifiers or gaps for this company: clearances, bonding, certifications, scale"
    )
    estimated_effort_hours: int = Field(
        ge=1, description="Realistic hours to prepare a compliant response"
    )
    questions_for_buyer: list[str] = Field(
        description="Clarification questions worth submitting before the Q&A deadline"
    )


def build_qualification_prompt(tender: Tender, profile: CompanyProfile) -> str:
    return f"""Assess whether this company should bid on this tender.

<company_profile>
{profile.context_block()}
</company_profile>

<tender>
Reference: {tender.reference}
Solicitation: {tender.solicitation}
Title: {tender.title}
Buyer: {tender.entity}
Notice type: {tender.notice_type} | Category: {tender.category} | Method: {tender.method}
UNSPSC: {tender.unspsc} | GSIN: {tender.gsin}
Regions of opportunity: {tender.regions_opportunity}
Regions of delivery: {tender.regions_delivery}
Closing: {tender.closes}
Selection criteria: {tender.selection_criteria}
Trade agreements: {tender.trade_agreements}
Description:
{tender.description}
</tender>

Give your structured bid/no-bid assessment."""


def qualify(
    tender: Tender,
    profile: CompanyProfile,
    client: anthropic.Anthropic | None = None,
    model: str | None = None,
) -> BidDecision:
    client = client or anthropic.Anthropic()
    response = client.messages.parse(
        model=model or os.environ.get("TENDERDESK_MODEL", DEFAULT_MODEL),
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_qualification_prompt(tender, profile)}],
        output_format=BidDecision,
    )
    return response.parsed_output
