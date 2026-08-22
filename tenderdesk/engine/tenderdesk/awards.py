"""Find prospects from federal contract award history.

CanadaBuys publishes every awarded federal contract — who won it, for how
much, when, what they sold, how many people they employ, and their mailing
address. Companies that have won work in your category and region are
*proven government bidders*: they know the process, they have capacity, and
since win rates run 20-30% they lose far more bids than they win. That makes
them the best cold-outreach list available, and it is free.

Feed: contractHistoryComplete-contratsOctroyesComplet.csv
https://canadabuys.canada.ca/en/support/opendata

The published schema changes between releases, so columns are detected by
fuzzy match rather than hard-coded — run ``tenderdesk prospects --inspect``
to see what was found in the file you downloaded.
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from .match import normalize_region, split_values
from .profile import CompanyProfile

CONTRACT_HISTORY_PAGE = "https://canadabuys.canada.ca/en/support/opendata"

# Ordered candidates: the first column whose lowercased name contains one of
# these substrings wins. Most specific patterns come first.
_COLUMN_PATTERNS = {
    "supplier": ("supplierlegalname", "vendor_name", "supplier_name", "vendor"),
    "operating_name": ("supplieroperatingname", "supplierstandardizedname"),
    "value": ("totalcontractvalue", "contractamount", "contract_value", "value"),
    "date": ("contractawarddate", "award_date", "contract_date", "publicationdate", "date"),
    "description": ("gsindescription", "tenderdescription", "description_en", "description"),
    "buyer": (
        "contractingentityname",
        "enduserentitiesname",
        "owner_org_title",
        "buyer_name",
        "department",
    ),
    "city": ("supplieraddresscity", "vendor_city"),
    "province": ("supplieraddressprovince", "vendor_province"),
    "postal": ("supplieraddresspostalcode", "vendor_postal_code", "postal_code"),
    "street": ("supplieraddressline",),
    "employees": ("supplieremployeecount",),
    "region": ("regionsofdelivery", "delivery_region"),
}

# The feed writes English and French columns in pairs; never pick the French one.
_FRENCH_SUFFIXES = ("-fra", "_fr", "-fr")

# Any column that might describe the work. No single one is reliably populated
# — CanadaBuys leaves gsinDescription blank on ~90% of rows — so keywords are
# matched against all of them joined together.
_DESCRIPTION_PATTERNS = (
    "gsindescription",
    "unspscdescription",
    "tenderdescription",
    "description_en",
    "description",
    "objet",
    "title",
)


def description_columns(fieldnames: list[str]) -> list[str]:
    """Every English column that could carry a description of the work."""
    english = [n for n in fieldnames if not n.lower().endswith(_FRENCH_SUFFIXES)]
    matched = []
    for name in english:
        low = name.lower()
        if any(pattern in low for pattern in _DESCRIPTION_PATTERNS):
            matched.append(name)
    return matched


def detect_columns(fieldnames: list[str]) -> dict[str, str]:
    """Map canonical fields to whatever this release actually calls them."""
    found: dict[str, str] = {}
    english = [n for n in fieldnames if not n.lower().endswith(_FRENCH_SUFFIXES)]
    lowered = {name: name.lower() for name in english}
    for canonical, patterns in _COLUMN_PATTERNS.items():
        for pattern in patterns:
            match = next((n for n, low in lowered.items() if pattern in low), None)
            if match and match not in found.values():
                found[canonical] = match
                break
    return found


def clean_text(raw: str) -> str:
    """Collapse the feed's embedded newlines and '*' prefixes into one line.

    Address and description cells routinely contain literal newlines, which
    break both terminal output and any spreadsheet the list is exported to.
    """
    return " ".join((raw or "").replace("*", " ").split())


def _to_float(raw: str) -> float:
    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch in ".-")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def employee_ceiling(raw: str) -> int | None:
    """Upper bound of a band like '50 to 99 employees' -> 99.

    Returns None when the field is blank or unparseable, which must never
    filter a company out — missing data is not disqualifying.
    """
    numbers = re.findall(r"\d+", raw or "")
    return int(numbers[-1]) if numbers else None


@dataclass
class FilterStats:
    """Row-by-row funnel, so a zero-result run explains itself."""

    total: int = 0
    no_supplier: int = 0
    no_keyword_match: int = 0
    wrong_province: int = 0
    wrong_city: int = 0
    too_many_employees: int = 0
    value_out_of_range: int = 0
    kept: int = 0
    blank_description: int = 0
    description_samples: Counter = field(default_factory=Counter)
    province_samples: Counter = field(default_factory=Counter)

    def report(self) -> str:
        lines = [
            "",
            "Filter funnel:",
            f"  {self.total:>10,}  rows read",
            f"  {self.no_supplier:>10,}  dropped: no supplier name",
            f"  {self.no_keyword_match:>10,}  dropped: description matched no profile keyword"
            f"  ({self.blank_description:,} of those had a blank description)",
            f"  {self.wrong_province:>10,}  dropped: supplier province not in profile regions",
            f"  {self.wrong_city:>10,}  dropped: supplier city filter",
            f"  {self.too_many_employees:>10,}  dropped: too many employees",
            f"  {self.value_out_of_range:>10,}  dropped: contract value out of range",
            f"  {self.kept:>10,}  kept",
        ]
        if self.description_samples:
            lines.append("\nMost common descriptions in the file:")
            for text, count in self.description_samples.most_common(15):
                lines.append(f"  {count:>7,}  {text[:80]}")
        if self.province_samples:
            top = ", ".join(f"{p} ({c:,})" for p, c in self.province_samples.most_common(8))
            lines.append(f"\nSupplier provinces seen: {top}")
        return "\n".join(lines)


@dataclass
class Prospect:
    """A company that has won federal work you could help them win more of."""

    supplier: str
    operating_name: str = ""
    city: str = ""
    province: str = ""
    postal: str = ""
    street: str = ""
    employees: str = ""
    contracts: int = 0
    total_value: float = 0.0
    latest_date: str = ""
    buyers: set[str] = field(default_factory=set)
    samples: list[str] = field(default_factory=list)

    @property
    def average_value(self) -> float:
        return self.total_value / self.contracts if self.contracts else 0.0

    @property
    def location(self) -> str:
        return ", ".join(part for part in (self.city, self.province) if part)

    @property
    def mailing_address(self) -> str:
        parts = (self.street, self.city, self.province, self.postal)
        return ", ".join(part for part in parts if part)


def find_prospects(
    awards_csv: str | Path,
    profile: CompanyProfile,
    max_contract_value: float = 5_000_000.0,
    min_contract_value: float = 10_000.0,
    max_employees: int | None = None,
    city: str | None = None,
    progress: bool = False,
    stats: FilterStats | None = None,
) -> list[Prospect]:
    """Aggregate award rows into ranked prospect companies.

    Filters to the profile's keywords, to where the *supplier* is based (the
    delivery-region column is empty on most rows, and you want contractors you
    can reach anyway), and to contract sizes a small supplier competes for — a
    $40M prime contract tells you nothing about who needs bid help.
    """
    path = Path(awards_csv)
    keywords = [k.lower() for k in profile.keywords]
    wanted_regions = {normalize_region(r) for r in profile.regions} - {""}
    wanted_city = (city or "").strip().lower()
    prospects: dict[str, Prospect] = {}

    with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"{path} has no header row")
        cols = detect_columns(list(reader.fieldnames))
        missing = {"supplier", "description"} - set(cols)
        if missing:
            raise ValueError(
                f"Could not find columns for {sorted(missing)} in {path.name}. "
                f"Run with --inspect to see available columns."
            )
        desc_cols = description_columns(list(reader.fieldnames))

        for count, row in enumerate(reader, 1):
            if progress and count % 100_000 == 0:
                print(f"  ...{count:,} rows scanned", file=sys.stderr)
            if stats:
                stats.total += 1

            supplier = (row.get(cols["supplier"]) or "").strip()
            if not supplier:
                if stats:
                    stats.no_supplier += 1
                continue
            raw_description = " | ".join(
                value for col in desc_cols if (value := (row.get(col) or "").strip())
            )
            description = raw_description.lower()
            if not any(keyword in description for keyword in keywords):
                if stats:
                    stats.no_keyword_match += 1
                    if not raw_description:
                        stats.blank_description += 1
                    else:
                        stats.description_samples[raw_description.lstrip("*")] += 1
                continue

            province = (row.get(cols.get("province", ""), "") or "").strip()
            if stats and province:
                stats.province_samples[province] += 1
            if wanted_regions and province:
                if normalize_region(province) not in wanted_regions:
                    if stats:
                        stats.wrong_province += 1
                    continue
            row_city = (row.get(cols.get("city", ""), "") or "").strip()
            if wanted_city and wanted_city not in row_city.lower():
                if stats:
                    stats.wrong_city += 1
                continue

            if max_employees is not None:
                ceiling = employee_ceiling(row.get(cols.get("employees", ""), "") or "")
                if ceiling is not None and ceiling > max_employees:
                    if stats:
                        stats.too_many_employees += 1
                    continue

            value = _to_float(row.get(cols.get("value", ""), "") or "")
            if value and not (min_contract_value <= value <= max_contract_value):
                if stats:
                    stats.value_out_of_range += 1
                continue
            if stats:
                stats.kept += 1

            key = supplier.upper()
            prospect = prospects.get(key)
            if prospect is None:
                prospect = Prospect(
                    supplier=clean_text(supplier),
                    operating_name=clean_text(row.get(cols.get("operating_name", ""), "")),
                    city=clean_text(row_city),
                    province=clean_text(province),
                    postal=clean_text(row.get(cols.get("postal", ""), "")),
                    street=clean_text(row.get(cols.get("street", ""), "")),
                    employees=clean_text(row.get(cols.get("employees", ""), "")),
                )
                prospects[key] = prospect
            prospect.contracts += 1
            prospect.total_value += value
            date = (row.get(cols.get("date", ""), "") or "").strip()
            if date > prospect.latest_date:
                prospect.latest_date = date
            if "buyer" in cols:
                buyer = (row.get(cols["buyer"]) or "").strip()
                if buyer:
                    prospect.buyers.add(buyer)
            if len(prospect.samples) < 3:
                # Use the joined description, not one column — the single
                # column this used to read is blank on ~90% of rows.
                original = clean_text(raw_description)[:140]
                if original and original not in prospect.samples:
                    prospect.samples.append(original)

    return sorted(prospects.values(), key=lambda p: (p.contracts, p.total_value), reverse=True)


def write_prospect_csv(prospects: list[Prospect], dest: str | Path) -> Path:
    """Write prospects as a spreadsheet ready for outreach tracking."""
    path = Path(dest)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "Company",
                "Operating name",
                "Employees",
                "City",
                "Province",
                "Postal code",
                "Street",
                "Contracts won",
                "Total value",
                "Average value",
                "Latest award",
                "Buyers",
                "Example work",
                "Contact",
                "Date emailed",
                "Reply",
                "Outcome",
            ]
        )
        for p in prospects:
            writer.writerow(
                [
                    p.supplier,
                    p.operating_name,
                    p.employees,
                    p.city,
                    p.province,
                    p.postal,
                    p.street,
                    p.contracts,
                    f"{p.total_value:.2f}",
                    f"{p.average_value:.2f}",
                    p.latest_date,
                    "; ".join(sorted(p.buyers)[:3]),
                    p.samples[0] if p.samples else "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
    return path


def inspect_columns(awards_csv: str | Path) -> None:
    """Print the file's columns and what they were detected as."""
    path = Path(awards_csv)
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        first = next(reader, {})
    print(f"{path.name}: {len(fieldnames)} columns\n")
    detected = detect_columns(fieldnames)
    print("Detected mapping:")
    for canonical in _COLUMN_PATTERNS:
        print(f"  {canonical:15} -> {detected.get(canonical, '(not found)')}")
    print("\nAll columns (with a sample value):")
    for name in fieldnames:
        sample = str(first.get(name, ""))[:60]
        print(f"  {name}: {sample!r}")
