"""The client-facing review document."""

from datetime import date
from pathlib import Path

import pytest

from tenderdesk.profile import load_profile
from tenderdesk.qualify import BidDecision
from tenderdesk.report import render_review
from tenderdesk.tenders import find_tender, load_tenders

ENGINE = Path(__file__).parent.parent


@pytest.fixture()
def tender():
    return find_tender(load_tenders(ENGINE / "data" / "sample_tenders.csv"), "TD-2026-002")


@pytest.fixture()
def profile():
    return load_profile(ENGINE / "profiles" / "example_contractor.toml")


def _decision(**overrides):
    data = {
        "fit_score": 28,
        "recommendation": "no_bid",
        "rationale": "The site is 160 km outside the service area and the fleet is too small.",
        "mandatory_requirements": ["Reliability Status for site supervisors"],
        "red_flags": ["No yard within 160 km of the site"],
        "estimated_effort_hours": 40,
        "questions_for_buyer": ["Is there a mandatory site visit?"],
    }
    data.update(overrides)
    return BidDecision(**data)


def test_review_leads_with_the_verdict(tender, profile):
    doc = render_review(_decision(), tender, profile, today=date(2026, 8, 22))
    assert "## Verdict: Do not bid" in doc
    assert "28/100" in doc
    assert "40 hours" in doc


def test_review_names_the_client_and_preparer(tender, profile):
    doc = render_review(_decision(), tender, profile, prepared_by="TenderDesk", today=date(2026, 8, 22))
    assert "Prepared for Maple Ridge Facility Services Ltd." in doc
    assert "TenderDesk" in doc
    assert "2026-08-22" in doc


def test_no_bid_offers_to_keep_watching_rather_than_selling(tender, profile):
    doc = render_review(_decision(), tender, profile)
    assert "keep watching" in doc
    # Must not pitch the paid package on a tender we said not to enter.
    assert "five business days" not in doc


def test_bid_verdict_pitches_the_package(tender, profile):
    doc = render_review(_decision(recommendation="bid", fit_score=82), tender, profile)
    assert "## Verdict: Worth bidding" in doc
    assert "five business days" in doc


def test_review_carries_requirements_flags_and_questions(tender, profile):
    doc = render_review(_decision(), tender, profile)
    assert "Reliability Status for site supervisors" in doc
    assert "No yard within 160 km" in doc
    assert "1. Is there a mandatory site visit?" in doc


def test_review_includes_a_scope_disclaimer(tender, profile):
    doc = render_review(_decision(), tender, profile)
    assert "not legal advice" in doc


def test_empty_sections_are_omitted(tender, profile):
    doc = render_review(
        _decision(red_flags=[], questions_for_buyer=[], mandatory_requirements=[]),
        tender,
        profile,
    )
    assert "What stands in the way" not in doc
    assert "Questions worth putting" not in doc
    assert "## Verdict" in doc
