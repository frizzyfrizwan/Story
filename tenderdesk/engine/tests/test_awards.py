"""Prospect finding from federal award history.

The published schema changes between releases, so column detection is the
part most likely to break — it gets the most coverage here.
"""

import csv
from pathlib import Path

import pytest

from tenderdesk.awards import Prospect, detect_columns, find_prospects
from tenderdesk.profile import load_profile

ENGINE = Path(__file__).parent.parent


@pytest.fixture()
def profile():
    return load_profile(ENGINE / "profiles" / "example_contractor.toml")


def _write_awards(tmp_path, rows, fieldnames):
    path = tmp_path / "awards.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return path


def test_detects_columns_across_naming_styles():
    cols = detect_columns(
        [
            "reference_number",
            "procurement_id",
            "vendor_name",
            "contract_date",
            "description_en",
            "total_contract_value",
            "owner_org_title",
            "delivery_region",
        ]
    )
    assert cols["supplier"] == "vendor_name"
    assert cols["value"] == "total_contract_value"
    assert cols["date"] == "contract_date"
    assert cols["description"] == "description_en"
    assert cols["buyer"] == "owner_org_title"


def test_detects_alternate_column_names():
    cols = detect_columns(["supplier_name", "award_date", "description", "value", "department"])
    assert cols["supplier"] == "supplier_name"
    assert cols["date"] == "award_date"
    assert cols["buyer"] == "department"


def test_missing_columns_raise_actionable_error(tmp_path, profile):
    path = _write_awards(tmp_path, [{"a": "1"}], ["a"])
    with pytest.raises(ValueError, match="--inspect"):
        find_prospects(path, profile)


FIELDS = [
    "vendor_name",
    "description_en",
    "total_contract_value",
    "contract_date",
    "owner_org_title",
    "delivery_region",
]


def test_aggregates_and_ranks_by_contract_count(tmp_path, profile):
    rows = [
        {
            "vendor_name": "Capital Cleaning Inc.",
            "description_en": "Janitorial services for federal offices",
            "total_contract_value": "120000",
            "contract_date": "2025-03-01",
            "owner_org_title": "PSPC",
            "delivery_region": "Ontario",
        },
        {
            "vendor_name": "Capital Cleaning Inc.",
            "description_en": "Custodial and cleaning services",
            "total_contract_value": "80000",
            "contract_date": "2026-01-15",
            "owner_org_title": "NRC",
            "delivery_region": "Ontario",
        },
        {
            "vendor_name": "Rideau Grounds Ltd.",
            "description_en": "Snow removal and grounds maintenance",
            "total_contract_value": "60000",
            "contract_date": "2025-11-02",
            "owner_org_title": "NCC",
            "delivery_region": "Ontario",
        },
    ]
    prospects = find_prospects(_write_awards(tmp_path, rows, FIELDS), profile)
    assert [p.supplier for p in prospects] == ["Capital Cleaning Inc.", "Rideau Grounds Ltd."]
    top = prospects[0]
    assert top.contracts == 2
    assert top.total_value == 200000
    assert top.average_value == 100000
    assert top.latest_date == "2026-01-15"
    assert top.buyers == {"PSPC", "NRC"}


def test_filters_out_other_trades(tmp_path, profile):
    rows = [
        {
            "vendor_name": "Beltway Software Corp.",
            "description_en": "Software licence renewal",
            "total_contract_value": "90000",
            "contract_date": "2026-02-01",
            "owner_org_title": "SSC",
            "delivery_region": "Ontario",
        }
    ]
    assert find_prospects(_write_awards(tmp_path, rows, FIELDS), profile) == []


def test_filters_out_other_regions(tmp_path, profile):
    rows = [
        {
            "vendor_name": "Pacific Facility Care",
            "description_en": "Janitorial services",
            "total_contract_value": "70000",
            "contract_date": "2026-02-01",
            "owner_org_title": "PSPC",
            "delivery_region": "British Columbia",
        }
    ]
    assert find_prospects(_write_awards(tmp_path, rows, FIELDS), profile) == []


def test_filters_out_contracts_too_large_for_a_small_supplier(tmp_path, profile):
    rows = [
        {
            "vendor_name": "Megaprime Facilities Group",
            "description_en": "National janitorial services master contract",
            "total_contract_value": "48000000",
            "contract_date": "2026-02-01",
            "owner_org_title": "PSPC",
            "delivery_region": "Ontario",
        }
    ]
    assert find_prospects(_write_awards(tmp_path, rows, FIELDS), profile) == []


def test_average_value_of_empty_prospect_is_zero():
    assert Prospect(supplier="X").average_value == 0.0
