"""Download CanadaBuys open tender data.

The Government of Canada publishes all open federal tender notices as a
daily CSV under the Open Government Licence — no API key, no scraping:
https://canadabuys.canada.ca/en/support/opendata
"""

from __future__ import annotations

from pathlib import Path

import httpx

OPEN_TENDERS_URL = (
    "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv"
)
# Refreshed every ~2 hours with notices added since the last pull.
NEW_TENDERS_URL = (
    "https://canadabuys.canada.ca/opendata/pub/newTenderNotice-nouvelAvisAppelOffres.csv"
)


def download_open_tenders(dest: str | Path, url: str = OPEN_TENDERS_URL) -> Path:
    """Fetch the current open-tenders CSV to ``dest`` and return its path."""
    dest_path = Path(dest)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with httpx.stream("GET", url, timeout=120.0, follow_redirects=True) as response:
        response.raise_for_status()
        with dest_path.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)
    return dest_path
