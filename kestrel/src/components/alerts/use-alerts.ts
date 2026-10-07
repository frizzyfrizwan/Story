"use client";

/**
 * TanStack Query hooks for the alerts experience. Every mutation that flips visible state
 * (active switch, delete, mark read) is optimistic with rollback on error.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import type { AlertHit, AlertRule, Cabin } from "@/lib/types";

export interface AlertsPayload {
  alerts: AlertRule[];
  hits: AlertHit[];
}

export interface AlertDetailPayload {
  alert: AlertRule;
  hits: AlertHit[];
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsPayload {
  notifications: NotificationItem[];
  unread: number;
}

export interface AlertInput {
  name?: string;
  origins: string[];
  destinations: string[];
  dateFrom: string;
  dateTo: string;
  cabin: Cabin;
  passengers: number;
  maxMiles?: number;
  programs?: string[];
  channels: AlertRule["channels"];
}

export const alertKeys = {
  all: ["alerts"] as const,
  detail: (id: string) => ["alerts", id] as const,
  notifications: ["notifications"] as const,
};

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: alertKeys.all,
    queryFn: () => apiGet<AlertsPayload>("/api/alerts"),
    enabled,
    staleTime: 15_000,
  });
}

export function useAlertDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: alertKeys.detail(id),
    queryFn: () => apiGet<AlertDetailPayload>(`/api/alerts/${id}`),
    enabled,
    retry: (count, err) => (err instanceof Error && "status" in err && (err as { status: number }).status === 404 ? false : count < 1),
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: alertKeys.notifications,
    queryFn: () => apiGet<NotificationsPayload>("/api/notifications"),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Replace an alert everywhere it is cached. */
function patchCaches(qc: ReturnType<typeof useQueryClient>, id: string, patch: (a: AlertRule) => AlertRule) {
  qc.setQueryData<AlertsPayload>(alertKeys.all, (old) => (old ? { ...old, alerts: old.alerts.map((a) => (a.id === id ? patch(a) : a)) } : old));
  qc.setQueryData<AlertDetailPayload>(alertKeys.detail(id), (old) => (old ? { ...old, alert: patch(old.alert) } : old));
}

export function useToggleAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiPatch<{ alert: AlertRule }>(`/api/alerts/${id}`, { active }),
    onMutate: async ({ id, active }) => {
      await Promise.all([qc.cancelQueries({ queryKey: alertKeys.all }), qc.cancelQueries({ queryKey: alertKeys.detail(id) })]);
      const prevAll = qc.getQueryData<AlertsPayload>(alertKeys.all);
      const prevDetail = qc.getQueryData<AlertDetailPayload>(alertKeys.detail(id));
      patchCaches(qc, id, (a) => ({ ...a, active }));
      return { prevAll, prevDetail, id };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevAll) qc.setQueryData(alertKeys.all, ctx.prevAll);
      if (ctx?.prevDetail) qc.setQueryData(alertKeys.detail(ctx.id), ctx.prevDetail);
      toast.error("Couldn't update the alert", { description: err instanceof Error ? err.message : undefined });
    },
    onSuccess: ({ alert }) => patchCaches(qc, alert.id, () => alert),
    onSettled: (_d, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: alertKeys.all });
      void qc.invalidateQueries({ queryKey: alertKeys.detail(id) });
    },
  });
}

export function useCheckAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ newHits: number; hits: AlertHit[]; alert: AlertRule | null }>(`/api/alerts/${id}`),
    onSuccess: (data, id) => {
      if (data.alert) patchCaches(qc, id, () => data.alert as AlertRule);
      qc.setQueryData<AlertDetailPayload>(alertKeys.detail(id), (old) => (old && data.alert ? { alert: data.alert, hits: data.hits } : old));
      qc.setQueryData<AlertsPayload>(alertKeys.all, (old) => {
        if (!old) return old;
        const seen = new Set(old.hits.map((h) => h.id));
        const fresh = data.hits.filter((h) => !seen.has(h.id));
        return { ...old, hits: [...fresh, ...old.hits].sort((a, b) => b.foundAt.localeCompare(a.foundAt)).slice(0, 80) };
      });
      void qc.invalidateQueries({ queryKey: alertKeys.notifications });
      if (data.newHits > 0) {
        toast.success(`${data.newHits} new award seat${data.newHits === 1 ? "" : "s"} found`, {
          description: data.alert ? data.alert.name : undefined,
        });
      } else {
        toast.info("No new seats yet", { description: "We'll keep watching and notify you the moment space opens." });
      }
    },
    onError: (err) => toast.error("Check failed", { description: err instanceof Error ? err.message : undefined }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/api/alerts/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: alertKeys.all });
      const prevAll = qc.getQueryData<AlertsPayload>(alertKeys.all);
      qc.setQueryData<AlertsPayload>(alertKeys.all, (old) =>
        old ? { alerts: old.alerts.filter((a) => a.id !== id), hits: old.hits.filter((h) => h.alertId !== id) } : old,
      );
      return { prevAll };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prevAll) qc.setQueryData(alertKeys.all, ctx.prevAll);
      toast.error("Couldn't delete the alert", { description: err instanceof Error ? err.message : undefined });
    },
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: alertKeys.detail(id) });
      toast.success("Alert deleted");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: alertKeys.all }),
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AlertInput) => apiPost<{ alert: AlertRule }>("/api/alerts", input),
    onSuccess: ({ alert }) => {
      qc.setQueryData<AlertsPayload>(alertKeys.all, (old) => (old ? { ...old, alerts: [alert, ...old.alerts] } : old));
      void qc.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AlertInput> & { maxMiles?: number | null } }) =>
      apiPatch<{ alert: AlertRule }>(`/api/alerts/${id}`, input),
    onSuccess: ({ alert }) => {
      patchCaches(qc, alert.id, () => alert);
      void qc.invalidateQueries({ queryKey: alertKeys.detail(alert.id) });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => apiPost<{ unread: number }>("/api/notifications", ids?.length ? { ids } : {}),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: alertKeys.notifications });
      const prev = qc.getQueryData<NotificationsPayload>(alertKeys.notifications);
      qc.setQueryData<NotificationsPayload>(alertKeys.notifications, (old) => {
        if (!old) return old;
        const set = ids?.length ? new Set(ids) : null;
        const notifications = old.notifications.map((n) => (!set || set.has(n.id) ? { ...n, read: true } : n));
        return { notifications, unread: notifications.filter((n) => !n.read).length };
      });
      return { prev };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(alertKeys.notifications, ctx.prev);
      toast.error("Couldn't mark as read", { description: err instanceof Error ? err.message : undefined });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: alertKeys.notifications }),
  });
}
