"""TenderDesk — AI bid desk for small Canadian suppliers.

Pipeline: ingest (CanadaBuys open data) -> match (deterministic scoring)
-> qualify (Claude bid/no-bid analysis) -> draft (Claude bid package).
"""

__version__ = "0.1.0"

DEFAULT_MODEL = "claude-opus-5"
