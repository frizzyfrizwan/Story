"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AvailabilityCalendar, type AvailabilityDayCell, type AvailabilityLevel } from "@/components/viz";
import { Button } from "@/components/ui/button";
import { useIsDesktop } from "@/components/ui/use-media-query";
import { addDays, fmtDate, fmtInt, hash32, seededRandom } from "@/lib/utils";
import { CABIN_LABEL, type Cabin } from "@/lib/types";

/** Deterministic two-month heat map; the same month always draws the same picture. */
function buildDays(from: string, seed: string): AvailabilityDayCell[] {
  const rng = seededRandom(hash32(`home-calendar:${seed}:${from.slice(0, 7)}`));
  const out: AvailabilityDayCell[] = [];
  for (let i = 0; i < 70; i++) {
    const r = rng();
    const level: AvailabilityLevel = r < 0.24 ? 0 : r < 0.44 ? 1 : r < 0.7 ? 2 : r < 0.88 ? 3 : 4;
    const seats =
      level === 0 ? 0 : level === 1 ? 1 : level === 2 ? 2 : level === 3 ? 3 + Math.floor(rng() * 2) : 5 + Math.floor(rng() * 4);
    const base = level >= 3 ? 60 : level === 2 ? 70 : 85;
    const miles = level === 0 ? undefined : base * 1000 + Math.floor(rng() * 5) * 2500;
    out.push({ date: addDays(from, i), level, seats, miles });
  }
  return out;
}

export interface DemoCalendarProps {
  /** YYYY-MM-DD — today, passed from the server so SSR and client agree */
  from: string;
  origin?: string;
  destination?: string;
  cabin?: Cabin;
}

export function DemoCalendar({ from, origin = "JFK", destination = "HND", cabin = "business" }: DemoCalendarProps) {
  const desktop = useIsDesktop();
  const days = useMemo(() => buildDays(from, `${origin}-${destination}-${cabin}`), [from, origin, destination, cabin]);
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected ? days.find((d) => d.date === selected) : undefined;
  const href = `/search?from=${origin}&to=${destination}&cabin=${cabin}&date=${selected ?? from}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm font-semibold tracking-wide text-fg">
          {origin}
          <span className="text-fg-subtle"> → </span>
          {destination}
          <span className="ml-2 font-sans text-xs font-normal text-fg-muted">{CABIN_LABEL[cabin]} · sample inventory</span>
        </p>
      </div>
      <AvailabilityCalendar
        months={desktop ? 2 : 1}
        from={from}
        days={days}
        selected={selected}
        onSelect={(date) => setSelected(date)}
        minDate={from}
      />
      <div className="mt-5 flex flex-col gap-3 border-t border-panel-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {day && day.level > 0
            ? `${fmtDate(day.date)} · ${fmtInt(day.miles)} miles · ${day.seats} seat${day.seats === 1 ? "" : "s"}`
            : day
              ? `${fmtDate(day.date)} · nothing open — try a neighbouring day`
              : "Pick a day to see miles and seats."}
        </p>
        <Button href={href} size="sm" variant="secondary" trailing={<ArrowRight />}>
          {selected ? `Search ${fmtDate(selected, { weekday: undefined })}` : "Search this route"}
        </Button>
      </div>
    </div>
  );
}
