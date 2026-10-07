"use client";

/**
 * Availability heat calendars.
 *
 * <AvailabilityCalendar> — one or more month grids; each day tints by level 0–4 (bg-avail-*),
 * shows compact miles in mono and seat dots. Roving-tabindex keyboard navigation (arrows, Home/End,
 * PageUp/PageDown, Enter/Space) and a legend.
 *
 * <AvailabilityStrip> — the 14-day horizontal version for result headers.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { addDays, cn, fmtCompact, fmtInt, parseISODate, toISODate } from "@/lib/utils";

export type AvailabilityLevel = 0 | 1 | 2 | 3 | 4;

export interface AvailabilityDayCell {
  /** YYYY-MM-DD */
  date: string;
  level: AvailabilityLevel;
  miles?: number;
  seats?: number;
}

const LEVEL_BG: Record<AvailabilityLevel, string> = {
  0: "bg-avail-0",
  1: "bg-avail-1",
  2: "bg-avail-2",
  3: "bg-avail-3",
  4: "bg-avail-4",
};
const LEVEL_FG: Record<AvailabilityLevel, string> = {
  0: "text-fg-muted",
  1: "text-fg-muted",
  2: "text-fg",
  3: "text-aurora-fg",
  4: "text-aurora-fg",
};
const LEVEL_LABEL: Record<AvailabilityLevel, string> = {
  0: "None",
  1: "Low",
  2: "Some",
  3: "Good",
  4: "Wide open",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function describe(date: string, day?: AvailabilityDayCell): string {
  const d = parseISODate(date);
  const base = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  if (!day) return `${base}: no data`;
  const parts = [LEVEL_LABEL[day.level]];
  if (day.miles != null) parts.push(`${fmtInt(day.miles)} miles`);
  if (day.seats != null) parts.push(`${day.seats} seat${day.seats === 1 ? "" : "s"}`);
  return `${base}: ${parts.join(", ")}`;
}

function SeatDots({ seats }: { seats?: number }) {
  if (seats == null || seats <= 0) return null;
  const n = Math.min(seats, 4);
  return (
    <span className="flex items-center gap-[2px]" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-current opacity-80" />
      ))}
      {seats > 4 && <span className="text-[8px] leading-none opacity-80">+</span>}
    </span>
  );
}

export function AvailabilityLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-subtle", className)}>
      <div className="flex items-center gap-1.5">
        {([0, 1, 2, 3, 4] as AvailabilityLevel[]).map((l) => (
          <span key={l} className={cn("h-3 w-3 rounded-[3px]", LEVEL_BG[l])} title={LEVEL_LABEL[l]} />
        ))}
        <span className="ml-1">None → wide open</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-[2px] text-fg">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
        <span>seats</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-fg">57.5K</span>
        <span>miles</span>
      </div>
    </div>
  );
}

// ─── Calendar ──────────────────────────────────────────────────

export interface AvailabilityCalendarProps {
  /** Number of month grids to render starting at `from`'s month (default 1) */
  months?: number;
  /** YYYY-MM-DD — the first month shown; also the default focus */
  from: string;
  days: AvailabilityDayCell[];
  selected?: string | null;
  onSelect?: (date: string, day?: AvailabilityDayCell) => void;
  /** Days before this are dimmed and not selectable */
  minDate?: string;
  maxDate?: string;
  weekStartsOn?: 0 | 1;
  legend?: boolean;
  showMiles?: boolean;
  /** Tighter cells for sidebars */
  compact?: boolean;
  className?: string;
}

