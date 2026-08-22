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


def test_closing_timestamp_is_readable(profile):
    from dataclasses import replace

    from tenderdesk.tenders import Tender

    t = Tender(reference="X", title="T", closes="2026-09-10T14:00:00-04:00")
    doc = render_review(_decision(), t, profile)
    assert "2026-09-10 14:00" in doc
    assert "T14:00" not in doc


# --- PDF output -------------------------------------------------------------
#
# Content is verified through render_review() above; these check that the PDF
# itself is well-formed. Text extraction is deliberately not used — it pulls in
# a native crypto stack that is not needed to ship a document.


def _pdf_pages(raw: bytes) -> int:
    return raw.count(b"/Type /Page\n") or raw.count(b"/Type /Page")


def test_pdf_is_well_formed(tmp_path, tender, profile):
    from tenderdesk.pdf import render_review_pdf

    out = render_review_pdf(
        _decision(), tender, profile, tmp_path / "review.pdf",
        prepared_by="TenderDesk", today=date(2026, 8, 22),
    )
    raw = out.read_bytes()
    assert raw.startswith(b"%PDF-")
    assert raw.rstrip().endswith(b"%%EOF")
    assert len(raw) > 2000
    assert _pdf_pages(raw) >= 1


def test_pdf_escapes_markup_safely(tmp_path, tender, profile):
    """Ampersands and angle brackets in model output must not corrupt the PDF."""
    from tenderdesk.pdf import render_review_pdf

    risky = _decision(
        rationale="Cost < $5M & margin > 2% on <b>this</b> file",
        red_flags=["Bonding & insurance <unverified>"],
    )
    out = render_review_pdf(risky, tender, profile, tmp_path / "x.pdf")
    assert out.read_bytes().startswith(b"%PDF-")


def test_every_verdict_renders(tmp_path, tender, profile):
    from tenderdesk.pdf import render_review_pdf

    for i, verdict in enumerate(("bid", "bid_with_partner", "no_bid")):
        out = render_review_pdf(
            _decision(recommendation=verdict), tender, profile, tmp_path / f"{i}.pdf"
        )
        assert out.exists() and out.stat().st_size > 2000


def test_pdf_survives_empty_sections(tmp_path, tender, profile):
    from tenderdesk.pdf import render_review_pdf

    bare = _decision(red_flags=[], mandatory_requirements=[], questions_for_buyer=[])
    out = render_review_pdf(bare, tender, profile, tmp_path / "bare.pdf")
    assert out.read_bytes().startswith(b"%PDF-")
