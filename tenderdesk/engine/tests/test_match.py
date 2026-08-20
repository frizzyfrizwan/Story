from datetime import date
from pathlib import Path

import pytest

from tenderdesk.match import rank_tenders, score_tender
from tenderdesk.profile import load_profile
from tenderdesk.tenders import find_tender, load_tenders

ENGINE = Path(__file__).parent.parent
TODAY = date(2026, 8, 20)


@pytest.fixture()
def tenders():
    return load_tenders(ENGINE / "data" / "sample_tenders.csv")


@pytest.fixture()
def profile():
    return load_profile(ENGINE / "profiles" / "example_contractor.toml")


def test_ranking_surfaces_facility_work_first(tenders, profile):
    results = rank_tenders(tenders, profile, today=TODAY)
    refs = [r.tender.reference for r in results]
    # The integrated CFB Kingston facility contract is the strongest fit.
    assert refs[0] == "TD-2026-004"
    # Straight janitorial/snow/HVAC matches all make the list.
    assert {"TD-2026-001", "TD-2026-002", "TD-2026-003"} <= set(refs)


def test_it_tender_is_not_matched(tenders, profile):
    results = rank_tenders(tenders, profile, today=TODAY)
    assert "TD-2026-005" not in {r.tender.reference for r in results}


def test_negative_keyword_penalizes_aircraft_cleaning(tenders, profile):
    tender = find_tender(tenders, "TD-2026-007")
    result = score_tender(tender, profile, today=TODAY)
    assert any("negative keyword 'aircraft'" in reason for reason in result.reasons)
    ranked = rank_tenders(tenders, profile, today=TODAY)
    ranked_refs = [r.tender.reference for r in ranked]
    # Penalty must sink it below the clean janitorial matches even if it squeaks in.
    if "TD-2026-007" in ranked_refs:
        assert ranked_refs.index("TD-2026-007") > ranked_refs.index("TD-2026-001")


def test_out_of_region_scores_lower_than_in_region(tenders, profile):
    ottawa = score_tender(find_tender(tenders, "TD-2026-001"), profile, today=TODAY)
    moncton = score_tender(find_tender(tenders, "TD-2026-008"), profile, today=TODAY)
    assert ottawa.score > moncton.score


def test_too_soon_to_close_is_filtered(tenders, profile):
    # TD-2026-009 closes in 4 days; profile requires >= 7.
    results = rank_tenders(tenders, profile, today=TODAY)
    assert "TD-2026-009" not in {r.tender.reference for r in results}


def test_every_point_has_a_reason(tenders, profile):
    for result in rank_tenders(tenders, profile, today=TODAY):
        assert result.reasons
        assert result.score == pytest.approx(
            sum(float(reason.split()[0]) for reason in result.reasons)
        )
