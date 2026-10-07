"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeftRight, ArrowRight, BellPlus, Compass } from "lucide-react";
import { ProgramLogo } from "@/components/art";
import { Badge, SourceBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { AirportCombobox } from "@/components/ui/airport-combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat";
import { focusRing } from "@/components/ui/tokens";
import { AvailabilityCalendar, type AvailabilityDayCell, type AvailabilityLevel } from "@/components/viz/availability-heat";
import { getAirline } from "@/data/airlines";
import { getProgram } from "@/data/programs";
import { apiGet } from "@/lib/client/api";
import { CABIN_LABEL, type AvailabilityDay, type Cabin, type RouteAvailability } from "@/lib/types";
import { addDays, cn, fmtCompact, fmtDate, fmtInt, fmtUsd, todayISO } from "@/lib/utils";
import { fetchAirports, POPULAR_ORIGINS, SUGGESTED_ROUTES } from "./airports";
import { searchHref } from "./format";

const WINDOW_DAYS = 92;

export interface CalendarTabProps {
  origin: string;
  destination: string;
  cabin: Cabin;
  onRouteChange: (from: string, to: string) => void;
}

interface DayAgg {
  date: string;
  minMiles: number;
  taxesUsd: number;
  maxSeats: number;
  programs: Set<string>;
  bestProgram: string;
  carrier: string;
}

interface ProgramRow {
  programId: string;
  days: number;
  minMiles: number;
  typicalTaxes: number;
  carriers: string[];
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Collapse per-program rows into one record per date (cheapest program wins the cell). */
function aggregate(days: AvailabilityDay[]) {
  const byDate = new Map<string, DayAgg>();
  const byProgram = new Map<string, { dates: Set<string>; minMiles: number; taxes: number[]; carriers: Set<string> }>();
  for (const d of days) {
    if (d.seats <= 0) continue;
    const cur = byDate.get(d.date);
    if (!cur) {
      byDate.set(d.date, { date: d.date, minMiles: d.miles, taxesUsd: d.taxesUsd, maxSeats: d.seats, programs: new Set([d.programId]), bestProgram: d.programId, carrier: d.carrier });
    } else {
      cur.programs.add(d.programId);
      cur.maxSeats = Math.max(cur.maxSeats, d.seats);
      if (d.miles < cur.minMiles) {
        cur.minMiles = d.miles;
        cur.taxesUsd = d.taxesUsd;
        cur.bestProgram = d.programId;
        cur.carrier = d.carrier;
      }
    }
    const p = byProgram.get(d.programId) ?? { dates: new Set<string>(), minMiles: Infinity, taxes: [], carriers: new Set<string>() };
    p.dates.add(d.date);
    p.minMiles = Math.min(p.minMiles, d.miles);
    p.taxes.push(d.taxesUsd);
    p.carriers.add(d.carrier);
    byProgram.set(d.programId, p);
  }

  const aggs = Array.from(byDate.values());
  const milesSorted = aggs.map((a) => a.minMiles).sort((a, b) => a - b);
  const pct = (m: number) => (milesSorted.length <= 1 ? 0 : milesSorted.findIndex((v) => v >= m) / (milesSorted.length - 1));

  const cells: AvailabilityDayCell[] = aggs.map((a) => {
    const seatScore = a.maxSeats >= 4 ? 2 : a.maxSeats >= 2 ? 1 : 0;
    const p = pct(a.minMiles);
    const milesScore = p <= 0.34 ? 2 : p <= 0.67 ? 1 : 0;
    const level = Math.min(4, Math.max(1, 1 + Math.round(((seatScore + milesScore) / 4) * 3))) as AvailabilityLevel;
    return { date: a.date, level, miles: a.minMiles, seats: a.maxSeats };
  });

  const cheapest = aggs.reduce<DayAgg | null>((best, a) => (!best || a.minMiles < best.minMiles || (a.minMiles === best.minMiles && a.maxSeats > best.maxSeats) ? a : best), null);
  const medianMiles = median(aggs.map((a) => a.minMiles));

  const programs: ProgramRow[] = Array.from(byProgram.entries())
    .map(([programId, p]) => ({ programId, days: p.dates.size, minMiles: p.minMiles, typicalTaxes: median(p.taxes), carriers: Array.from(p.carriers) }))
    .sort((a, b) => b.days - a.days || a.minMiles - b.minMiles);

  const best = programs[0] ?? null;
  return { cells, cheapest, medianMiles, daysWithSpace: aggs.length, programs, bestProgram: best };
}

export function CalendarTab({ origin, destination, cabin, onRouteChange }: CalendarTabProps) {
  const router = useRouter();
  const today = todayISO();
  const to = addDays(today, WINDOW_DAYS);
  const ready = Boolean(origin && destination && origin !== destination);

  const availQ = useQuery({
    queryKey: ["explore", "availability", origin, destination, cabin, today],
    queryFn: () => apiGet<RouteAvailability>("/api/awards/availability", { origin, destination, cabin, from: today, to }),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const data = useMemo(() => aggregate(availQ.data?.days ?? []), [availQ.data]);
  const bestProgram = data.bestProgram ? getProgram(data.bestProgram.programId) : undefined;
  const loading = ready && availQ.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex h-11 items-center gap-2 rounded-full border border-panel-border bg-bg-elev-1 px-4 font-mono text-sm">
          <span className="text-[10px] uppercase tracking-[0.18em] text-fg-subtle">From</span>
          <span className={cn("font-semibold", origin ? "text-fg" : "text-fg-subtle")}>{origin || "—"}</span>
        </div>
        <IconButton
          label="Swap origin and destination"
          variant="secondary"
          size="md"
          onClick={() => onRouteChange(destination, origin)}
          disabled={!origin && !destination}
        >
          <ArrowLeftRight />
        </IconButton>
        <Field label="To" labelHidden className="w-full min-w-[220px] sm:w-72">
          <AirportCombobox
            value={destination ? [destination] : []}
            onChange={(codes) => onRouteChange(origin, codes[0] ?? "")}
            fetcher={fetchAirports}
            placeholder="Destination"
            recent={POPULAR_ORIGINS.filter((c) => c !== origin)}
            label="Destination"
          />
        </Field>
        {ready && availQ.data && <SourceBadge source={availQ.data.source} className="mb-3" />}
      </div>

      {!ready ? (
        <Panel padding="lg" grain>
          <EmptyState
            compact
            title={origin ? `Where to from ${origin}?` : "Pick a route to see 90 days of award space"}
            description="Every day in the next three months, coloured by how much space we found and priced at the cheapest program."
          >
            <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Suggested routes">
              {SUGGESTED_ROUTES.map(([f, t]) => (
                <li key={`${f}-${t}`}>
                  <button
                    type="button"
                    onClick={() => onRouteChange(f, t)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-2 px-3.5 font-mono text-xs font-semibold tracking-wide text-fg transition-colors hover:border-panel-border-strong hover:bg-bg-elev-3",
                      focusRing,
                    )}
                  >
                    {f}
                    <ArrowRight className="size-3 text-fg-subtle" aria-hidden="true" />
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Cheapest day"
              tone="aurora"
              loading={loading}
              value={data.cheapest ? fmtCompact(data.cheapest.minMiles).toUpperCase() : "—"}
              hint={data.cheapest ? `${fmtDate(data.cheapest.date)} · + ${fmtUsd(data.cheapest.taxesUsd)}` : "No space found"}
            />
            <StatTile
              label="Median miles"
              tone="signal"
              loading={loading}
              value={data.daysWithSpace ? fmtCompact(data.medianMiles).toUpperCase() : "—"}
              hint={data.daysWithSpace ? `${CABIN_LABEL[cabin]} one-way` : undefined}
            />
            <StatTile
              label="Days with space"
              tone="sky"
              loading={loading}
              value={data.daysWithSpace}
              format={fmtInt}
              hint={`of ${WINDOW_DAYS + 1} scanned`}
            />
            <StatTile
              label="Best program"
              tone="gold"
              loading={loading}
              value={
                bestProgram ? (
                  <span className="flex items-center gap-2 text-lg">
                    <ProgramLogo id={bestProgram.id} name={bestProgram.name} color={bestProgram.color} size={28} />
                    <span className="truncate font-sans font-medium tracking-normal">{bestProgram.shortName}</span>
                  </span>
                ) : (
                  "—"
                )
              }
              hint={data.bestProgram ? `${fmtInt(data.bestProgram.days)} days · from ${fmtCompact(data.bestProgram.minMiles).toUpperCase()}` : undefined}
            />
          </div>

          <Panel
            eyebrow="Award calendar"
            title={
              <span className="font-mono text-base tracking-wide sm:text-lg">
                {origin} <span className="text-fg-subtle">→</span> {destination}
                <span className="ml-3 font-sans text-sm font-normal text-fg-muted">{CABIN_LABEL[cabin]} · next 90 days</span>
              </span>
            }
            description="Click a day to search it. Cells show the cheapest program's miles; dots are seats."
            actions={
              <Button size="sm" variant="secondary" href={`/alerts?new=1&from=${origin}&to=${destination}&cabin=${cabin}&dateFrom=${today}&dateTo=${to}`} leading={<BellPlus />}>
                Alert me
              </Button>
            }
          >
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i}>
                    <Skeleton className="mb-3 h-4 w-28" />
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 35 }, (_, j) => (
                        <Skeleton key={j} className="h-12 sm:h-14" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : availQ.isError ? (
              <EmptyState
                compact
                title="Couldn't load availability"
                description={availQ.error instanceof Error ? availQ.error.message : undefined}
                action={
                  <Button variant="secondary" onClick={() => availQ.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : data.daysWithSpace === 0 ? (
              <EmptyState
                compact
                title={`No ${CABIN_LABEL[cabin].toLowerCase()} space on ${origin} → ${destination}`}
                description="Nothing in the next 90 days. Set an alert and we'll check every day, or try a different cabin."
                action={
                  <Button href={`/alerts?new=1&from=${origin}&to=${destination}&cabin=${cabin}&dateFrom=${today}&dateTo=${to}`} leading={<BellPlus />}>
                    Create alert
                  </Button>
                }
                secondaryAction={
                  <Button variant="ghost" href={`/explore?view=deals&from=${origin}&cabin=${cabin}`} leading={<Compass />}>
                    Browse deals
                  </Button>
                }
              />
            ) : (
              <AvailabilityCalendar
                months={3}
                from={today}
                days={data.cells}
                minDate={today}
                maxDate={to}
                onSelect={(date) => router.push(searchHref({ from: origin, to: destination, date, cabin }))}
              />
            )}
          </Panel>

          {data.programs.length > 0 && (
            <Panel eyebrow="By program" title="Who has the space" padding="none" bodyClassName="pt-2">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-panel-border font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">
                      <th scope="col" className="px-5 py-2.5 text-left font-medium sm:px-6">
                        Program
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Days
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        From
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Typical taxes
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left font-medium">
                        Carriers
                      </th>
                      <th scope="col" className="px-5 py-2.5 sm:px-6">
                        <span className="sr-only">Search</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.programs.map((row) => {
                      const p = getProgram(row.programId);
                      return (
                        <tr key={row.programId} className="border-b border-panel-border last:border-0 hover:bg-fg/[0.03]">
                          <td className="px-5 py-2.5 sm:px-6">
                            <span className="flex items-center gap-2.5">
                              <ProgramLogo id={row.programId} name={p?.name ?? row.programId} color={p?.color} size={28} />
                              <span className="font-medium text-fg">{p?.shortName ?? row.programId}</span>
                              {data.bestProgram?.programId === row.programId && (
                                <Badge variant="gold" size="sm" caps>
                                  Best
                                </Badge>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tnum text-fg">{fmtInt(row.days)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tnum text-fg">{fmtInt(row.minMiles)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tnum text-fg-muted">{fmtUsd(row.typicalTaxes)}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex flex-wrap gap-1">
                              {row.carriers.slice(0, 4).map((c) => (
                                <span key={c} className="rounded-full bg-fg/8 px-2 py-0.5 font-mono text-[11px] text-fg-muted" title={getAirline(c)?.name}>
                                  {c}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right sm:px-6">
                            <Button
                              size="sm"
                              variant="ghost"
                              href={`${searchHref({ from: origin, to: destination, date: data.cheapest?.date, cabin })}&programs=${row.programId}`}
                              trailing={<ArrowRight />}
                            >
                              Search
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
