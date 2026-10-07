"use client";

import Link from "next/link";
import { Radar } from "lucide-react";
import { AirlineTail } from "@/components/art";
import { Badge, CabinBadge, ProgramChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { relativeTime, searchHref } from "@/components/explore/format";
import { getAirline } from "@/data/airlines";
import { getProgram } from "@/data/programs";
import type { AlertHit, AlertRule } from "@/lib/types";
import { cn, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";

export interface HitRowProps {
  hit: AlertHit;
  /** Name of the alert that produced it (shown when the feed mixes alerts). */
  alertName?: string;
  now?: number;
  className?: string;
}

/** One found seat: date, route, carrier tail, program, miles + taxes, seats. Links to the search for that day. */
export function HitRow({ hit, alertName, now, className }: HitRowProps) {
  const airline = getAirline(hit.carrier);
  const program = getProgram(hit.programId);
  return (
    <Link
      href={searchHref({ from: hit.origin, to: hit.destination, date: hit.date, cabin: hit.cabin })}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2 transition-colors hover:bg-fg/[0.04]",
        focusRing,
        className,
      )}
    >
      <AirlineTail code={hit.carrier} color={airline?.color} size={24} showCode={false} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-mono font-semibold tracking-wide text-fg">
            {hit.origin}
            <span className="mx-1 text-fg-subtle">→</span>
            {hit.destination}
          </span>
          <span className="font-mono text-xs tnum text-fg-muted">{fmtDate(hit.date)}</span>
          <CabinBadge cabin={hit.cabin} short size="sm" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
          {program && <ProgramChip id={program.id} name={program.shortName} color={program.color} compact size="sm" />}
          <span>{program?.shortName ?? hit.programId}</span>
          <span aria-hidden="true">·</span>
          <span>{airline?.name ?? hit.carrier}</span>
          {alertName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{alertName}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono tnum text-sm font-medium text-fg">{fmtInt(hit.miles)}</div>
        <div className="font-mono text-[11px] tnum text-fg-subtle">+ {fmtUsd(hit.taxesUsd)}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={hit.seats >= 2 ? "aurora" : "neutral"} size="sm">
          {hit.seats} seat{hit.seats === 1 ? "" : "s"}
        </Badge>
        {now != null && <span className="font-mono text-[10px] text-fg-subtle">{relativeTime(hit.foundAt, now)}</span>}
      </div>
    </Link>
  );
}

export interface HitsFeedProps {
  hits: AlertHit[];
  alerts?: AlertRule[];
  loading?: boolean;
  now?: number;
  limit?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function HitsFeed({ hits, alerts, loading, now, limit = 12, emptyTitle = "No hits yet", emptyDescription = "When a scan finds space inside one of your windows, it lands here." }: HitsFeedProps) {
  const names = new Map((alerts ?? []).map((a) => [a.id, a.name]));
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} variant="row" className="border-0 bg-transparent px-2" />
        ))}
      </div>
    );
  }
  if (!hits.length) {
    return <EmptyState compact illustration="none" icon={<Radar />} title={emptyTitle} description={emptyDescription} className="py-6" />;
  }
  return (
    <ul className="-mx-2 flex flex-col divide-y divide-panel-border" aria-label="Recent hits">
      {hits.slice(0, limit).map((h) => (
        <li key={h.id}>
          <HitRow hit={h} alertName={alerts ? names.get(h.alertId) : undefined} now={now} />
        </li>
      ))}
    </ul>
  );
}
