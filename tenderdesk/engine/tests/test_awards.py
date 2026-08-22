"""Prospect finding from federal award history.

Fixtures use the real CanadaBuys contractHistoryComplete column names, since
column detection is the part most likely to break between releases.
"""

import csv
from pathlib import Path

import pytest

from tenderdesk.awards import (
    Prospect,
    detect_columns,
    employee_ceiling,
    find_prospects,
    write_prospect_csv,
)
from tenderdesk.profile import load_profile

ENGINE = Path(__file__).parent.parent

# Real column names from contractHistoryComplete-contratsOctroyesComplet.csv.
FIELDS = [
    "publicationDate-datePublication",
    "contractAwardDate-dateAttributionContrat",
    "totalContractValue-valeurTotaleContrat",
    "gsinDescription-nibsDescription-eng",
    "gsinDescription-nibsDescription-fra",
    "supplierLegalName-nomLegalFournisseur-eng",
    "supplierLegalName-nomLegalFournisseur-fra",
    "supplierOperatingName-nomCommercialFournisseur-eng",
    "supplierEmployeeCount-fournisseurNombreEmployes-eng",
    "supplierAddressLine-ligneAdresseFournisseur-eng",
    "supplierAddressCity-fournisseurAdresseVille-eng",
    "supplierAddressProvince-fournisseurAdresseProvince-eng",
    "supplierAddressPostalCode-fournisseurAdresseCodePostal",
    "contractingEntityName-nomEntitContractante-eng",
    "regionsOfDelivery-regionsLivraison-eng",
]


def _row(**overrides):
    row = {
        "publicationDate-datePublication": "2025-04-01",
        "contractAwardDate-dateAttributionContrat": "2025-03-15",
        "totalContractValue-valeurTotaleContrat": "120000.00",
        "gsinDescription-nibsDescription-eng": "*Janitorial Services",
        "gsinDescription-nibsDescription-fra": "*Services de conciergerie",
        "supplierLegalName-nomLegalFournisseur-eng": "Capital Cleaning Inc.",
        "supplierLegalName-nomLegalFournisseur-fra": "Capital Cleaning Inc.",
        "supplierOperatingName-nomCommercialFournisseur-eng": "Capital Cleaning",
        "supplierEmployeeCount-fournisseurNombreEmployes-eng": "20 to 49 employees",
        "supplierAddressLine-ligneAdresseFournisseur-eng": "12 Bank Street",
        "supplierAddressCity-fournisseurAdresseVille-eng": "Ottawa",
        "supplierAddressProvince-fournisseurAdresseProvince-eng": "Ontario",
        "supplierAddressPostalCode-fournisseurAdresseCodePostal": "K1P1A1",
        "contractingEntityName-nomEntitContractante-eng": "Public Works and Government Services Canada",
        "regionsOfDelivery-regionsLivraison-eng": "",
    }
    row.update(overrides)
    return row


@pytest.fixture()
def profile():
    return load_profile(ENGINE / "profiles" / "example_contractor.toml")


def _write(tmp_path, rows):
    path = tmp_path / "awards.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return path


# --- column detection -------------------------------------------------------


def test_detects_real_canadabuys_columns():
    cols = detect_columns(FIELDS)
    assert cols["supplier"] == "supplierLegalName-nomLegalFournisseur-eng"
    assert cols["operating_name"] == "supplierOperatingName-nomCommercialFournisseur-eng"
    assert cols["value"] == "totalContractValue-valeurTotaleContrat"
    assert cols["description"] == "gsinDescription-nibsDescription-eng"
    assert cols["buyer"] == "contractingEntityName-nomEntitContractante-eng"
    assert cols["city"] == "supplierAddressCity-fournisseurAdresseVille-eng"
    assert cols["province"] == "supplierAddressProvince-fournisseurAdresseProvince-eng"
    assert cols["employees"] == "supplierEmployeeCount-fournisseurNombreEmployes-eng"


def test_prefers_award_date_over_publication_date():
    assert detect_columns(FIELDS)["date"] == "contractAwardDate-dateAttributionContrat"


def test_never_picks_french_columns():
    assert not any(col.endswith("-fra") for col in detect_columns(FIELDS).values())


def test_detects_alternate_naming_styles():
    cols = detect_columns(["vendor_name", "award_date", "description_en", "value", "department"])
    assert cols["supplier"] == "vendor_name"
    assert cols["date"] == "award_date"
    assert cols["buyer"] == "department"


