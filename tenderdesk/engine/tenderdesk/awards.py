"""Find prospects from federal contract award history.

Proactive disclosure publishes every federal contract over $10K — who won it,
for how much, and when. Companies that have won work in your category and
region are *proven government bidders*: they know the process, they have
capacity, and since win rates run 20-30% they lose far more bids than they
win. That makes them the best cold-outreach list available, and it is free.

Dataset: https://open.canada.ca/data/en/dataset/4fe645a1-ffcd-40c1-9385-2c771be956a4

The published schema changes between releases, so columns are detected by
fuzzy match rather than hard-coded — run ``tenderdesk prospects --inspect``
to see what was found in the file you downloaded.
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from .match import normalize_region, split_values
from .profile import CompanyProfile

CONTRACT_HISTORY_PAGE = (
    "https://open.canada.ca/data/en/dataset/4fe645a1-ffcd-40c1-9385-2c771be956a4"
)

# Ordered candidates: the first column whose lowercased name contains one of
# these substrings wins. Longer/more specific patterns come first.
_COLUMN_PATTERNS = {
    "supplier": ("vendor_name", "supplier_name", "vendor", "supplier"),
    "value": ("total_contract_value", "contract_value", "original_value", "value"),
    "date": ("contract_date", "award_date", "start_date", "date"),
    "description": ("description_en", "description", "comments_en", "objet"),
    "buyer": ("owner_org_title", "owner_org", "organization", "department"),
    "region": ("delivery_region", "region", "province"),
}


def detect_columns(fieldnames: list[str]) -> dict[str, str]:
    """Map canonical fields to whatever this release actually calls them."""
    found: dict[str, str] = {}
    lowered = {name: name.lower() for name in fieldnames}
    for canonical, patterns in _COLUMN_PATTERNS.items():
        for pattern in patterns:
            match = next((n for n, low in lowered.items() if pattern in low), None)
            if match and match not in found.values():
                found[canonical] = match
                break
    return found


def _to_float(raw: str) -> float:
    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch in ".-")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


@dataclass
class Prospect:
    """A company that has won federal work you could help them win more of."""

    supplier: str
    contracts: int = 0
    total_value: float = 0.0
    latest_date: str = ""
    buyers: set[str] = field(default_factory=set)
    samples: list[str] = field(default_factory=list)

    @property
    def average_value(self) -> float:
        return self.total_value / self.contracts if self.contracts else 0.0


def find_prospects(
    awards_csv: str | Path,
    profile: CompanyProfile,
    max_contract_value: float = 5_000_000.0,
    min_contract_value: float = 10_000.0,
) -> list[Prospect]:
    """Aggregate award rows into ranked prospect companies.

    Filters to the profile's keywords and regions, and to contract sizes a
    small supplier actually competes for — a $40M prime contract tells you
    nothing about who needs bid help.
    """
    path = Path(awards_csv)
    keywords = [k.lower() for k in profile.keywords]
    wanted_regions = {normalize_region(r) for r in profile.regions} - {""}
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

        for row in reader:
            supplier = (row.get(cols["supplier"]) or "").strip()
            if not supplier:
                continue
            description = (row.get(cols["description"]) or "").lower()
            if not any(keyword in description for keyword in keywords):
                continue

            if wanted_regions and "region" in cols:
                row_regions = {
                    normalize_region(r) for r in split_values(row.get(cols["region"]) or "")
                } - {""}
                if row_regions and not (row_regions & wanted_regions):
                    continue

            value = _to_float(row.get(cols.get("value", ""), "") or "")
            if value and not (min_contract_value <= value <= max_contract_value):
                continue

            key = supplier.upper()
            prospect = prospects.setdefault(key, Prospect(supplier=supplier))
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
                original = (row.get(cols["description"]) or "").strip()
                if original:
                    prospect.samples.append(original[:120])

    ranked = sorted(prospects.values(), key=lambda p: (p.contracts, p.total_value), reverse=True)
    return ranked


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
        print(f"  {canonical:12} -> {detected.get(canonical, '(not found)')}")
    print("\nAll columns (with a sample value):")
    for name in fieldnames:
        sample = str(first.get(name, ""))[:60]
        print(f"  {name}: {sample!r}", file=sys.stdout)
