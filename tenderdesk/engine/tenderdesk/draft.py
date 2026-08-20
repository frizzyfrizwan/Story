"""Claude-powered bid-package drafting.

Produces the working documents a small supplier needs to respond:
compliance matrix, response outline, cover letter, and draft narrative.
Anything the company profile does not establish is emitted as a
[FILL: ...] placeholder — the human closes those before submission.
Placeholders over hallucinations, always: an invented certification or
past project in a government bid is grounds for disqualification.
"""

from __future__ import annotations

import os

import anthropic

from . import DEFAULT_MODEL
from .profile import CompanyProfile
from .tenders import Tender

SYSTEM_PROMPT = """You are a senior Canadian government bid writer producing working drafts for \
a small supplier. Non-negotiable rules:
1. NEVER invent facts about the company — no fabricated projects, references, staff, \
certifications, or numbers. Where a required fact is not in the company profile, write a \
placeholder like [FILL: WSIB clearance number] and keep going.
2. Compliance first: evaluators screen mandatory criteria before reading prose. Every mandatory \
requirement gets a row in the compliance matrix with a pointer to where the response addresses it.
3. Mirror the tender's own language for requirement names so evaluators can cross-reference.
4. Write plainly and specifically; government evaluators penalize marketing fluff.
5. If the tender text is missing key details (evaluation weights, submission format), note it \
in "Questions for the buyer" rather than guessing."""

PACKAGE_INSTRUCTIONS = """Produce a complete bid-response working package in Markdown with these sections:

# Bid Package: <tender title>
## 1. Bid Summary
Tender reference, buyer, closing date/time, submission method, and a 3-sentence win strategy.
## 2. Compliance Matrix
A table: Requirement (quoted/paraphrased) | Mandatory or Rated | Where addressed | Status \
(Ready / Needs input [FILL: ...] / Gap).
## 3. Cover Letter
Ready-to-sign draft on the company's behalf.
## 4. Technical Response Draft
Drafted against the tender's stated criteria, using only profile facts + [FILL: ...] placeholders.
## 5. Past Performance
Entries from the profile mapped to this tender's scope; placeholders for required references.
## 6. Pricing Checklist
What the price must include per the tender (do NOT invent prices).
## 7. Submission Checklist
Forms, signatures, copies, deadline, delivery method.
## 8. Questions for the Buyer
Worth submitting before the Q&A deadline."""


def build_draft_prompt(tender: Tender, profile: CompanyProfile) -> str:
    attachments = "\n".join(tender.attachments) or "None listed"
    return f"""Draft the bid-response package for this tender.

<company_profile>
{profile.context_block()}
</company_profile>

<tender>
Reference: {tender.reference}
Solicitation: {tender.solicitation}
Title: {tender.title}
Buyer: {tender.entity}
Notice type: {tender.notice_type} | Category: {tender.category} | Method: {tender.method}
Closing: {tender.closes}
Regions of delivery: {tender.regions_delivery}
Selection criteria: {tender.selection_criteria}
Trade agreements: {tender.trade_agreements}
Notice URL: {tender.url}
Attachments (full RFP documents — review before submitting):
{attachments}
Description:
{tender.description}
</tender>

{PACKAGE_INSTRUCTIONS}"""


def draft_package(
    tender: Tender,
    profile: CompanyProfile,
    client: anthropic.Anthropic | None = None,
    model: str | None = None,
) -> str:
    """Generate the full bid package as Markdown text."""
    client = client or anthropic.Anthropic()
    with client.messages.stream(
        model=model or os.environ.get("TENDERDESK_MODEL", DEFAULT_MODEL),
        max_tokens=64000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_draft_prompt(tender, profile)}],
    ) as stream:
        response = stream.get_final_message()
    if response.stop_reason == "refusal":
        raise RuntimeError("Model declined to draft this package; review the tender content.")
    return "".join(block.text for block in response.content if block.type == "text")
