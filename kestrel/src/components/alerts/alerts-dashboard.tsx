"use client";

import { useEffect, useState } from "react";
import { BellPlus, LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, Section } from "@/components/ui/panel";
import { SkeletonCard } from "@/components/ui/skeleton";
import { loginHref } from "@/lib/client/api";
import type { AlertRule } from "@/lib/types";
import { fmtInt } from "@/lib/utils";
import { AlertCard } from "./alert-card";
import { AlertFormDialog, type AlertFormMode, type AlertFormValues } from "./alert-form-dialog";
import { HitsFeed } from "./hits-feed";
import { NotificationsPanel } from "./notifications-panel";
import { useAlerts, useDeleteAlert } from "./use-alerts";
import { useNow } from "./use-now";

/** Mirrors FREE_ALERT_LIMIT in lib/billing (server-only module). */
export const FREE_ALERT_LIMIT = 3;

export interface AlertsDashboardProps {
  user: { id: string; name?: string | null } | null;
  plan: "free" | "pro";
  /** Open the create dialog on mount with these values (from /alerts?new=1&from=…). */
  prefill?: (Partial<AlertFormValues> & { open?: boolean }) | null;
}

interface DialogState {
  open: boolean;
  mode: AlertFormMode;
  alert?: AlertRule | null;
}

export function AlertsDashboard({ user, plan, prefill }: AlertsDashboardProps) {
  const signedIn = Boolean(user);
  const now = useNow();
  const alertsQ = useAlerts(signedIn);
  const del = useDeleteAlert();
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: "create" });
  const [pendingDelete, setPendingDelete] = useState<AlertRule | null>(null);

  useEffect(() => {
    if (prefill?.open && signedIn) setDialog({ open: true, mode: "create", alert: null });
  }, [prefill?.open, signedIn]);

  if (!user) {
    return (
      <Panel grain padding="lg">
        <EmptyState
          title="Sign in to manage alerts"
          description="Alerts watch a route and a window every day and tell you the moment award space appears."
          action={
            <Button href={loginHref("/alerts")} leading={<LogIn />}>
              Sign in
            </Button>
          }
          secondaryAction={
            <Button variant="ghost" href="/explore">
              Explore deals instead
            </Button>
          }
        />
      </Panel>
    );
  }

  const alerts = alertsQ.data?.alerts ?? [];
  const hits = alertsQ.data?.hits ?? [];
  const activeCount = alerts.filter((a) => a.active).length;
  const atLimit = plan === "free" && activeCount >= FREE_ALERT_LIMIT;
  const totalHits = alerts.reduce((sum, a) => sum + a.hitCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <Section
        eyebrow="Alerts"
        title="Your award alerts"
        description={
          alertsQ.data
            ? alerts.length
              ? `${fmtInt(activeCount)} active · ${fmtInt(alerts.length - activeCount)} paused · ${fmtInt(totalHits)} ${totalHits === 1 ? "seat" : "seats"} found so far.`
              : "Nothing watching yet. Create an alert from any search, or start one here."
            : "Loading your alerts…"
        }
        actions={
          <Button onClick={() => setDialog({ open: true, mode: "create", alert: null })} leading={<BellPlus />}>
            New alert
          </Button>
        }
      />

      {plan === "free" && alertsQ.data && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle" role="status">
          <span className="font-mono tnum">
            {fmtInt(activeCount)} of {FREE_ALERT_LIMIT}
          </span>
          <span>free alerts used.</span>
          {atLimit && (
            <Link href="/pricing" className="inline-flex items-center gap-1 text-gold underline-offset-4 hover:underline">
              <Sparkles className="size-3" aria-hidden="true" />
              Upgrade to Pro for unlimited alerts
            </Link>
          )}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0">
          {alertsQ.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i} className="h-36" />
              ))}
            </div>
          ) : alertsQ.isError ? (
            <EmptyState
              title="Couldn't load your alerts"
              description={alertsQ.error instanceof Error ? alertsQ.error.message : undefined}
              action={
                <Button variant="secondary" onClick={() => alertsQ.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : alerts.length === 0 ? (
            <Panel grain padding="lg">
              <EmptyState
                title="No alerts yet"
                description="Create one from any search, or set up a route and a window here. We check every day and notify you in-app or by email."
                action={
                  <Button onClick={() => setDialog({ open: true, mode: "create", alert: null })} leading={<BellPlus />}>
                    Create your first alert
                  </Button>
                }
                secondaryAction={
                  <Button variant="ghost" href="/explore?view=calendar">
                    Browse a calendar
                  </Button>
                }
              />
            </Panel>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Alerts">
              {alerts.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  now={now}
                  onEdit={(alert) => setDialog({ open: true, mode: "edit", alert })}
                  onDuplicate={(alert) => setDialog({ open: true, mode: "duplicate", alert })}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Panel padding="sm" eyebrow="Found" title="Recent hits" description={hits.length ? "Newest first — tap one to search that day." : undefined}>
            <HitsFeed hits={hits} alerts={alerts} loading={alertsQ.isPending} now={now} />
          </Panel>
          <NotificationsPanel enabled={signedIn} now={now} />
        </aside>
      </div>

      <AlertFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        mode={dialog.mode}
        alert={dialog.alert}
        prefill={prefill ?? undefined}
      />

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent
          size="sm"
          title="Delete this alert?"
          description={pendingDelete ? `"${pendingDelete.name}" and its ${fmtInt(pendingDelete.hitCount)} hits will be removed. This can't be undone.` : undefined}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={del.isPending}>
                Keep it
              </Button>
              <Button
                variant="danger"
                loading={del.isPending}
                onClick={() => {
                  if (!pendingDelete) return;
                  del.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
                }}
              >
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
