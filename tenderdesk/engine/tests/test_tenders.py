from datetime import date
from pathlib import Path

import pytest

from tenderdesk.tenders import find_tender, load_tenders

FIXTURE = Path(__file__).parent.parent / "data" / "sample_tenders.csv"


@pytest.fixture()
def tenders():
    return load_tenders(FIXTURE)


def test_loads_all_rows(tenders):
    assert len(tenders) == 9


def test_bom_is_stripped(tenders):
    # If the BOM leaked into the first column name, reference would be empty.
    assert tenders[0].reference == "TD-2026-001"


def test_fields_parsed(tenders):
    tender = find_tender(tenders, "TD-2026-004")
    assert tender.entity == "Department of National Defence"
    assert tender.category == "SRVTGD"
    assert "76111501" in tender.unspsc
    assert tender.is_open
    assert len(tender.attachments) == 2
    assert tender.attachments[0].endswith("TD-2026-004-RFP.pdf")


def test_closing_date_and_days(tenders):
    tender = find_tender(tenders, "TD-2026-001")
    assert tender.closing_date == date(2026, 9, 25)
    assert tender.days_to_close(today=date(2026, 8, 20)) == 36


def test_find_by_solicitation_number(tenders):
    tender = find_tender(tenders, "W0103-26F011/A")
    assert tender.reference == "TD-2026-004"


def test_find_missing_raises(tenders):
    with pytest.raises(KeyError):
        find_tender(tenders, "NOPE-000")
