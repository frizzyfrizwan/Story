from datetime import date
from pathlib import Path

import pytest

from tenderdesk.match import (
    normalize_region,
    rank_tenders,
    score_tender,
    split_values,
)
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


# --- feed format handling (the live-data bugs) ------------------------------


def test_split_values_handles_star_prefix_and_newlines():
    """The live feed writes '*F010B\\n*F059A', not 'F010B,F059A'."""
    assert split_values("*F010B\n*F059A") == ["F010B", "F059A"]
    assert split_values("*CNST") == ["CNST"]
    assert split_values("") == []
    # Comma form still works (sample data, other portals).
    assert split_values("K122A, J039A") == ["K122A", "J039A"]


def test_normalize_region_strips_ncr_qualifiers():
    assert normalize_region("Ontario (except NCR)") == "ontario"
    assert normalize_region("National Capital Region (NCR)") == "national capital region"
    assert normalize_region("Nunavut Territory") == "nunavut"
    assert normalize_region("British Columbia") == "british columbia"


def test_category_matches_despite_star_prefix(tenders, profile):
    """'*SRV' must match a profile listing 'SRV' — it silently never did."""
    result = score_tender(find_tender(tenders, "TD-2026-001"), profile, today=TODAY)
    assert any("category SRV" in reason for reason in result.reasons)


# --- region correctness ----------------------------------------------------


def test_out_of_region_tender_is_excluded(tenders, profile):
    """Moncton work must not reach an Ontario/Québec contractor."""
    result = score_tender(find_tender(tenders, "TD-2026-008"), profile, today=TODAY)
    assert result.out_of_region
    assert "TD-2026-008" not in {r.tender.reference for r in rank_tenders(tenders, profile, today=TODAY)}


def test_missing_region_is_not_a_match(tenders, profile):
    """~15% of live notices name no region; unknown must not score as a match."""
    result = score_tender(find_tender(tenders, "TD-2026-007"), profile, today=TODAY)
    assert not result.out_of_region
    assert not any("region match" in reason for reason in result.reasons)


def test_in_region_tender_scores_region(tenders, profile):
    result = score_tender(find_tender(tenders, "TD-2026-004"), profile, today=TODAY)
    assert any("region match" in reason for reason in result.reasons)


# --- ranking behaviour -----------------------------------------------------


def test_ranking_surfaces_facility_work_first(tenders, profile):
    results = rank_tenders(tenders, profile, today=TODAY)
    refs = [r.tender.reference for r in results]
    assert refs[0] == "TD-2026-004"
    assert {"TD-2026-001", "TD-2026-002", "TD-2026-003"} <= set(refs)


def test_it_tender_is_not_matched(tenders, profile):
    results = rank_tenders(tenders, profile, today=TODAY)
    assert "TD-2026-005" not in {r.tender.reference for r in results}


def test_negative_keyword_penalizes_aircraft_cleaning(tenders, profile):
    tender = find_tender(tenders, "TD-2026-007")
    result = score_tender(tender, profile, today=TODAY)
    assert any("negative keyword 'aircraft'" in reason for reason in result.reasons)
    ranked_refs = [r.tender.reference for r in rank_tenders(tenders, profile, today=TODAY)]
    if "TD-2026-007" in ranked_refs:
        assert ranked_refs.index("TD-2026-007") > ranked_refs.index("TD-2026-001")


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