export function AvailabilityCalendar({
  months = 1,
  from,
  days,
  selected,
  onSelect,
  minDate,
  maxDate,
  weekStartsOn = 0,
  legend = true,
  showMiles = true,
  compact = false,
  className,
}: AvailabilityCalendarProps) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const start = useMemo(() => {
    const d = parseISODate(from);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [from]);

  const grids = useMemo(() => {
    const out: { key: string; year: number; month: number; leading: number; count: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const leading = (d.getDay() - weekStartsOn + 7) % 7;
      const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      out.push({ key: toISODate(d), year: d.getFullYear(), month: d.getMonth(), leading, count });
    }
    return out;
  }, [start, months, weekStartsOn]);

  const first = grids[0] ? grids[0].key : from;
  const last = grids.length ? toISODate(new Date(grids[grids.length - 1].year, grids[grids.length - 1].month + 1, 0)) : from;
  const inRange = useCallback((date: string) => date >= first && date <= last, [first, last]);
  const disabled = useCallback((date: string) => (minDate != null && date < minDate) || (maxDate != null && date > maxDate), [minDate, maxDate]);

  const [focused, setFocused] = useState<string>(() => (selected && inRange(selected) ? selected : from));
  const pendingFocus = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inRange(focused)) setFocused(first);
  }, [focused, inRange, first]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    const el = root.current?.querySelector<HTMLButtonElement>(`[data-date="${pendingFocus.current}"]`);
    el?.focus();
    pendingFocus.current = null;
  }, [focused]);

  const move = (date: string, delta: number) => {
    let next = addDays(date, delta);
    if (next < first) next = first;
    if (next > last) next = last;
    pendingFocus.current = next;
    setFocused(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const dow = (parseISODate(date).getDay() - weekStartsOn + 7) % 7;
    switch (e.key) {
      case "ArrowRight":
        move(date, 1);
        break;
      case "ArrowLeft":
        move(date, -1);
        break;
      case "ArrowDown":
        move(date, 7);
        break;
      case "ArrowUp":
        move(date, -7);
        break;
      case "Home":
        move(date, -dow);
        break;
      case "End":
        move(date, 6 - dow);
        break;
      case "PageDown": {
        const d = parseISODate(date);
        d.setMonth(d.getMonth() + 1);
        move(date, Math.round((d.getTime() - parseISODate(date).getTime()) / 86_400_000));
        break;
      }
      case "PageUp": {
        const d = parseISODate(date);
        d.setMonth(d.getMonth() - 1);
        move(date, Math.round((d.getTime() - parseISODate(date).getTime()) / 86_400_000));
        break;
      }
      case "Enter":
      case " ":
        if (!disabled(date)) onSelect?.(date, byDate.get(date));
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStartsOn) % 7]), [weekStartsOn]);

  return (
    <div ref={root} className={cn("flex flex-col gap-4", className)}>
      <div className={cn("grid gap-5", months > 1 && "grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]")}>
        {grids.map((g) => (
          <div key={g.key} role="grid" aria-label={`${MONTHS[g.month]} ${g.year}`} className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="font-display text-base leading-none tracking-tight">
                {MONTHS[g.month]} <span className="text-fg-subtle">{g.year}</span>
              </h4>
            </div>
            <div role="row" className="mb-1 grid grid-cols-7 gap-1">
              {weekdays.map((w, i) => (
                <div key={i} role="columnheader" className="text-center font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                  {w}
                </div>
              ))}
            </div>
            <div role="row" className="grid grid-cols-7 gap-1">
              {Array.from({ length: g.leading }, (_, i) => (
                <div key={`lead-${i}`} aria-hidden />
              ))}
              {Array.from({ length: g.count }, (_, i) => {
                const date = toISODate(new Date(g.year, g.month, i + 1));
                const day = byDate.get(date);
                const isSel = selected === date;
                const isDisabled = disabled(date);
                const level = day?.level;
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    data-date={date}
                    tabIndex={focused === date ? 0 : -1}
                    aria-selected={isSel}
                    aria-disabled={isDisabled || undefined}
                    aria-label={describe(date, day)}
                    title={describe(date, day)}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && onSelect?.(date, day)}
                    onKeyDown={(e) => onKeyDown(e, date)}
                    onFocus={() => setFocused(date)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-[var(--radius-sm)] p-1 text-left transition-[transform,box-shadow] duration-150",
                      compact ? "h-10" : "h-12 sm:h-14",
                      level != null ? cn(LEVEL_BG[level], LEVEL_FG[level]) : "bg-bg-elev-2 text-fg-faint",
                      isDisabled ? "cursor-not-allowed opacity-35" : "hover:-translate-y-px hover:shadow-[0_0_0_1px_var(--panel-border-strong)]",
                      isSel && "ring-2 ring-signal ring-offset-2 ring-offset-bg",
                    )}
                  >
                    <span className="flex items-start justify-between">
                      <span className="font-mono text-[11px] leading-none tnum">{i + 1}</span>
                      <SeatDots seats={day?.seats} />
                    </span>
                    {showMiles && (
                      <span className={cn("font-mono leading-none tnum", compact ? "text-[9px]" : "text-[10px] sm:text-[11px]", "font-semibold")}>
                        {day?.miles != null ? fmtCompact(day.miles).toUpperCase() : day ? "" : "·"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {legend && <AvailabilityLegend />}
    </div>
  );
}

// ─── Strip ─────────────────────────────────────────────────────

export interface AvailabilityStripProps {
  /** YYYY-MM-DD first day */
  from: string;
  days: AvailabilityDayCell[];
  /** Number of days (default 14) */
  count?: number;
  selected?: string | null;
  onSelect?: (date: string, day?: AvailabilityDayCell) => void;
  showMiles?: boolean;
  className?: string;
}

export function AvailabilityStrip({ from, days, count = 14, selected, onSelect, showMiles = true, className }: AvailabilityStripProps) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const dates = useMemo(() => Array.from({ length: count }, (_, i) => addDays(from, i)), [from, count]);
  const [focused, setFocused] = useState<string>(selected && dates.includes(selected) ? selected : from);
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!pending.current) return;
    root.current?.querySelector<HTMLButtonElement>(`[data-date="${pending.current}"]`)?.focus();
    pending.current = null;
  }, [focused]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.key === "ArrowRight") next = Math.min(count - 1, i + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    else if (e.key === "Enter" || e.key === " ") {
      onSelect?.(dates[i], byDate.get(dates[i]));
      e.preventDefault();
      return;
    } else return;
    e.preventDefault();
    pending.current = dates[next];
    setFocused(dates[next]);
  };

  return (
    <div ref={root} role="listbox" aria-label="Availability by day" className={cn("scrollbar-none -mx-1 flex snap-x gap-1 overflow-x-auto px-1 py-1", className)}>
      {dates.map((date, i) => {
        const day = byDate.get(date);
        const d = parseISODate(date);
        const isSel = selected === date;
        const level = day?.level;
        return (
          <button
            key={date}
            type="button"
            role="option"
            data-date={date}
            aria-selected={isSel}
            aria-label={describe(date, day)}
            title={describe(date, day)}
            tabIndex={focused === date ? 0 : -1}
            onFocus={() => setFocused(date)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onSelect?.(date, day)}
            className={cn(
              "flex min-w-[2.75rem] flex-1 snap-start flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 transition-transform duration-150 hover:-translate-y-px",
              level != null ? cn(LEVEL_BG[level], LEVEL_FG[level]) : "bg-bg-elev-2 text-fg-faint",
              isSel && "ring-2 ring-signal ring-offset-2 ring-offset-bg",
            )}
          >
            <span className="font-mono text-[9px] uppercase leading-none tracking-wider opacity-75">{WEEKDAYS[d.getDay()]}</span>
            <span className="font-mono text-sm font-semibold leading-none tnum">{d.getDate()}</span>
            {showMiles && (
              <span className="font-mono text-[9px] leading-none tnum">{day?.miles != null ? fmtCompact(day.miles).toUpperCase() : "·"}</span>
            )}
            <SeatDots seats={day?.seats} />
          </button>
        );
      })}
    </div>
  );
}