def test_missing_columns_raise_actionable_error(tmp_path, profile):
    path = tmp_path / "bad.csv"
    path.write_text("a\n1\n")
    with pytest.raises(ValueError, match="--inspect"):
        find_prospects(path, profile)


# --- employee bands ---------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("50 to 99 employees", 99),
        ("1 to 4 employees", 4),
        ("500 or more employees", 500),
        ("", None),
        ("unknown", None),
    ],
)
def test_employee_ceiling(raw, expected):
    assert employee_ceiling(raw) == expected


def test_blank_employee_count_is_never_filtered_out(tmp_path, profile):
    """Missing data must not disqualify a company."""
    rows = [_row(**{"supplierEmployeeCount-fournisseurNombreEmployes-eng": ""})]
    assert find_prospects(_write(tmp_path, rows), profile, max_employees=10)


def test_max_employees_excludes_large_firms(tmp_path, profile):
    rows = [
        _row(),  # 20 to 49
        _row(
            **{
                "supplierLegalName-nomLegalFournisseur-eng": "Megaprime Facilities Group",
                "supplierEmployeeCount-fournisseurNombreEmployes-eng": "500 or more employees",
            }
        ),
    ]
    found = find_prospects(_write(tmp_path, rows), profile, max_employees=50)
    assert [p.supplier for p in found] == ["Capital Cleaning Inc."]


# --- filtering and aggregation ---------------------------------------------


def test_aggregates_and_ranks_by_contract_count(tmp_path, profile):
    rows = [
        _row(),
        _row(
            **{
                "totalContractValue-valeurTotaleContrat": "80000.00",
                "gsinDescription-nibsDescription-eng": "*Custodial and cleaning services",
                "contractAwardDate-dateAttributionContrat": "2026-01-15",
                "contractingEntityName-nomEntitContractante-eng": "National Research Council",
            }
        ),
        _row(
            **{
                "supplierLegalName-nomLegalFournisseur-eng": "Rideau Grounds Ltd.",
                "gsinDescription-nibsDescription-eng": "*Snow removal services",
                "totalContractValue-valeurTotaleContrat": "60000.00",
            }
        ),
    ]
    found = find_prospects(_write(tmp_path, rows), profile)
    assert [p.supplier for p in found] == ["Capital Cleaning Inc.", "Rideau Grounds Ltd."]
    top = found[0]
    assert top.contracts == 2
    assert top.total_value == 200000
    assert top.average_value == 100000
    assert top.latest_date == "2026-01-15"
    assert top.buyers == {
        "Public Works and Government Services Canada",
        "National Research Council",
    }
    assert top.mailing_address == "12 Bank Street, Ottawa, Ontario, K1P1A1"
    assert top.operating_name == "Capital Cleaning"


def test_filters_out_other_trades(tmp_path, profile):
    rows = [_row(**{"gsinDescription-nibsDescription-eng": "*Software licence renewal"})]
    assert find_prospects(_write(tmp_path, rows), profile) == []


def test_filters_by_supplier_province(tmp_path, profile):
    rows = [
        _row(
            **{
                "supplierLegalName-nomLegalFournisseur-eng": "Pacific Facility Care",
                "supplierAddressProvince-fournisseurAdresseProvince-eng": "British Columbia",
            }
        )
    ]
    assert find_prospects(_write(tmp_path, rows), profile) == []


def test_city_filter(tmp_path, profile):
    rows = [
        _row(),
        _row(
            **{
                "supplierLegalName-nomLegalFournisseur-eng": "Toronto Building Care",
                "supplierAddressCity-fournisseurAdresseVille-eng": "Toronto",
            }
        ),
    ]
    found = find_prospects(_write(tmp_path, rows), profile, city="Ottawa")
    assert [p.supplier for p in found] == ["Capital Cleaning Inc."]


def test_filters_out_contracts_too_large_for_a_small_supplier(tmp_path, profile):
    rows = [
        _row(
            **{
                "supplierLegalName-nomLegalFournisseur-eng": "Megaprime Facilities Group",
                "totalContractValue-valeurTotaleContrat": "48000000.00",
            }
        )
    ]
    assert find_prospects(_write(tmp_path, rows), profile) == []


def test_sample_descriptions_are_deduped_and_unstarred(tmp_path, profile):
    rows = [_row(), _row()]
    found = find_prospects(_write(tmp_path, rows), profile)
    assert found[0].samples == ["Janitorial Services"]


# --- spreadsheet export -----------------------------------------------------


