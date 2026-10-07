"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import type { Airport, FlightStatus, LiveAircraft } from "@/lib/types";
import { SplitFlap, type FlapSize, type FlapTone } from "@/components/viz";
import { focusRing } from "@/components/ui";
import { cn, todayISO } from "@/lib/utils";
import { flightStatusKey } from "./use-flight-status";
import { PHASE_TONE, altitudeFt, deriveFlight, nearestAircraft, phaseOf, routeForFlight, type FlightPhase } from "./live-utils";

/**
 * <ArrivalsBoard> — a split-flap board of the aircraft nearest to an anchor (the selected airport
 * or the viewport centre). Built on <SplitFlap> tiles with its own column set (flight, from→to,
 * altitude, range, phase); tiles only flip for characters that changed between polls.
 */

type ColKey = "flight" | "route" | "alt" | "dist" | "status";

interface Col {
  key: ColKey;
  label: string;
  width: number;
  align: "left" | "right" | "center";
  /** Responsive visibility classes for narrow screens */
  hide?: string;
}

const COLS: Col[] = [
  { key: "flight", label: "Flight", width: 6, align: "left" },
  { key: "route", label: "From → To", width: 12, align: "left" },
  { key: "alt", label: "Altitude", width: 5, align: "right", hide: "hidden sm:flex" },
  { key: "dist", label: "Range", width: 6, align: "right", hide: "hidden md:flex" },
  { key: "status", label: "Status", width: 10, align: "left" },
];

export interface BoardEntry {
  id: string;
  ac: LiveAircraft;
  nm: number;
  phase: FlightPhase;
  cells: Record<ColKey, string>;
  tones: Partial<Record<ColKey, FlapTone>>;
}

export interface ArrivalsBoardProps {
  aircraft: LiveAircraft[];
  /** Anchor the board on an airport… */
  airport?: Airport | null;
  /** …or on this [lon, lat] (the viewport centre) when no airport is chosen. */
  center: [number, number] | null;
  /** Rows (default 8) */
  limit?: number;
  selectedId?: string | null;
  onSelect?: (ac: LiveAircraft) => void;
  /** Header chevron toggles the rows. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Right-side header slot, e.g. "3s ago" */
  trailing?: ReactNode;
  size?: FlapSize;
  className?: string;
}

function altCell(ft: number | null): string {
  if (ft == null) return "";
  return ft >= 18_000 ? `FL${Math.round(ft / 100)}` : String(ft);
}

export function buildBoardEntries(
  aircraft: LiveAircraft[],
  anchor: [number, number],
  limit: number,
  cachedRoute: (flight: string) => { origin: string; destination: string } | null,
): BoardEntry[] {
  return nearestAircraft(aircraft, anchor, limit).map(({ ac, nm }) => {
    const flight = deriveFlight(ac);
    const route = flight ? (routeForFlight(flight.flight) ?? cachedRoute(flight.flight)) : null;
    const phase = phaseOf(ac);
    return {
      id: ac.icao24,
      ac,
      nm,
      phase,
      cells: {
        flight: (flight?.flight ?? ac.callsign ?? ac.icao24.toUpperCase()).slice(0, 6),
        route: route ? `${route.origin}-${route.destination}` : ac.originCountry,
        alt: altCell(altitudeFt(ac)),
        dist: `${nm}NM`,
        status: phase,
      },
      tones: {
        flight: "default",
        route: route ? "default" : "muted",
        alt: "gold",
        dist: "muted",
        status: PHASE_TONE[phase],
      },
    };
  });
}

