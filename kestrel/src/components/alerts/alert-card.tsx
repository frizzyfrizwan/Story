"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Copy, MoreHorizontal, Pencil, RefreshCw, Trash2, Users } from "lucide-react";
import { Badge, CabinBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Card } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { focusRing } from "@/components/ui/tokens";
import { Tooltip } from "@/components/ui/tooltip";
import { fmtWindow, relativeTime } from "@/components/explore/format";
import { getProgram } from "@/data/programs";
import type { AlertRule } from "@/lib/types";
import { cn, fmtCompact, fmtInt } from "@/lib/utils";
import { useCheckAlert, useToggleAlert } from "./use-alerts";

export function RouteChips({ codes, className }: { codes: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {codes.map((c) => (
        <span key={c} className="inline-flex h-6 items-center rounded-full border border-panel-border bg-bg-elev-2 px-2 font-mono text-[11px] font-semibold tracking-wide text-fg">
          {c}
        </span>
      ))}
    </span>
  );
}

export interface AlertCardProps {
  alert: AlertRule;
  now: number;
  onEdit: (alert: AlertRule) => void;
  onDuplicate: (alert: AlertRule) => void;
  onDelete: (alert: AlertRule) => void;
}

export function AlertCard({ alert, now, onEdit, onDuplicate, onDelete }: AlertCardProps) {
  const toggle = useToggleAlert();
  const check = useCheckAlert();
  const checking = check.isPending && check.variables === alert.id;
  const programNames = (alert.programs ?? []).map((id) => getProgram(id)?.shortName ?? id);

  return (
    <Card as="li" padding="none" className={cn("overflow-hidden transition-opacity", !alert.active && "opacity-75")}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/alerts/${alert.id}`} className={cn("font-display text-lg leading-tight tracking-tight text-fg hover:underline underline-offset-4", focusRing)}>
              {alert.name}
            </Link>
            <CabinBadge cabin={alert.cabin} short size="sm" />
            {!alert.active && (
              <Badge variant="outline" size="sm" caps>
                Paused
              </Badge>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <RouteChips codes={alert.origins} />
            <ArrowRight className="size-3.5 text-fg-subtle" aria-hidden="true" />
            <RouteChips codes={alert.destinations} />
          </div>
          <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Window</dt>
              <CalendarDays className="size-3.5 text-fg-subtle" aria-hidden="true" />
              <dd className="font-mono tnum">{fmtWindow(alert.dateFrom, alert.dateTo)}</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Passengers</dt>
              <Users className="size-3.5 text-fg-subtle" aria-hidden="true" />
              <dd className="font-mono tnum">{alert.passengers} pax</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Max miles</dt>
              <dd>{alert.maxMiles ? <span className="font-mono tnum">≤ {fmtCompact(alert.maxMiles).toUpperCase()} miles</span> : "Any price"}</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <dt className="sr-only">Programs</dt>
              <dd className="truncate">{programNames.length ? programNames.slice(0, 3).join(", ") + (programNames.length > 3 ? ` +${programNames.length - 3}` : "") : "Any program"}</dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content={alert.active ? "Pause alert" : "Resume alert"}>
            <Switch
              size="sm"
              checked={alert.active}
              onCheckedChange={(active) => toggle.mutate({ id: alert.id, active })}
              aria-label={`${alert.name} active`}
            />
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="More actions" size="sm">
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem icon={<ArrowRight />} href={`/alerts/${alert.id}`}>
                View details
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(alert)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Copy />} onSelect={() => onDuplicate(alert)}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => onDelete(alert)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-panel-border bg-bg-elev-1/60 px-4 py-2.5 text-xs text-fg-subtle sm:px-5">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <span className={cn("font-mono tnum", alert.hitCount > 0 ? "text-aurora" : "text-fg")}>{fmtInt(alert.hitCount)}</span> {alert.hitCount === 1 ? "hit" : "hits"}
          </span>
          <span aria-hidden="true">·</span>
          <span>{alert.lastCheckedAt ? `checked ${relativeTime(alert.lastCheckedAt, now)}` : "not checked yet"}</span>
          {alert.lastHitAt && (
            <>
              <span aria-hidden="true">·</span>
              <span>last hit {relativeTime(alert.lastHitAt, now)}</span>
            </>
          )}
        </span>
        <Button size="sm" variant="secondary" loading={checking} onClick={() => check.mutate(alert.id)} leading={<RefreshCw />} disabled={check.isPending && !checking}>
          Check now
        </Button>
      </footer>
    </Card>
  );
}
