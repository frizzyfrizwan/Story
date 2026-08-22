"""Prompt builders must ground Claude in the tender and profile facts.

These tests exercise everything up to the API boundary without any
network calls.
"""

from pathlib import Path

import pytest

from tenderdesk.draft import SYSTEM_PROMPT as DRAFT_SYSTEM
from tenderdesk.draft import build_draft_prompt
from tenderdesk.profile import load_profile
from tenderdesk.qualify import build_qualification_prompt
from tenderdesk.tenders import find_tender, load_tenders

ENGINE = Path(__file__).parent.parent


@pytest.fixture()
def tender():
    return find_tender(load_tenders(ENGINE / "data" / "sample_tenders.csv"), "TD-2026-004")


@pytest.fixture()
def profile():
    return load_profile(ENGINE / "profiles" / "example_contractor.toml")


def test_qualification_prompt_grounds_facts(tender, profile):
    prompt = build_qualification_prompt(tender, profile)
    assert "TD-2026-004" in prompt
    assert "Maple Ridge Facility Services" in prompt
    assert "CFB Kingston" in prompt
    assert "COR safety certified" in prompt


def test_draft_prompt_includes_package_structure(tender, profile):
    prompt = build_draft_prompt(tender, profile)
    assert "Compliance Matrix" in prompt
    assert "TD-2026-004-RFP.pdf" in prompt
    assert "Maple Ridge Facility Services" in prompt


def test_draft_system_prompt_bans_fabrication():
    assert "NEVER invent facts" in DRAFT_SYSTEM
    assert "[FILL:" in DRAFT_SYSTEM


def test_profile_rejects_unknown_keys(tmp_path):
    bad = tmp_path / "bad.toml"
    bad.write_text('name = "X"\nfavourite_colour = "red"\n')
    with pytest.raises(ValueError, match="Unknown profile keys"):
        load_profile(bad)