export function ArrivalsBoard({
  aircraft,
  airport,
  center,
  limit = 8,
  selectedId,
  onSelect,
  collapsible = false,
  defaultOpen = true,
  trailing,
  size = "md",
  className,
}: ArrivalsBoardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const queryClient = useQueryClient();
  const anchor = useMemo<[number, number] | null>(
    () => (airport ? [airport.lon, airport.lat] : center),
    [airport, center],
  );

  const entries = useMemo(() => {
    if (!anchor) return [];
    const today = todayISO();
    const cached = (flight: string) => {
      const s = queryClient.getQueryData<FlightStatus>(flightStatusKey(flight, today));
      return s ? { origin: s.origin, destination: s.destination } : null;
    };
    return buildBoardEntries(aircraft, anchor, limit, cached);
  }, [aircraft, anchor, limit, queryClient]);

  const padded = useMemo(() => {
    const out: (BoardEntry | null)[] = [...entries];
    while (out.length < limit) out.push(null);
    return out;
  }, [entries, limit]);

  const cellWidth = (w: number) => `calc(${w} * var(--kf-w) + ${w - 1} * 2px)`;
  const title = airport ? `Nearest ${airport.iata}` : "Nearest the view";
  const subtitle = airport
    ? `${airport.city} · ${entries.length} tracked`
    : anchor
      ? `${Math.abs(anchor[1]).toFixed(1)}°${anchor[1] >= 0 ? "N" : "S"} ${Math.abs(anchor[0]).toFixed(1)}°${anchor[0] >= 0 ? "E" : "W"} · ${entries.length} tracked`
      : "Waiting for the map";

  return (
    <section
      className={cn(
        "grain rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 shadow-panel",
        `kf-${size}`,
        className,
      )}
      aria-label={`${title} — live aircraft board`}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-aurora" />
          </span>
          <h3 className="truncate font-display text-lg leading-none tracking-tight sm:text-xl">{title}</h3>
          <span className="hidden truncate font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle md:inline">
            {subtitle}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {trailing}
          {collapsible && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "grid size-8 place-items-center rounded-full border border-panel-border bg-bg-elev-2 text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
                focusRing,
              )}
            >
              <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
              <span className="sr-only">{open ? "Collapse board" : "Expand board"}</span>
            </button>
          )}
        </div>
      </header>

      {open && (
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
          <div className="scrollbar-none overflow-x-auto">
            <div className="min-w-max">
              <div className="mb-2 flex items-center gap-3 border-b border-panel-border pb-2 pl-1 sm:gap-5" role="row">
                {COLS.map((col) => (
                  <div
                    key={col.key}
                    role="columnheader"
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle",
                      col.hide ?? "flex",
                      col.align === "right" && "justify-end text-right",
                    )}
                    style={{ width: cellWidth(col.width) }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              <ul className="flex flex-col gap-1" role="list">
                {padded.map((entry, r) => {
                  const selected = Boolean(entry && selectedId && entry.id === selectedId);
                  const inner = COLS.map((col) => (
                    <span key={col.key} className={cn(col.hide ?? "flex")}>
                      <SplitFlap
                        text={entry ? entry.cells[col.key] : ""}
                        cols={col.width}
                        align={col.align}
                        tone={entry ? (entry.tones[col.key] ?? "default") : "default"}
                        size={size}
                        delay={r * 90}
                        stagger={18}
                        label={`${col.label}: ${entry ? entry.cells[col.key] || "—" : "—"}`}
                      />
                    </span>
                  ));
                  return (
                    <li key={r} className="animate-rise" style={{ animationDelay: `${r * 90}ms` }}>
                      {entry ? (
                        <button
                          type="button"
                          onClick={() => onSelect?.(entry.ac)}
                          aria-pressed={selected}
                          aria-label={`${entry.cells.flight}, ${entry.cells.route}, ${entry.nm} nautical miles, ${entry.phase.toLowerCase()}`}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-[10px] px-1 py-0.5 text-left transition-colors duration-150 sm:gap-5",
                            selected ? "bg-aurora/10 ring-1 ring-aurora/30" : "hover:bg-fg/4",
                            focusRing,
                          )}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-1 py-0.5 opacity-60 sm:gap-5" aria-hidden="true">
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          {entries.length === 0 && (
            <p className="mt-3 text-center text-xs text-fg-subtle">
              {anchor ? "No aircraft within range right now." : "The board fills in once the map reports its view."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
