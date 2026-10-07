"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Landmark, SlidersHorizontal } from "lucide-react";
import type { ProgramKind, TransferLink } from "@/lib/types";
import { apiGet } from "@/lib/client/api";
import { cn, todayISO } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented";
import { Section } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { focusRing } from "@/components/ui/tokens";
import { AllianceBadge } from "@/components/programs/program-meta";
import { BankExplainer } from "./bank-explainer";
import { LiveBonuses } from "./live-bonuses";
import { BonusPill, TransferCell, TransferDetails, type ProgramLite } from "./transfer-cell";
import { TransferTimeIcon } from "./transfer-time-icon";
import { ALLIANCE_RANK, BANK_LABEL, BANK_ORDER, TRANSFER_TIME_META, fmtRatio, isBonusActive, type BankId } from "./transfer-utils";

type BankFilter = "all" | BankId;
type KindFilter = "all" | Extract<ProgramKind, "airline" | "hotel">;

interface ProgramsResponse {
  programs: unknown[];
  transfers: TransferLink[];
}

export interface TransferMatrixProps {
  /** Static links, rendered immediately; replaced by the API response (DB-merged bonuses) when it lands. */
  initialLinks: TransferLink[];
  programs: Record<string, ProgramLite>;
}

export function TransferMatrix({ initialLinks, programs }: TransferMatrixProps) {
  const asOf = todayISO();
  const { data, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["programs", "transfers"],
    queryFn: () => apiGet<ProgramsResponse>("/api/programs"),
    staleTime: 10 * 60_000,
  });
  const links = data?.transfers ?? initialLinks;

  const [bank, setBank] = useState<BankFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [onlyBonus, setOnlyBonus] = useState(false);
  const q = useDeferredValue(query.trim().toLowerCase());

  const columns = useMemo(() => (bank === "all" ? [...BANK_ORDER] : [bank]).filter((b) => programs[b]), [bank, programs]);

  const rows = useMemo(() => {
    const byDest = new Map<string, Map<string, TransferLink>>();
    for (const l of links) {
      if (!programs[l.to] || !programs[l.from]) continue;
      (byDest.get(l.to) ?? byDest.set(l.to, new Map()).get(l.to)!).set(l.from, l);
    }
    const out = [...byDest.entries()]
      .map(([id, sources]) => ({ dest: programs[id], sources }))
      .filter(({ dest, sources }) => {
        if (kind !== "all" && dest.kind !== kind) return false;
        if (q && !`${dest.name} ${dest.shortName} ${dest.id}`.toLowerCase().includes(q)) return false;
        const visible = columns.map((b) => sources.get(b)).filter((l): l is TransferLink => Boolean(l));
        if (!visible.length) return false;
        if (onlyBonus && !visible.some((l) => isBonusActive(l, asOf))) return false;
        return true;
      });
    out.sort((a, b) => {
      if (a.dest.kind !== b.dest.kind) return a.dest.kind === "airline" ? -1 : 1;
      const ra = ALLIANCE_RANK[a.dest.alliance ?? "none"] ?? 9;
      const rb = ALLIANCE_RANK[b.dest.alliance ?? "none"] ?? 9;
      return ra - rb || a.dest.name.localeCompare(b.dest.name);
    });
    return out;
  }, [links, programs, kind, q, columns, onlyBonus, asOf]);

  const activeBonusCount = links.filter((l) => isBonusActive(l, asOf)).length;
  const filtersActive = (bank !== "all" ? 1 : 0) + (kind !== "all" ? 1 : 0) + (q ? 1 : 0) + (onlyBonus ? 1 : 0);
  const reset = () => {
    setBank("all");
    setKind("all");
    setQuery("");
    setOnlyBonus(false);
  };

  const bankOptions: { value: BankFilter; label: string }[] = [
    { value: "all", label: "All banks" },
    ...BANK_ORDER.map((b) => ({ value: b, label: BANK_LABEL[b] })),
  ];

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-4">
        {/* ── Toolbar ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SegmentedControl<BankFilter> value={bank} onChange={setBank} options={bankOptions} size="sm" aria-label="Bank" className="max-w-full" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Find a program…"
              aria-label="Find a destination program"
              size="sm"
              wrapperClassName="sm:max-w-xs"
            />
            <SegmentedControl<KindFilter>
              value={kind}
              onChange={setKind}
              size="sm"
              aria-label="Program kind"
              options={[
                { value: "all", label: "Airlines + hotels" },
                { value: "airline", label: "Airlines" },
                { value: "hotel", label: "Hotels" },
              ]}
            />
            <div className="flex items-center gap-3 sm:ml-auto">
              <Switch
                size="sm"
                checked={onlyBonus}
                onCheckedChange={setOnlyBonus}
                label={
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    Only with active bonus
                    {activeBonusCount > 0 && (
                      <Badge variant="aurora" size="sm" dot pulse>
                        {activeBonusCount}
                      </Badge>
                    )}
                  </span>
                }
                className="min-h-9"
                controlFirst
              />
              {filtersActive > 0 && (
                <Button variant="ghost" size="sm" onClick={reset} leading={<SlidersHorizontal />}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
          <span className="font-mono tnum">
            {rows.length} {rows.length === 1 ? "program" : "programs"} · {columns.length} {columns.length === 1 ? "bank" : "banks"}
          </span>
          <span className="inline-flex items-center gap-1">
            <TransferTimeIcon time="instant" /> instant
          </span>
          <span className="inline-flex items-center gap-1">
            <TransferTimeIcon time="hours" /> hours
          </span>
          <span className="inline-flex items-center gap-1">
            <TransferTimeIcon time="1-2 days" /> days
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-aurora" aria-hidden="true" /> bonus running
          </span>
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.14em]">
            {isFetching && !data ? "syncing bonuses…" : dataUpdatedAt ? "live bonuses synced" : "static matrix"}
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            description={onlyBonus ? "No bonus is running for that combination right now." : "Try another bank or clear the search."}
            action={
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* ── Desktop matrix ────────────────────────────── */}
            <div className="relative hidden max-h-[78vh] overflow-auto rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 scrollbar-thin md:block">
              <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-30 border-b border-r border-panel-border-strong bg-bg-elev-1 px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-fg-subtle"
                    >
                      Destination program
                    </th>
                    {columns.map((b) => (
                      <th
                        key={b}
                        scope="col"
                        className="sticky top-0 z-20 border-b border-panel-border-strong bg-bg-elev-1 px-2 py-2.5 text-center"
                      >
                        <span className="inline-flex flex-col items-center gap-1">
                          <ProgramLogo id={b} name={programs[b].shortName} color={programs[b].color} size={28} />
                          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-muted">{BANK_LABEL[b]}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ dest, sources }, i) => {
                    const prev = rows[i - 1]?.dest;
                    const newGroup = !prev || prev.kind !== dest.kind || (dest.kind === "airline" && prev.alliance !== dest.alliance);
                    return (
                      <tr key={dest.id} className="group/row">
                        <th
                          scope="row"
                          className={cn(
                            "sticky left-0 z-10 border-b border-r border-panel-border bg-bg-elev-1 px-4 py-2 text-left font-normal group-hover/row:bg-bg-elev-2",
                            newGroup && i > 0 && "border-t border-t-panel-border-strong",
                          )}
                        >
                          <Link href={`/programs/${dest.id}`} prefetch={false} className={cn("flex items-center gap-2.5 rounded-full", focusRing)}>
                            <ProgramLogo id={dest.id} name={dest.shortName} color={dest.color} size={30} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-fg">{dest.name}</span>
                              <span className="mt-0.5 flex items-center gap-1.5">
                                <AllianceBadge alliance={dest.kind === "airline" ? (dest.alliance ?? "none") : undefined} short />
                                {dest.kind === "hotel" && (
                                  <Badge variant="outline" size="sm">
                                    Hotel
                                  </Badge>
                                )}
                              </span>
                            </span>
                          </Link>
                        </th>
                        {columns.map((b) => (
                          <td
                            key={b}
                            className={cn(
                              "border-b border-panel-border p-1 text-center align-middle group-hover/row:bg-bg-elev-2/60",
                              newGroup && i > 0 && "border-t border-t-panel-border-strong",
                            )}
                          >
                            <TransferCell link={sources.get(b)} bank={programs[b]} dest={dest} asOf={asOf} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ──────────────────────────────── */}
            <ul className="flex flex-col gap-3 md:hidden">
              {rows.map(({ dest, sources }) => (
                <li key={dest.id} className="rounded-[var(--radius)] border border-panel-border bg-bg-elev-1">
                  <Link href={`/programs/${dest.id}`} prefetch={false} className={cn("flex items-center gap-3 border-b border-panel-border px-4 py-3", focusRing)}>
                    <ProgramLogo id={dest.id} name={dest.shortName} color={dest.color} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{dest.name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <AllianceBadge alliance={dest.kind === "airline" ? (dest.alliance ?? "none") : undefined} short />
                        {dest.kind === "hotel" && (
                          <Badge variant="outline" size="sm">
                            Hotel
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                  <ul className="divide-y divide-panel-border">
                    {columns
                      .filter((b) => sources.get(b))
                      .map((b) => {
                        const link = sources.get(b)!;
                        return (
                          <li key={b}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={cn("flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-fg/[0.03]", focusRing)}
                                  aria-label={`${BANK_LABEL[b]} to ${dest.shortName}: ${fmtRatio(link.ratio)}, ${TRANSFER_TIME_META[link.transferTime].label}`}
                                >
                                  <ProgramLogo id={b} name={programs[b].shortName} color={programs[b].color} size={24} />
                                  <span className="flex-1 text-[13px] text-fg">{BANK_LABEL[b]}</span>
                                  <BonusPill link={link} asOf={asOf} />
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className={cn("font-mono tnum text-sm font-medium", link.ratio[1] / link.ratio[0] > 1 ? "text-aurora" : "text-fg")}>
                                      {fmtRatio(link.ratio)}
                                    </span>
                                    <TransferTimeIcon time={link.transferTime} />
                                  </span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                                <TransferDetails link={link} bank={programs[b]} dest={dest} asOf={asOf} />
                              </PopoverContent>
                            </Popover>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Section
        eyebrow="Live bonuses"
        title="Bonuses running right now"
        description="Sorted by expiry. Transfers are irreversible, so only move points once award space is confirmed."
        size="sm"
        actions={
          <Badge variant={activeBonusCount ? "aurora" : "neutral"} size="md" dot pulse={activeBonusCount > 0} icon={<CalendarClock />}>
            {activeBonusCount} active
          </Badge>
        }
      >
        <LiveBonuses links={links} programs={programs} asOf={asOf} />
      </Section>

      <Section
        eyebrow="Best ways to get each currency"
        title="What each bank does that the others can't"
        description="Partners exclusive to a single bank, plus the ratios where a point becomes more than a point."
        size="sm"
        actions={
          <Button href="/programs" variant="ghost" size="sm" leading={<Landmark />}>
            All programs
          </Button>
        }
      >
        <BankExplainer links={links} programs={programs} asOf={asOf} />
      </Section>
    </div>
  );
}
