"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Pause, Pencil, Play, RefreshCw, Trash2 } from "lucide-react";
import { AirlineTail, ProgramLogo } from "@/components/art";
import { Badge, CabinBadge, ProgramChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat";
import { focusRing } from "@/components/ui/tokens";
import { AvailabilityCalendar, type AvailabilityDayCell, type AvailabilityLevel } from "@/components/viz/availability-heat";
import { fmtWindow, relativeTime, searchHref } from "@/components/explore/format";
import { getAirline } from "@/data/airlines";
import { getProgram } from "@/data/programs";
import { ApiError, loginHref } from "@/lib/client/api";
import { CABIN_LABEL, type AlertHit } from "@/lib/types";
import { cn, fmtCompact, fmtDate, fmtInt, fmtUsd, parseISODate } from "@/lib/utils";
import { AlertFormDialog, type AlertFormMode } from "./alert-form-dialog";
import { RouteChips } from "./alert-card";
import { useAlertDetail, useCheckAlert, useDeleteAlert, useToggleAlert } from "./use-alerts";
import { useNow } from "./use-now";

function monthsSpanning(from: string, to: string): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

/** One calendar cell per date, level by the most seats seen that day, miles by the cheapest hit. */
function cellsFromHits(hits: AlertHit[]): AvailabilityDayCell[] {
  const byDate = new Map<string, { seats: number; miles: number }>();
  for (const h of hits) {
    const cur = byDate.get(h.date);
    if (!cur) byDate.set(h.date, { seats: h.seats, miles: h.miles });
    else byDate.set(h.date, { seats: Math.max(cur.seats, h.seats), miles: Math.min(cur.miles, h.miles) });
  }
  return Array.from(byDate.entries()).map(([date, v]) => ({
    date,
    level: Math.min(4, Math.max(1, v.seats)) as AvailabilityLevel,
    miles: v.miles,
    seats: v.seats,
  }));
}

export function AlertDetail({ id, signedIn }: { id: string; signedIn: boolean }) {
  const router = useRouter();
  const now = useNow();
  const q = useAlertDetail(id, signedIn);
  const toggle = useToggleAlert();
  const check = useCheckAlert();
  const del = useDeleteAlert();
  const [form, setForm] = useState<{ open: boolean; mode: AlertFormMode }>({ open: false, mode: "edit" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const alert = q.data?.alert;
  const hits = useMemo(() => q.data?.hits ?? [], [q.data]);
  const cells = useMemo(() => cellsFromHits(hits), [hits]);
  const stats = useMemo(() => {
    const cheapest = hits.reduce<AlertHit | null>((b, h) => (!b || h.miles < b.miles ? h : b), null);
    const days = new Set(hits.map((h) => h.date)).size;
    const byProgram = new Map<string, number>();
    for (const h of hits) byProgram.set(h.programId, (byProgram.get(h.programId) ?? 0) + 1);
    const top = Array.from(byProgram.entries()).sort((a, b) => b[1] - a[1])[0];
    return { cheapest, days, topProgram: top ? getProgram(top[0]) : undefined, topCount: top?.[1] ?? 0 };
  }, [hits]);

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to view this alert"
        action={
          <Button href={loginHref(`/alerts/${id}`)}>Sign in</Button>
        }
      />
    );
  }

  if (q.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </div>
        <SkeletonCard className="h-72" />
      </div>
    );
  }

  if (q.isError || !alert) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <EmptyState
        title={notFound ? "Alert not found" : "Couldn't load this alert"}
        description={notFound ? "It may have been deleted, or it belongs to another account." : q.error instanceof Error ? q.error.message : undefined}
        action={
          <Button variant="secondary" href="/alerts" leading={<ArrowLeft />}>
            Back to alerts
          </Button>
        }
      />
    );
  }

  const checking = check.isPending;
  const months = Math.min(3, Math.max(1, monthsSpanning(alert.dateFrom, alert.dateTo)));
  const programNames = (alert.programs ?? []).map((pid) => getProgram(pid)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/alerts" className={cn("inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg", focusRing)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Alerts
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Alert</p>
            <h1 className="font-display text-3xl leading-[1.05] tracking-tight sm:text-4xl balance-text">{alert.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={alert.active ? "aurora" : "outline"} size="sm" dot={alert.active} caps>
                {alert.active ? "Watching" : "Paused"}
              </Badge>
              <CabinBadge cabin={alert.cabin} size="sm" />
              <span className="text-xs text-fg-subtle">{alert.lastCheckedAt ? `checked ${relativeTime(alert.lastCheckedAt, now)}` : "not checked yet"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" leading={<RefreshCw />} loading={checking} onClick={() => check.mutate(alert.id)}>
              Check now
            </Button>
            <Button variant="secondary" size="sm" leading={alert.active ? <Pause /> : <Play />} loading={toggle.isPending} onClick={() => toggle.mutate({ id: alert.id, active: !alert.active })}>
              {alert.active ? "Pause" : "Resume"}
            </Button>
            <Button variant="secondary" size="sm" leading={<Pencil />} onClick={() => setForm({ open: true, mode: "edit" })}>
              Edit
            </Button>
            <Button variant="secondary" size="sm" leading={<Copy />} onClick={() => setForm({ open: true, mode: "duplicate" })}>
              Duplicate
            </Button>
            <Button variant="ghost" size="sm" leading={<Trash2 />} className="text-rose hover:text-rose" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Hits" tone="aurora" value={alert.hitCount} format={fmtInt} hint={alert.lastHitAt ? `last ${relativeTime(alert.lastHitAt, now)}` : "none yet"} />
        <StatTile
          label="Cheapest hit"
          tone="signal"
          value={stats.cheapest ? fmtCompact(stats.cheapest.miles).toUpperCase() : "—"}
          hint={stats.cheapest ? `${fmtDate(stats.cheapest.date)} · + ${fmtUsd(stats.cheapest.taxesUsd)}` : undefined}
        />
        <StatTile label="Days with space" tone="sky" value={stats.days} format={fmtInt} hint={`in ${fmtWindow(alert.dateFrom, alert.dateTo)}`} />
        <StatTile
          label="Top program"
          tone="gold"
          value={
            stats.topProgram ? (
              <span className="flex items-center gap-2 text-lg">
                <ProgramLogo id={stats.topProgram.id} name={stats.topProgram.name} color={stats.topProgram.color} size={28} />
                <span className="truncate font-sans font-medium tracking-normal">{stats.topProgram.shortName}</span>
              </span>
            ) : (
              "—"
            )
          }
          hint={stats.topProgram ? `${fmtInt(stats.topCount)} of ${fmtInt(hits.length)} hits` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-6">
          <Panel eyebrow="Hits by day" title="Where space showed up" description="Cells are coloured by seats found; the number is the cheapest hit that day. Click to search it.">
            {hits.length === 0 ? (
              <EmptyState
                compact
                title="No hits yet"
                description="Run a check now, or let the daily scan do its thing. We'll notify you the moment seats appear."
                action={
                  <Button variant="secondary" leading={<RefreshCw />} loading={checking} onClick={() => check.mutate(alert.id)}>
                    Check now
                  </Button>
                }
              />
            ) : (
              <AvailabilityCalendar
                months={months}
                from={alert.dateFrom}
                days={cells}
                minDate={alert.dateFrom}
                maxDate={alert.dateTo}
                onSelect={(date, day) => {
                  if (!day) return;
                  const hit = hits.find((h) => h.date === date);
                  if (hit) router.push(searchHref({ from: hit.origin, to: hit.destination, date, cabin: hit.cabin, passengers: alert.passengers }));
                }}
              />
            )}
          </Panel>

          {hits.length > 0 && (
            <Panel eyebrow="Every hit" title={`${fmtInt(hits.length)} ${hits.length === 1 ? "seat" : "seats"} found`} padding="none" bodyClassName="pt-2">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-panel-border font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">
                      <th scope="col" className="px-5 py-2.5 text-left font-medium sm:px-6">Date</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-medium">Route</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-medium">Carrier</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-medium">Program</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Miles</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Taxes</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Seats</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Found</th>
                      <th scope="col" className="px-5 py-2.5 sm:px-6">
                        <span className="sr-only">Search</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((h) => {
                      const airline = getAirline(h.carrier);
                      const program = getProgram(h.programId);
                      return (
                        <tr key={h.id} className="border-b border-panel-border last:border-0 hover:bg-fg/[0.03]">
                          <td className="px-5 py-2.5 font-mono tnum text-fg sm:px-6">{fmtDate(h.date)}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold tracking-wide text-fg">
                            {h.origin}
                            <span className="mx-1 text-fg-subtle">→</span>
                            {h.destination}
                          </td>
                          <td className="px-3 py-2.5">
                            <AirlineTail code={h.carrier} color={airline?.color} size={20} />
                          </td>
                          <td className="px-3 py-2.5">
                            {program ? <ProgramChip id={program.id} name={program.shortName} color={program.color} size="sm" /> : h.programId}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tnum text-fg">{fmtInt(h.miles)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tnum text-fg-muted">{fmtUsd(h.taxesUsd)}</td>
                          <td className="px-3 py-2.5 text-right font-mono tnum text-fg">{h.seats}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-fg-subtle">{relativeTime(h.foundAt, now)}</td>
                          <td className="px-5 py-2.5 text-right sm:px-6">
                            <Button size="sm" variant="ghost" href={searchHref({ from: h.origin, to: h.destination, date: h.date, cabin: h.cabin, passengers: alert.passengers })} trailing={<ArrowRight />}>
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
        </div>

        <Panel eyebrow="Rule" title="What we're watching" padding="sm" className="lg:sticky lg:top-20">
          <dl className="grid gap-3 text-sm">
            <Row label="Route">
              <span className="flex flex-wrap items-center gap-1.5">
                <RouteChips codes={alert.origins} />
                <ArrowRight className="size-3.5 text-fg-subtle" aria-hidden="true" />
                <RouteChips codes={alert.destinations} />
              </span>
            </Row>
            <Row label="Window">
              <span className="font-mono tnum">{fmtWindow(alert.dateFrom, alert.dateTo)}</span>
            </Row>
            <Row label="Cabin">{CABIN_LABEL[alert.cabin]}</Row>
            <Row label="Passengers">
              <span className="font-mono tnum">{alert.passengers}</span>
            </Row>
            <Row label="Max miles">{alert.maxMiles ? <span className="font-mono tnum">{fmtInt(alert.maxMiles)}</span> : "Any price"}</Row>
            <Row label="Programs">
              {programNames.length ? (
                <span className="flex flex-wrap gap-1">
                  {programNames.map((p) => (
                    <ProgramChip key={p.id} id={p.id} name={p.shortName} color={p.color} size="sm" />
                  ))}
                </span>
              ) : (
                "Any program"
              )}
            </Row>
            <Row label="Channels">{alert.channels.map((c) => ({ inapp: "In-app", email: "Email", push: "Push" })[c]).join(", ")}</Row>
            <Row label="Created">
              <span className="font-mono tnum">{fmtDate(alert.createdAt.slice(0, 10), { year: "numeric" })}</span>
            </Row>
          </dl>
        </Panel>
      </div>

      <AlertFormDialog open={form.open} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} mode={form.mode} alert={alert} onSaved={(saved) => form.mode === "duplicate" && router.push(`/alerts/${saved.id}`)} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          size="sm"
          title="Delete this alert?"
          description={`"${alert.name}" and its ${fmtInt(alert.hitCount)} hits will be removed. This can't be undone.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>
                Keep it
              </Button>
              <Button variant="danger" loading={del.isPending} onClick={() => del.mutate(alert.id, { onSuccess: () => router.push("/alerts") })}>
                Delete alert
              </Button>
            </>
          }
        >
          <p className="text-sm text-fg-muted">You can always recreate it from a search later.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-2">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle pt-0.5">{label}</dt>
      <dd className="min-w-0 text-fg">{children}</dd>
    </div>
  );
}
