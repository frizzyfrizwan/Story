"""Company profile: who the client is and what work they want to win.

Profiles are TOML files (parsed with the stdlib, no extra dependency) —
see profiles/example_contractor.toml for a complete example.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class CompanyProfile:
    name: str
    description: str = ""
    keywords: list[str] = field(default_factory=list)
    negative_keywords: list[str] = field(default_factory=list)
    unspsc_prefixes: list[str] = field(default_factory=list)
    gsin_prefixes: list[str] = field(default_factory=list)
    regions: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    min_days_to_close: int = 5
    capabilities: str = ""
    past_performance: list[str] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)

    def context_block(self) -> str:
        """Render the profile as prompt context for qualification/drafting."""
        lines = [f"Company: {self.name}", f"About: {self.description}"]
        if self.capabilities:
            lines.append(f"Capabilities: {self.capabilities}")
        if self.certifications:
            lines.append("Certifications & registrations: " + "; ".join(self.certifications))
        if self.past_performance:
            lines.append("Past performance:")
            lines.extend(f"  - {item}" for item in self.past_performance)
        if self.regions:
            lines.append("Serves regions: " + ", ".join(self.regions))
        return "\n".join(lines)


def load_profile(path: str | Path) -> CompanyProfile:
    with Path(path).open("rb") as handle:
        data = tomllib.load(handle)
    known = {f for f in CompanyProfile.__dataclass_fields__}
    unknown = set(data) - known
    if unknown:
        raise ValueError(f"Unknown profile keys: {sorted(unknown)}")
    if "name" not in data:
        raise ValueError("Profile must set 'name'")
    return CompanyProfile(**data)
