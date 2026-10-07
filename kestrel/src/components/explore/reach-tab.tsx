"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, LogIn, Plus, Trash2, Wallet } from "lucide-react";
import { AirlineTail, ProgramLogo } from "@/components/art";
import { Badge, CabinBadge, ProgramChip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { WorldMap, type MapMarker, type MapRoute } from "@/components/viz/world-map";
import { airportDistanceMiles, airportsInRegion, getAirport } from "@/data/airports";
import { getAirline } from "@/data/airlines";
import { BANK_PROGRAMS, PROGRAM_BY_ID, PROGRAMS, getProgram } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { typicalMilesFor } from "@/lib/awards";
import { apiGet, loginHref } from "@/lib/client/api";
import { CABIN_LABEL, type AwardRegion, type Balance, type Cabin, type Deal } from "@/lib/types";
import { planPayment, reachByProgram } from "@/lib/wallet/affordability";
import { cn, fmtCompact, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";
import { ALL_REGIONS, CABIN_VAR, REGION_LABEL, exploreHref, searchHref } from "./format";

const STORAGE_KEY = "kestrel.explore.manual-balances";
const MAX_MANUAL_ROWS = 4;
const CABIN_RANK: readonly Cabin[] = ["first", "business", "premium", "economy"] as const;

interface ManualRow {
  programId: string;
  amount: number;
}

interface ProgramReach {
  id: string;
  total: number;
  direct: number;
  sources: string[];
}

interface RegionReach {
  region: AwardRegion;
  cabin: Cabin | null;
  typical: number;
  program: ProgramReach | null;
  destinations: { iata: string; city: string; lon: number; lat: number; cabin: Cabin }[];
  /** Miles short of economy when nothing is reachable */
  shortfall: number;
}

export interface ReachTabProps {
  origin: string;
  cabin: Cabin;
  signedIn: boolean;
}

/** Balances typed by hand for signed-out visitors, kept in localStorage. */
function useManualBalances() {
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ManualRow[];
        if (Array.isArray(parsed)) setRows(parsed.filter((r) => r && typeof r.programId === "string").slice(0, MAX_MANUAL_ROWS));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  const update = useCallback((next: ManualRow[]) => {
    setRows(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  return { rows, update, hydrated };
}

/** Cabin colours resolved from CSS variables — the map's canvas layer can't read tokens itself. */
function useCabinColors(): Record<Cabin, string> {
  const read = () => {
    if (typeof window === "undefined") return { economy: "#7dd3fc", premium: "#a78bfa", business: "#5eead4", first: "#f5c76a" };
    const cs = getComputedStyle(document.documentElement);
    const get = (v: string, fallback: string) => cs.getPropertyValue(v).trim() || fallback;
    return {
      economy: get(CABIN_VAR.economy, "#7dd3fc"),
      premium: get(CABIN_VAR.premium, "#a78bfa"),
      business: get(CABIN_VAR.business, "#5eead4"),
      first: get(CABIN_VAR.first, "#f5c76a"),
    };
  };
  const [colors, setColors] = useState(read);
  useEffect(() => {
    setColors(read());
    const obs = new MutationObserver(() => setColors(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

function computeReach(origin: string, balances: Balance[]): { programs: ProgramReach[]; regions: RegionReach[] } {
  const reach = reachByProgram(balances, TRANSFER_LINKS);
  const programs: ProgramReach[] = Object.entries(reach)
    .filter(([id]) => PROGRAM_BY_ID[id]?.kind === "airline")
    .map(([id, r]) => ({ id, total: r.total, direct: r.direct, sources: r.sources }))
    .sort((a, b) => b.total - a.total);
  const maxTotal = programs[0]?.total ?? 0;
  const originAirport = getAirport(origin);
  if (!originAirport) return { programs, regions: [] };

  const regions: RegionReach[] = [];
  for (const region of ALL_REGIONS) {
    const reps = airportsInRegion(region)
      .filter((a) => a.iata !== originAirport.iata)
      .map((a) => ({ airport: a, distance: airportDistanceMiles(originAirport, a) }))
      .filter((r) => r.distance >= 250)
      .sort((a, b) => Number(Boolean(b.airport.hub)) - Number(Boolean(a.airport.hub)) || a.distance - b.distance)
      .slice(0, 8);
    if (!reps.length) continue;
    const nearest = reps.reduce((m, r) => (r.distance < m ? r.distance : m), Infinity);

    let picked: { cabin: Cabin; typical: number; program: ProgramReach } | null = null;
    for (const cabin of CABIN_RANK) {
      const typical = typicalMilesFor(cabin, nearest);
      const candidates = programs.filter((p) => p.total >= typical);
      if (candidates.length) {
        // Smallest balance that still covers the trip leaves the richer currencies free.
        const program = candidates.reduce((best, p) => (p.total < best.total ? p : best), candidates[0]);
        picked = { cabin, typical, program };
        break;
      }
    }

    const destinations = picked
      ? reps
          .filter((r) => typicalMilesFor(picked.cabin, r.distance) <= maxTotal)
          .slice(0, 5)
          .map((r) => ({ iata: r.airport.iata, city: r.airport.city, lon: r.airport.lon, lat: r.airport.lat, cabin: picked.cabin }))
      : [];

    regions.push({
      region,
      cabin: picked?.cabin ?? null,
      typical: picked?.typical ?? typicalMilesFor("economy", nearest),
      program: picked?.program ?? null,
      destinations,
      shortfall: picked ? 0 : Math.max(0, typicalMilesFor("economy", nearest) - maxTotal),
    });
  }

  regions.sort((a, b) => {
    const ra = a.cabin ? CABIN_RANK.indexOf(a.cabin) : 99;
    const rb = b.cabin ? CABIN_RANK.indexOf(b.cabin) : 99;
    return ra - rb || a.typical - b.typical || a.shortfall - b.shortfall;
  });
  return { programs, regions };
}

export function ReachTab({ origin, cabin, signedIn }: ReachTabProps) {
  const router = useRouter();
  const colors = useCabinColors();
  const manual = useManualBalances();

  const walletQ = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiGet<{ balances: Balance[] }>("/api/wallet"),
    enabled: signedIn,
    staleTime: 60_000,
  });

  const balances = useMemo<Balance[]>(() => {
    if (signedIn) return walletQ.data?.balances ?? [];
    const now = new Date().toISOString();
    return manual.rows.filter((r) => r.amount > 0).map((r) => ({ programId: r.programId, amount: r.amount, updatedAt: now, source: "manual" as const }));
  }, [signedIn, walletQ.data, manual.rows]);

  const hasBalances = balances.length > 0;
  const { programs, regions } = useMemo(() => computeReach(origin, balances), [origin, balances]);

  const dealsQ = useQuery({
    queryKey: ["explore", "deals", origin || "all", "any"],
    queryFn: () => apiGet<{ deals: Deal[] }>("/api/awards/deals", { origin: origin || undefined, limit: 36 }),
    enabled: hasBalances,
    staleTime: 5 * 60_000,
  });
  const bookable = useMemo(() => {
    const deals = dealsQ.data?.deals ?? [];
    return deals
      .map((d) => ({ deal: d, plan: planPayment(d.programId, d.miles, balances, TRANSFER_LINKS, PROGRAM_BY_ID) }))
      .filter((x) => x.plan.affordable)
      .sort((a, b) => b.deal.cpp - a.deal.cpp)
      .slice(0, 6);
  }, [dealsQ.data, balances]);

  const originAirport = getAirport(origin);
  const markers = useMemo<MapMarker[]>(() => {
    const seen = new Set<string>();
    const out: MapMarker[] = [];
    for (const r of regions) {
      for (const d of r.destinations) {
        if (seen.has(d.iata)) continue;
        seen.add(d.iata);
        out.push({ id: d.iata, lon: d.lon, lat: d.lat, label: d.iata, color: colors[d.cabin], size: d.cabin === cabin ? 7 : 5 });
      }
    }
    if (originAirport) out.push({ id: originAirport.iata, lon: originAirport.lon, lat: originAirport.lat, label: originAirport.iata, color: colors.first, size: 8 });
    return out;
  }, [regions, colors, cabin, originAirport]);
  const routes = useMemo<MapRoute[]>(() => {
    if (!originAirport) return [];
    return markers
      .filter((m) => m.id !== originAirport.iata)
      .slice(0, 30)
      .map((m) => ({ id: `${originAirport.iata}-${m.id}`, from: [originAirport.lon, originAirport.lat], to: [m.lon, m.lat], color: m.color, progress: 1 }));
  }, [markers, originAirport]);
  const focus = useMemo(() => (originAirport ? { center: [originAirport.lon, originAirport.lat] as [number, number], zoom: 1.4 } : null), [originAirport]);
  const cabinByIata = useMemo(() => new Map(regions.flatMap((r) => r.destinations.map((d) => [d.iata, d.cabin] as const))), [regions]);

  const loadingWallet = signedIn && walletQ.isPending;
  const reachable = regions.filter((r) => r.cabin);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Points source ─────────────────────────────────── */}
      {signedIn ? (
        <Panel
          eyebrow="Your reach"
          title={hasBalances ? "Effective balances after transfers" : "Add balances to see your reach"}
          description={hasBalances ? "Direct miles plus everything your bank points can transfer in, with running bonuses applied." : "Your wallet is empty. Add a balance or two and this map lights up."}
          actions={
            <Button size="sm" variant="secondary" href="/wallet" leading={<Wallet />}>
              Wallet
            </Button>
          }
        >
          {loadingWallet ? (
            <div className="flex flex-wrap gap-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-36 rounded-full" />
              ))}
            </div>
          ) : programs.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Reach by program">
              {programs.slice(0, 8).map((p) => {
                const prog = getProgram(p.id);
                return (
                  <li key={p.id} className="inline-flex h-9 items-center gap-2 rounded-full border border-panel-border bg-bg-elev-2 pl-1 pr-3 text-sm">
                    <ProgramLogo id={p.id} name={prog?.name ?? p.id} color={prog?.color} size={26} />
                    <span className="text-fg">{prog?.shortName ?? p.id}</span>
                    <span className="font-mono tnum text-fg-muted">{fmtCompact(p.total).toUpperCase()}</span>
                    {p.sources.length > 0 && <span className="text-[11px] text-fg-subtle">via {p.sources.length}</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Button href="/wallet" leading={<Plus />}>
              Add a balance
            </Button>
          )}
        </Panel>
      ) : (
        <Panel grain eyebrow="Where can I go" title="See what your points can reach" description="Sign in to use your wallet, or type a few balances — we keep them on this device only.">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="flex flex-col items-start gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5">
              <p className="text-sm text-fg-muted">Your wallet already knows your balances, transfer partners and running bonuses.</p>
              <Button href={loginHref("/explore?view=reach")} leading={<LogIn />}>
                Sign in
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {manual.hydrated &&
                manual.rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={row.programId}
                      onValueChange={(programId) => manual.update(manual.rows.map((r, j) => (j === i ? { ...r, programId } : r)))}
                      options={[
                        { label: "Bank points", options: BANK_PROGRAMS.map((p) => ({ value: p.id, label: p.shortName })) },
                        { label: "Airline miles", options: PROGRAMS.filter((p) => p.kind === "airline").map((p) => ({ value: p.id, label: p.shortName })) },
                      ]}
                      aria-label="Program"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      mono
                      value={row.amount || ""}
                      placeholder="Points"
                      aria-label="Balance"
                      className="w-32"
                      onChange={(e) => manual.update(manual.rows.map((r, j) => (j === i ? { ...r, amount: Math.max(0, Number(e.target.value) || 0) } : r)))}
                    />
                    <IconButton label="Remove" size="sm" onClick={() => manual.update(manual.rows.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                ))}
              {manual.hydrated && manual.rows.length < MAX_MANUAL_ROWS && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  leading={<Plus />}
                  onClick={() => manual.update([...manual.rows, { programId: manual.rows.length ? "amex-mr" : "chase-ur", amount: 0 }])}
                >
                  {manual.rows.length ? "Add another" : "Enter points manually"}
                </Button>
              )}
              {hasBalances && programs.length > 0 && (
                <p className="text-xs text-fg-subtle">
                  Reaches {programs.length} airline program{programs.length === 1 ? "" : "s"} · best {getProgram(programs[0].id)?.shortName}{" "}
                  <span className="font-mono tnum">{fmtCompact(programs[0].total).toUpperCase()}</span>
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* ── Map + regions ─────────────────────────────────── */}
      {!originAirport ? (
        <EmptyState compact title="Pick an origin above" description="We rank every region by the cheapest typical award from your home airport." />
      ) : !hasBalances && !loadingWallet ? (
        <EmptyState
          compact
          title="No balances yet"
          description={signedIn ? "Add your points in the wallet and come back — the map draws every destination you can afford." : "Enter a balance above to light up the map."}
        />
      ) : (
        <>
          <Panel padding="none" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-6">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">Reachable from {originAirport.iata}</p>
                <h3 className="font-display text-lg tracking-tight sm:text-xl">
                  {reachable.length ? `${reachable.length} region${reachable.length === 1 ? "" : "s"} within reach` : "Nothing in reach yet"}
                </h3>
              </div>
              <ul className="flex flex-wrap items-center gap-3 text-[11px] text-fg-subtle" aria-label="Legend">
                {CABIN_RANK.map((c) => (
                  <li key={c} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: `var(${CABIN_VAR[c]})` }} aria-hidden="true" />
                    {CABIN_LABEL[c]}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 border-t border-panel-border">
              <WorldMap
                className="h-[360px] sm:h-[440px]"
                markers={markers}
                routes={routes}
                focus={focus}
                ariaLabel="Destinations reachable with your points"
                renderTooltip={(hit) =>
                  hit.kind === "marker" ? (
                    <span className="font-mono text-xs">
                      {hit.item.label}
                      {cabinByIata.get(hit.item.id ?? "") ? ` · ${CABIN_LABEL[cabinByIata.get(hit.item.id ?? "") as Cabin]}` : ""}
                    </span>
                  ) : null
                }
                onClick={(hit) => {
                  if (hit?.kind === "marker" && hit.item.id && hit.item.id !== originAirport.iata) {
                    router.push(exploreHref({ view: "calendar", from: originAirport.iata, to: hit.item.id, cabin: cabinByIata.get(hit.item.id) ?? cabin }));
                  }
                }}
              />
            </div>
          </Panel>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Regions by reach">
            {regions.map((r) => {
              const prog = r.program ? getProgram(r.program.id) : undefined;
              const via = r.program?.sources.map((s) => getProgram(s)?.shortName ?? s) ?? [];
              return (
                <li
                  key={r.region}
                  className={cn(
                    "flex flex-col gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-4 shadow-panel",
                    !r.cabin && "opacity-70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-display text-lg leading-tight tracking-tight">{REGION_LABEL[r.region]}</h4>
                      {r.cabin ? (
                        <p className="mt-1 text-sm text-fg-muted">
                          {CABIN_LABEL[r.cabin]} from <span className="font-mono tnum text-fg">{fmtCompact(r.typical).toUpperCase()}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-fg-subtle">
                          ~<span className="font-mono tnum">{fmtCompact(r.shortfall).toUpperCase()}</span> short of economy
                        </p>
                      )}
                    </div>
                    {r.cabin ? <CabinBadge cabin={r.cabin} short /> : <Badge variant="outline">Out of reach</Badge>}
                  </div>
                  {prog && r.program && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                      <ProgramChip id={prog.id} name={prog.shortName} color={prog.color} size="sm" />
                      {via.length > 0 && <span>via {via.join(", ")}</span>}
                      {r.program.direct > 0 && via.length === 0 && <span>direct balance</span>}
                    </div>
                  )}
                  {r.destinations.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Example destinations">
                      {r.destinations.map((d) => (
                        <li key={d.iata}>
                          <Link
                            href={exploreHref({ view: "calendar", from: originAirport.iata, to: d.iata, cabin: d.cabin })}
                            className={cn(
                              "inline-flex h-7 items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-2 pl-2.5 pr-2 text-xs text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
                              focusRing,
                            )}
                            title={`${d.city} — view calendar`}
                          >
                            <span className="font-mono font-semibold tracking-wide text-fg">{d.iata}</span>
                            <span className="max-w-[9ch] truncate">{d.city}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <Panel
            eyebrow="Book now"
            title="Deals you can book with your points"
            description={bookable.length ? "Today's scanner picks that your balances already cover." : undefined}
          >
            {dealsQ.isPending ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : bookable.length === 0 ? (
              <p className="text-sm text-fg-muted">
                None of today&apos;s scanner picks fit your balances.{" "}
                <Link href={exploreHref({ view: "deals", from: origin, cabin })} className="text-signal underline-offset-4 hover:underline">
                  Browse every deal
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-panel-border" aria-label="Bookable deals">
                {bookable.map(({ deal, plan }) => {
                  const prog = getProgram(deal.programId);
                  const via = plan.transfers.map((t) => getProgram(t.from)?.shortName ?? t.from);
                  return (
                    <li key={deal.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                      <AirlineTail code={deal.carrier} color={getAirline(deal.carrier)?.color} size={22} />
                      <span className="font-mono font-semibold tracking-wide">
                        {deal.origin}
                        <span className="mx-1 text-fg-subtle">→</span>
                        {deal.destination}
                      </span>
                      <CabinBadge cabin={deal.cabin} short size="sm" />
                      {prog && <ProgramChip id={prog.id} name={prog.shortName} color={prog.color} size="sm" />}
                      <span className="font-mono tnum text-fg">
                        {fmtInt(deal.miles)} <span className="text-fg-subtle">+ {fmtUsd(deal.taxesUsd)}</span>
                      </span>
                      <span className="text-xs text-fg-subtle">{via.length ? `via ${via.join(" + ")}` : "direct"}</span>
                      {deal.dates[0] && <span className="text-xs text-fg-subtle">{fmtDate(deal.dates[0])}</span>}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        href={searchHref({ from: deal.origin, to: deal.destination, date: deal.dates[0], cabin: deal.cabin })}
                        trailing={<ArrowRight />}
                      >
                        Search
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