def test_csv_export_has_outreach_tracking_columns(tmp_path, profile):
    found = find_prospects(_write(tmp_path, [_row()]), profile)
    out = write_prospect_csv(found, tmp_path / "prospects.csv")
    with out.open(encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    assert rows[0]["Company"] == "Capital Cleaning Inc."
    assert rows[0]["City"] == "Ottawa"
    assert rows[0]["Employees"] == "20 to 49 employees"
    # Blank columns the founder fills in while working the list.
    for column in ("Contact", "Date emailed", "Reply", "Outcome"):
        assert rows[0][column] == ""


def test_average_value_of_empty_prospect_is_zero():
    assert Prospect(supplier="X").average_value == 0.0


# --- diagnostics ------------------------------------------------------------


def test_filter_stats_explain_a_zero_result_run(tmp_path, profile):
    from tenderdesk.awards import FilterStats

    rows = [
        _row(**{"gsinDescription-nibsDescription-eng": "*Software licence renewal"}),
        _row(**{"gsinDescription-nibsDescription-eng": ""}),
        _row(
            **{
                "supplierLegalName-nomLegalFournisseur-eng": "Pacific Facility Care",
                "supplierAddressProvince-fournisseurAdresseProvince-eng": "British Columbia",
            }
        ),
        _row(),
    ]
    stats = FilterStats()
    found = find_prospects(_write(tmp_path, rows), profile, stats=stats)
    assert stats.total == 4
    assert stats.no_keyword_match == 2
    assert stats.blank_description == 1
    assert stats.wrong_province == 1
    assert stats.kept == 1
    assert len(found) == 1
    report = stats.report()
    assert "rows read" in report
    # The unmatched description must be surfaced so the profile can be tuned.
    assert "Software licence renewal" in report


def test_description_matching_spans_every_candidate_column():
    """No single description column is reliably populated, so all are joined."""
    from tenderdesk.awards import description_columns

    cols = description_columns(FIELDS)
    assert "gsinDescription-nibsDescription-eng" in cols
    assert not any(c.endswith("-fra") for c in cols)


def test_matches_when_only_a_secondary_description_column_is_filled(tmp_path, profile):
    """CanadaBuys leaves gsinDescription blank on ~90% of rows."""
    fields = FIELDS + ["title-titre-eng", "tenderDescription-descriptionAppelOffres-eng"]
    path = tmp_path / "awards.csv"
    row = _row(**{"gsinDescription-nibsDescription-eng": ""})
    row["title-titre-eng"] = "SUPPLY OF SERVICES (123/001)"
    row["tenderDescription-descriptionAppelOffres-eng"] = "Provision of janitorial services"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerow(row)
    found = find_prospects(path, profile)
    assert [p.supplier for p in found] == ["Capital Cleaning Inc."]


def test_detects_open_canada_proactive_disclosure_columns():
    cols = detect_columns(
        [
            "vendor_name",
            "buyer_name",
            "contract_date",
            "description_en",
            "contract_value",
            "vendor_postal_code",
        ]
    )
    assert cols["supplier"] == "vendor_name"
    assert cols["buyer"] == "buyer_name"
    assert cols["postal"] == "vendor_postal_code"


def test_clean_text_collapses_feed_formatting():
    from tenderdesk.awards import clean_text

    assert clean_text("6 Craigmohr Court \nCraigmohr") == "6 Craigmohr Court Craigmohr"
    assert clean_text("*Snow removal\n*Landscaping") == "Snow removal Landscaping"
    assert clean_text("") == ""


def test_samples_come_from_the_joined_description(tmp_path, profile):
    """Sampling one column produced blanks on ~90% of real rows."""
    fields = FIELDS + ["unspscDescription-eng"]
    path = tmp_path / "awards.csv"
    row = _row(**{"gsinDescription-nibsDescription-eng": ""})
    row["unspscDescription-eng"] = "*Janitorial services\n*Building maintenance"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerow(row)
    found = find_prospects(path, profile)
    assert found[0].samples
    assert "\n" not in found[0].samples[0]
    assert "Janitorial services" in found[0].samples[0]


def test_addresses_are_single_line(tmp_path, profile):
    rows = [_row(**{"supplierAddressLine-ligneAdresseFournisseur-eng": "6 Craigmohr Court \nUnit 2"})]
    found = find_prospects(_write(tmp_path, rows), profile)
    assert "\n" not in found[0].mailing_address
    assert found[0].street == "6 Craigmohr Court Unit 2"
