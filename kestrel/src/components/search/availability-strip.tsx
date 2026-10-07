"use client";

/**
 * ±14-day availability for the primary O&D, from /api/awards/availability. Shows the cheapest
 * miles per day; clicking a day changes the search date.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { SourceBadge } from "@/components/ui";
import { AvailabilityLegend, AvailabilityStrip, type AvailabilityDayCell, type AvailabilityLevel } from "@/components/viz";
import { apiGet } from "@/lib/client/api";
import type { Cabin, RouteAvailability } from "@/lib/types";
import { CABIN_LABEL } from "@/lib/types";
import { addDays, cn, daysBetween, fmtDate } from "@/lib/utils";
import { fmtK } from "./derive";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

export interface AvailabilityPanelProps {
  origin: string;
  destination: string;
  cabin: Cabin;
  date: string;
  today: string;
  onSelectDate: (date: string) => void;
  className?: string;
}

function levelFor(seats: number): AvailabilityLevel {
  if (seats >= 5) return 4;
  if (seats >= 3) return 3;
  if (seats >= 2) return 2;
  if (seats >= 1) return 1;
  return 0;
}

export function AvailabilityPanel({ origin, destination, cabin, date, today, onSelectDate, className }: AvailabilityPanelProps) {
  const from = addDays(date, -14) < today ? today : addDays(date, -14);
  const to = addDays(date, 14);
  const count = Math.max(1, daysBetween(from, to) + 1);

  const query = useQuery({
    queryKey: ["availability", origin, destination, cabin, from, to],
    queryFn: ({ signal }) => apiGet<RouteAvailability>("/api/awards/availability", { origin, destination, cabin, from, to }, { signal }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const days = useMemo<AvailabilityDayCell[]>(() => {
    const byDate = new Map<string, { miles: number; seats: number }>();
    for (const d of query.data?.days ?? []) {
      if (!d?.date) continue;
      const prev = byDate.get(d.date);
      const seats = Math.max(0, d.seats ?? 0);
      if (!prev) byDate.set(d.date, { miles: d.miles, seats });
      else byDate.set(d.date, { miles: Math.min(prev.miles, d.miles), seats: Math.max(prev.seats, seats) });
    }
    const out: AvailabilityDayCell[] = [];
    for (let i = 0; i < count; i++) {
      const iso = addDays(from, i);
      const d = byDate.get(iso);
      out.push(d && d.seats > 0 ? { date: iso, level: levelFor(d.seats), miles: d.miles, seats: d.seats } : { date: iso, level: 0 });
    }
    return out;
  }, [query.data, from, count]);

  const cheapest = useMemo(() => {
    let best: AvailabilityDayCell | null = null;
    for (const d of days) if (d.miles != null && d.level > 0 && (!best || d.miles < (best.miles ?? Infinity))) best = d;
    return best;
  }, [days]);

  // Keep the selected day centred in the scroller.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = scroller.current?.querySelector<HTMLElement>('[role="listbox"]');
    const cell = strip?.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (!strip || !cell) return;
    const left = cell.offsetLeft - strip.clientWidth / 2 + cell.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [date, days]);

  const loading = query.isPending;

  return (
    <section className={cn("panel px-4 py-3 sm:px-5", className)} aria-label="Availability by day">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">
          Availability · <span className="text-fg">{origin} → {destination}</span> · {CABIN_LABEL[cabin]}
        </p>
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          {cheapest && cheapest.miles != null && (
            <button
              type="button"
              onClick={() => onSelectDate(cheapest.date)}
              className={cn("rounded-full px-2 py-0.5 transition-colors hover:bg-fg/6 hover:text-fg", focusRing)}
            >
              Cheapest <span className="font-mono tnum text-aurora">{fmtK(cheapest.miles)}</span> on {fmtDate(cheapest.date)}
            </button>
          )}
          {query.data?.source && <SourceBadge source={query.data.source} />}
          {query.isError && <span className="text-fg-subtle">Calendar unavailable</span>}
        </div>
      </div>

      <div ref={scroller} className="mt-2" aria-busy={loading || undefined}>
        {loading ? (
          <div className="-mx-1 flex gap-1 overflow-hidden px-1 py-1" aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="skeleton h-[3.75rem] min-w-[2.75rem] flex-1 rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : (
          <AvailabilityStrip from={from} days={days} count={count} selected={date} onSelect={(d) => onSelectDate(d)} />
        )}
      </div>

      <AvailabilityLegend className="mt-2 hidden sm:flex" />
    </section>
  );
}
