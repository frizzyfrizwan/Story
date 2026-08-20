"""Parse CanadaBuys open-data tender notice CSVs into Tender records.

The feed is UTF-8 with a BOM and uses bilingual column names
(``title-titre-eng`` etc.). Reference:
https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

# Map of canonical field -> column name in the CanadaBuys CSV.
_COLUMNS = {
    "reference": "referenceNumber-numeroReference",
    "solicitation": "solicitationNumber-numeroSollicitation",
    "title": "title-titre-eng",
    "published": "publicationDate-datePublication",
    "closes": "tenderClosingDate-appelOffresDateCloture",
    "status": "tenderStatus-appelOffresStatut-eng",
    "description": "tenderDescription-descriptionAppelOffres-eng",
    "notice_type": "noticeType-avisType-eng",
    "category": "procurementCategory-categorieApprovisionnement",
    "method": "procurementMethod-methodeApprovisionnement-eng",
    "gsin": "gsin-nibs",
    "unspsc": "unspsc",
    "regions_opportunity": "regionsOfOpportunity-regionAppelOffres-eng",
    "regions_delivery": "regionsOfDelivery-regionsLivraison-eng",
    "entity": "contractingEntityName-nomEntitContractante-eng",
    "selection_criteria": "selectionCriteria-criteresSelection-eng",
    "trade_agreements": "tradeAgreements-accordsCommerciaux-eng",
    "url": "noticeURL-URLavis-eng",
    "attachments": "attachment-piecesJointes-eng",
}


@dataclass
class Tender:
    reference: str = ""
    solicitation: str = ""
    title: str = ""
    published: str = ""
    closes: str = ""
    status: str = ""
    description: str = ""
    notice_type: str = ""
    category: str = ""
    method: str = ""
    gsin: str = ""
    unspsc: str = ""
    regions_opportunity: str = ""
    regions_delivery: str = ""
    entity: str = ""
    selection_criteria: str = ""
    trade_agreements: str = ""
    url: str = ""
    attachments: list[str] = field(default_factory=list)

    @property
    def closing_date(self) -> date | None:
        """Closing timestamp, tolerant of the feed's date formats."""
        raw = self.closes.strip()
        if not raw:
            return None
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(raw[:19], fmt).date()
            except ValueError:
                continue
        # Last resort: leading ISO date, e.g. "2026-09-30T14:00:00-04:00".
        try:
            return date.fromisoformat(raw[:10])
        except ValueError:
            return None

    def days_to_close(self, today: date | None = None) -> int | None:
        closing = self.closing_date
        if closing is None:
            return None
        return (closing - (today or date.today())).days

    @property
    def is_open(self) -> bool:
        return self.status.strip().lower() in {"open", ""}

    def summary_line(self) -> str:
        closes = self.closes[:10] if self.closes else "n/a"
        return f"[{self.reference}] {self.title} — {self.entity} (closes {closes})"


def _row_to_tender(row: dict[str, str]) -> Tender:
    values: dict[str, object] = {}
    for attr, column in _COLUMNS.items():
        raw = (row.get(column) or "").strip()
        if attr == "attachments":
            values[attr] = [part.strip() for part in raw.split(",") if part.strip()]
        else:
            values[attr] = raw
    return Tender(**values)  # type: ignore[arg-type]


def load_tenders(csv_path: str | Path) -> list[Tender]:
    """Load tender notices from a CanadaBuys-format CSV file."""
    path = Path(csv_path)
    # utf-8-sig strips the BOM the feed ships with.
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return [_row_to_tender(row) for row in reader]


def find_tender(tenders: list[Tender], reference: str) -> Tender:
    needle = reference.strip().lower()
    for tender in tenders:
        if needle in {tender.reference.lower(), tender.solicitation.lower()}:
            return tender
    raise KeyError(f"No tender with reference or solicitation number {reference!r}")
