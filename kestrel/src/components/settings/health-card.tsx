"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { cn, fmtDuration, fmtInt } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";

interface Health {
  ok: boolean;
  db: string;
  uptimeMs: number;
  latencyMs: number;
}

async function fetchHealth(): Promise<Health & { httpStatus: number }> {
  const res = await fetch("/api/health", { cache: "no-store", headers: { accept: "application/json" } });
  const json = (await res.json().catch(() => null)) as Health | null;
  if (!json) throw new Error(`Health endpoint returned ${res.status} without JSON`);
  return { ...json, httpStatus: res.status };
}

/** Live read of /api/health: database reachability, query latency, process uptime. */
export function HealthCard({ className }: { className?: string }) {
  const q = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 60_000, staleTime: 15_000 });
  const h = q.data;
  const dbOk = h?.db === "ok";

  return (
    <Panel
      as="div"
      eyebrow="Health"
      title="This deployment"
      className={className}
      actions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => q.refetch()}
          loading={q.isFetching && !q.isLoading}
          leading={<RefreshCw />}
          aria-label="Re-check health"
        >
          Re-check
        </Button>
      }
    >
      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : q.isError || !h ? (
        <p role="alert" className="text-sm text-rose">
          Couldn&apos;t reach /api/health{q.error instanceof Error ? ` — ${q.error.message}` : ""}.
        </p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="Database">
            <span className="flex items-center gap-2">
              <Badge variant={dbOk ? "aurora" : "rose"} dot pulse={dbOk} caps size="sm">
                {dbOk ? "OK" : "Error"}
              </Badge>
              {!dbOk && <span className="truncate text-[12px] text-rose">{h.db}</span>}
            </span>
          </Stat>
          <Stat label="Query latency">
            <span className="font-mono tnum">{fmtInt(h.latencyMs)} ms</span>
          </Stat>
          <Stat label="Process uptime">
            <span className="font-mono tnum">{fmtDuration(Math.round(h.uptimeMs / 60_000))}</span>
          </Stat>
        </dl>
      )}
      <p className={cn("mt-4 flex items-center gap-1.5 text-[12px] text-fg-subtle")}>
        <Activity className="size-3.5" aria-hidden="true" />
        Polls every minute. HTTP {h?.httpStatus ?? "—"} from <code className="text-fg-muted">GET /api/health</code>.
      </p>
    </Panel>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-1 px-3.5 py-3">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">{label}</dt>
      <dd className="mt-1.5 text-sm text-fg">{children}</dd>
    </div>
  );
}
