"""TenderDesk command line.

Examples (from the engine/ directory):

    # Rank sample tenders against the example client profile — free, offline
    tenderdesk scan --csv data/sample_tenders.csv --profile profiles/example_contractor.toml

    # Same, but against today's live CanadaBuys feed
    tenderdesk scan --live --profile profiles/example_contractor.toml

    # Claude bid/no-bid verdict on one tender (needs ANTHROPIC_API_KEY)
    tenderdesk qualify --csv data/sample_tenders.csv --profile profiles/example_contractor.toml --ref TD-2026-004

    # Full drafted bid package to out/<ref>.md (needs ANTHROPIC_API_KEY)
    tenderdesk draft --csv data/sample_tenders.csv --profile profiles/example_contractor.toml --ref TD-2026-004
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .ingest import TenderFeedError, download_open_tenders
from .match import rank_tenders
from .profile import load_profile
from .tenders import find_tender, load_tenders

LIVE_CACHE = Path("data/live_open_tenders.csv")


def _load(args: argparse.Namespace):
    if getattr(args, "live", False):
        print("Downloading current open tenders from CanadaBuys...", file=sys.stderr)
        csv_path = download_open_tenders(LIVE_CACHE)
        print(f"Saved to {csv_path}", file=sys.stderr)
    else:
        csv_path = Path(args.csv)
    tenders = load_tenders(csv_path)
    profile = load_profile(args.profile)
    return tenders, profile


def cmd_scan(args: argparse.Namespace) -> int:
    tenders, profile = _load(args)
    results = rank_tenders(tenders, profile, min_score=args.min_score)[: args.top]
    if args.json:
        payload = [
            {
                "reference": r.tender.reference,
                "title": r.tender.title,
                "entity": r.tender.entity,
                "closes": r.tender.closes,
                "url": r.tender.url,
                "score": r.score,
                "reasons": r.reasons,
            }
            for r in results
        ]
        print(json.dumps(payload, indent=2))
        return 0
    if not results:
        print(f"No matches ≥ {args.min_score} for {profile.name} in {len(tenders)} tenders.")
        return 0
    print(f"{len(results)} match(es) for {profile.name} (scanned {len(tenders)} tenders):\n")
    for rank, result in enumerate(results, 1):
        print(f"{rank}. [{result.score:g}] {result.tender.summary_line()}")
        for reason in result.reasons:
            print(f"     {reason}")
        if result.tender.url:
            print(f"     {result.tender.url}")
        print()
    return 0


def cmd_prospects(args: argparse.Namespace) -> int:
    from .awards import (
        CONTRACT_HISTORY_PAGE,
        find_prospects,
        inspect_columns,
        write_prospect_csv,
    )

    if args.inspect:
        inspect_columns(args.awards)
        return 0
    if not Path(args.awards).exists():
        print(
            f"Award file not found: {args.awards}\n\n"
            f"Download contractHistoryComplete-contratsOctroyesComplet.csv from:\n"
            f"  {CONTRACT_HISTORY_PAGE}\n"
            f"then pass it with --awards <file>.",
            file=sys.stderr,
        )
        return 2
    profile = load_profile(args.profile)
    print(f"Scanning award history for {profile.name}'s trade...", file=sys.stderr)
    all_prospects = find_prospects(
        args.awards,
        profile,
        max_contract_value=args.max_value,
        max_employees=args.max_employees,
        city=args.city,
        progress=True,
    )
    prospects = all_prospects[: args.top]

    if args.csv_out:
        out = write_prospect_csv(all_prospects, args.csv_out)
        print(f"Wrote {len(all_prospects)} prospects to {out}", file=sys.stderr)

    if args.json:
        print(
            json.dumps(
                [
                    {
                        "supplier": p.supplier,
                        "operating_name": p.operating_name,
                        "employees": p.employees,
                        "city": p.city,
                        "province": p.province,
                        "mailing_address": p.mailing_address,
                        "contracts": p.contracts,
                        "total_value": p.total_value,
                        "average_value": p.average_value,
                        "latest_date": p.latest_date,
                        "buyers": sorted(p.buyers),
                        "samples": p.samples,
                    }
                    for p in prospects
                ],
                indent=2,
            )
        )
        return 0
    if not prospects:
        print("No prospects matched. Try --inspect to check column detection.")
        return 0
    print(f"\n{len(all_prospects)} prospect(s) found; showing top {len(prospects)}:\n")
    for rank, p in enumerate(prospects, 1):
        name = p.supplier
        if p.operating_name and p.operating_name.upper() != p.supplier.upper():
            name += f"  (trading as {p.operating_name})"
        print(f"{rank}. {name}")
        details = [f"{p.contracts} contract(s)", f"${p.total_value:,.0f} total"]
        if p.employees:
            details.append(p.employees)
        print(f"     {' | '.join(details)}")
        if p.location:
            print(f"     {p.mailing_address}")
        if p.latest_date:
            print(f"     latest award: {p.latest_date}")
        if p.buyers:
            print(f"     buyers: {', '.join(sorted(p.buyers)[:2])}")
        for sample in p.samples[:1]:
            print(f"     e.g. {sample}")
        print()
    return 0


def cmd_qualify(args: argparse.Namespace) -> int:
    from .qualify import qualify  # deferred: needs the anthropic client

    tenders, profile = _load(args)
    tender = find_tender(tenders, args.ref)
    print(f"Qualifying with Claude: {tender.summary_line()}", file=sys.stderr)
    decision = qualify(tender, profile, model=args.model)
    print(json.dumps(decision.model_dump(), indent=2))
    return 0


def cmd_draft(args: argparse.Namespace) -> int:
    from .draft import draft_package  # deferred: needs the anthropic client

    tenders, profile = _load(args)
    tender = find_tender(tenders, args.ref)
    print(f"Drafting bid package with Claude: {tender.summary_line()}", file=sys.stderr)
    package = draft_package(tender, profile, model=args.model)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_ref = "".join(c if c.isalnum() or c in "-_." else "_" for c in tender.reference)
    out_path = out_dir / f"{safe_ref}.md"
    out_path.write_text(package, encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--csv", default="data/sample_tenders.csv", help="Tender CSV path")
    parser.add_argument("--live", action="store_true", help="Download the live CanadaBuys feed")
    parser.add_argument("--profile", required=True, help="Company profile TOML")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tenderdesk", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    scan = sub.add_parser("scan", help="Rank tenders against a company profile (free, no API)")
    _add_common(scan)
    scan.add_argument("--top", type=int, default=10)
    scan.add_argument("--min-score", type=float, default=3.0)
    scan.add_argument("--json", action="store_true")
    scan.set_defaults(func=cmd_scan)

    prospects_p = sub.add_parser(
        "prospects", help="Find companies to sell to, from federal award history"
    )
    prospects_p.add_argument("--awards", default="data/contract_history.csv")
    prospects_p.add_argument("--profile", help="Company profile TOML (the trade you target)")
    prospects_p.add_argument("--top", type=int, default=25)
    prospects_p.add_argument("--max-value", type=float, default=5_000_000.0)
    prospects_p.add_argument(
        "--max-employees", type=int, default=None, help="Only firms this size or smaller"
    )
    prospects_p.add_argument("--city", default=None, help="Only suppliers based in this city")
    prospects_p.add_argument("--csv-out", default=None, help="Write the full list to a spreadsheet")
    prospects_p.add_argument("--json", action="store_true")
    prospects_p.add_argument(
        "--inspect", action="store_true", help="Print the file's columns and detected mapping"
    )
    prospects_p.set_defaults(func=cmd_prospects)

    qualify_p = sub.add_parser("qualify", help="Claude bid/no-bid verdict on one tender")
    _add_common(qualify_p)
    qualify_p.add_argument("--ref", required=True, help="Tender reference number")
    qualify_p.add_argument("--model", default=None, help="Override Claude model")
    qualify_p.set_defaults(func=cmd_qualify)

    draft_p = sub.add_parser("draft", help="Generate a full bid package for one tender")
    _add_common(draft_p)
    draft_p.add_argument("--ref", required=True, help="Tender reference number")
    draft_p.add_argument("--model", default=None, help="Override Claude model")
    draft_p.add_argument("--out", default="out", help="Output directory")
    draft_p.set_defaults(func=cmd_draft)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except TenderFeedError as exc:
        print(f"\n{exc}\n", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
