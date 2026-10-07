"use client";

import Link from "next/link";
import { useRef } from "react";
import { useInView } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { SplitFlap, type FlapTone } from "@/components/viz";
import { SourceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/tokens";
import { cn, fmtCompact, fmtInt, parseISODate } from "@/lib/utils";
import { CABIN_LABEL, CABIN_SHORT, type Cabin, type DataSource, type Deal } from "@/lib/types";

type CellKey = "date" | "carrier" | "route" | "cabin" | "miles" | "status";

interface Column {
  key: CellKey;
  label: string;
  /** Width in flap tiles */
  width: number;
  align: "left" | "center" | "right";
  /** Responsive visibility; always visible when omitted */
  hide?: string;
}

interface Row extends Record<CellKey, string> {
  id: string;
  href: string;
  label: string;
  statusTone: FlapTone;
  cabinTone: FlapTone;
}

/* Tile budgets are tuned so the board never overflows at 375 / 640 / 768 / 1024 / 1280. */
const COLUMNS: Column[] = [
  { key: "date", label: "Date", width: 6, align: "left" },
  { key: "carrier", label: "Op", width: 2, align: "left", hide: "hidden md:flex" },
  { key: "route", label: "Route", width: 7, align: "left" },
  { key: "cabin", label: "Cab", width: 1, align: "center", hide: "hidden xl:flex" },
  { key: "miles", label: "Miles", width: 4, align: "right", hide: "hidden sm:flex" },
  { key: "status", label: "Status", width: 10, align: "left", hide: "hidden lg:flex" },
];

const STATUS: Record<Deal["badge"], { text: string; tone: FlapTone }> = {
  "sweet-spot": { text: "SWEET SPOT", tone: "signal" },
  "wide-open": { text: "WIDE OPEN", tone: "aurora" },
  rare: { text: "RARE FIND", tone: "gold" },
  "transfer-bonus": { text: "BONUS", tone: "violet" },
  "ai-pick": { text: "AI PICK", tone: "violet" },
};

const CABIN_TONE: Record<Cabin, FlapTone> = { economy: "sky", premium: "violet", business: "aurora", first: "gold" };

function boardDate(iso: string | undefined): string {
  if (!iso) return "";
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase();
}

function toRow(d: Deal): Row {
  const date = d.dates[0];
  const sp = new URLSearchParams({ from: d.origin, to: d.destination, cabin: d.cabin });
  if (date) sp.set("date", date);
  const status = STATUS[d.badge];
  return {
    id: d.id,
    date: boardDate(date),
    carrier: d.carrier,
    route: `${d.origin}-${d.destination}`,
    cabin: CABIN_SHORT[d.cabin],
    miles: fmtCompact(d.miles).toUpperCase(),
    status: status.text,
    statusTone: status.tone,
    cabinTone: CABIN_TONE[d.cabin],
    href: `/search?${sp.toString()}`,
    label: `Search ${d.origin} to ${d.destination}, ${CABIN_LABEL[d.cabin]}, from ${fmtInt(d.miles)} miles${
      date ? ` on ${date}` : ""
    }`,
  };
}

function cellTone(row: Row, key: CellKey): FlapTone {
  if (key === "status") return row.statusTone;
  if (key === "cabin") return row.cabinTone;
  if (key === "date") return "muted";
  if (key === "miles") return "gold";
  return "default";
}

const cellWidth = (w: number) => `calc(${w} * var(--kf-w) + ${w - 1} * 2px)`;

export interface LiveBoardProps {
  deals: Deal[];
  source: DataSource;
  /** Pad with blank rows so the board keeps its shape */
  minRows?: number;
  className?: string;
}

/**
 * Split-flap departure board where every row is a link to the search for that route. The tiles
 * stay blank until the board scrolls into view, so the flip happens in front of the viewer.
 */
export function LiveBoard({ deals, source, minRows = 6, className }: LiveBoardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const rows = deals.map(toRow);
  const blanks = Math.max(0, minRows - rows.length);

  return (
    <div ref={ref} className={className}>
      <section
        className="kf-md grain rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 p-3 shadow-panel sm:p-5"
        aria-label="Award departures board"
      >
        <header className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-aurora" />
            </span>
            <h3 className="font-display text-lg leading-none tracking-tight sm:text-xl">Award departures</h3>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle sm:text-[11px]">
            {rows.length ? `${rows.length} routes · one-way` : "Scanning"}
          </div>
        </header>

        <div className="scrollbar-none overflow-x-auto">
          <div className="min-w-max">
            <div className="mb-2 flex items-center gap-3 border-b border-panel-border pb-2 sm:gap-4" aria-hidden="true">
              {COLUMNS.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle",
                    c.hide ?? "flex",
                    c.align === "right" && "justify-end",
                    c.align === "center" && "justify-center",
                  )}
                  style={{ width: cellWidth(c.width) }}
                >
                  {c.label}
                </div>
              ))}
            </div>

            <ul className="flex flex-col gap-1.5">
              {rows.map((row, r) => (
                <li key={row.id} className="animate-rise" style={{ animationDelay: `${r * 110}ms` }}>
                  <Link
                    href={row.href}
                    className={cn(
                      "group/row -mx-2 flex items-center gap-3 rounded-[10px] px-2 py-0.5 transition-colors hover:bg-fg/5 sm:gap-4",
                      focusRing,
                    )}
                  >
                    <span className="sr-only">{row.label}</span>
                    {COLUMNS.map((c) => (
                      <span key={c.key} aria-hidden="true" className={c.hide ?? "flex"}>
                        <SplitFlap
                          text={inView ? row[c.key] : ""}
                          cols={c.width}
                          align={c.align}
                          tone={cellTone(row, c.key)}
                          size="md"
                          delay={r * 110}
                          stagger={18}
                        />
                      </span>
                    ))}
                    <ArrowUpRight
                      className="ml-auto hidden size-4 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100 xl:block"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
              {Array.from({ length: blanks }, (_, i) => (
                <li key={`blank-${i}`} className="-mx-2 flex items-center gap-3 px-2 py-0.5 sm:gap-4" aria-hidden="true">
                  {COLUMNS.map((c) => (
                    <span key={c.key} className={c.hide ?? "flex"}>
                      <SplitFlap text="" cols={c.width} size="md" tone="muted" />
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-3 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={source} />
          <span>Miles are one-way per person in the program that prices them. Pick a row to search that route.</span>
        </div>
        <Button variant="link" size="sm" href="/explore" trailing={<ArrowUpRight />}>
          All deals
        </Button>
      </div>
    </div>
  );
}
