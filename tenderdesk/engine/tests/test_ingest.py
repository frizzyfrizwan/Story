"""Feed download behaviour, exercised against a mock transport (no network)."""

import httpx
import pytest

from tenderdesk import ingest
from tenderdesk.ingest import BROWSER_HEADERS, TenderFeedError, download_open_tenders

CSV_BODY = b"\xef\xbb\xbfreferenceNumber-numeroReference\r\nTD-1\r\n"


def _patch_stream(monkeypatch, handler):
    """Route httpx.stream through a MockTransport running ``handler``."""

    def fake_stream(method, url, **kwargs):
        transport = httpx.MockTransport(handler)
        client = httpx.Client(transport=transport)
        return client.stream(method, url, **kwargs)

    monkeypatch.setattr(ingest.httpx, "stream", fake_stream)


def test_sends_browser_user_agent(monkeypatch, tmp_path):
    """CanadaBuys' WAF 403s default library agents — we must look like a browser."""
    seen = {}

    def handler(request):
        seen.update(request.headers)
        return httpx.Response(200, content=CSV_BODY)

    _patch_stream(monkeypatch, handler)
    dest = download_open_tenders(tmp_path / "open.csv")
    assert dest.read_bytes() == CSV_BODY
    assert seen["user-agent"] == BROWSER_HEADERS["User-Agent"]


def test_403_raises_actionable_error(monkeypatch, tmp_path):
    _patch_stream(monkeypatch, lambda request: httpx.Response(403, text="denied"))
    with pytest.raises(TenderFeedError) as excinfo:
        download_open_tenders(tmp_path / "open.csv")
    message = str(excinfo.value)
    # The message must tell the user how to get unblocked, not just fail.
    assert "403" in message
    assert "--csv" in message


def test_network_failure_is_wrapped(monkeypatch, tmp_path):
    def handler(request):
        raise httpx.ConnectError("no route to host")

    _patch_stream(monkeypatch, handler)
    with pytest.raises(TenderFeedError, match="Could not reach CanadaBuys"):
        download_open_tenders(tmp_path / "open.csv")
