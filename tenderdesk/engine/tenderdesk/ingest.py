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

# CanadaBuys sits behind a WAF that rejects default library user-agents with a
# 403. The data is open (OGL-Canada) — we just have to ask like a browser does.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/csv,application/csv,text/plain,*/*",
    "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.8",
}

_BLOCKED_HELP = """CanadaBuys refused the download (HTTP {status}).

Their bot filter can be stricter on some networks. Workaround — download the
file once in your browser, then scan it directly:

  1. Open: {url}
  2. Save it as: {dest}
  3. Run: tenderdesk scan --csv {dest} --profile <your-profile.toml>

The file is refreshed daily, so re-download it each morning."""


class TenderFeedError(RuntimeError):
    """The tender feed could not be downloaded."""


def download_open_tenders(dest: str | Path, url: str = OPEN_TENDERS_URL) -> Path:
    """Fetch the current open-tenders CSV to ``dest`` and return its path."""
    dest_path = Path(dest)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with httpx.stream(
            "GET", url, timeout=120.0, follow_redirects=True, headers=BROWSER_HEADERS
        ) as response:
            if response.status_code in (403, 406, 429):
                raise TenderFeedError(
                    _BLOCKED_HELP.format(status=response.status_code, url=url, dest=dest_path)
                )
            response.raise_for_status()
            with dest_path.open("wb") as handle:
                for chunk in response.iter_bytes():
                    handle.write(chunk)
    except httpx.HTTPError as exc:  # network/DNS/TLS failures
        raise TenderFeedError(f"Could not reach CanadaBuys: {exc}") from exc
    return dest_path
