"use client";

/**
 * Create an availability alert from the current search. Handles the two API refusals
 * explicitly: 401 → sign-in CTA, 402 → upgrade CTA.
 */

import { Bell, Lock, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Checkbox, DateRangePicker, Dialog, DialogContent, Field, Input, NumberStepper, toast } from "@/components/ui";
import { ApiError, apiPost, loginHref } from "@/lib/client/api";
import type { AlertRule, Cabin } from "@/lib/types";
import { CABIN_LABEL } from "@/lib/types";
import { addDays, clamp, fmtDate, todayISO } from "@/lib/utils";
import { expandCodes } from "./search-params";

export interface AlertPrefill {
  origins: string[];
  destinations: string[];
  /** Centre of the default ±14-day window. */
  date: string;
  cabin: Cabin;
  passengers: number;
  maxMiles?: number;
  programs?: string[];
}

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: AlertPrefill | null;
}

type Channel = AlertRule["channels"][number];
const CHANNELS: { id: Channel; label: string; description: string }[] = [
  { id: "inapp", label: "In-app", description: "Shown in your notifications" },
  { id: "email", label: "Email", description: "Sent when seats appear" },
  { id: "push", label: "Push", description: "Mobile push, where enabled" },
];

interface FormState {
  name: string;
  from: string | null;
  to: string | null;
  maxMiles: string;
  passengers: number;
  channels: Channel[];
}

function initialForm(p: AlertPrefill, today: string): FormState {
  const from = addDays(p.date, -14) < today ? today : addDays(p.date, -14);
  const route = `${p.origins.join("/")} → ${p.destinations.join("/")}`;
  return {
    name: `${route} · ${CABIN_LABEL[p.cabin]}`,
    from,
    to: addDays(p.date, 14),
    maxMiles: p.maxMiles ? String(Math.ceil(p.maxMiles / 5000) * 5000) : "",
    passengers: clamp(p.passengers, 1, 9),
    channels: ["inapp", "email"],
  };
}

export function AlertDialog({ open, onOpenChange, prefill }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {prefill && <AlertForm key={`${prefill.origins.join()}|${prefill.destinations.join()}|${prefill.date}|${prefill.cabin}|${prefill.maxMiles ?? ""}`} prefill={prefill} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function AlertForm({ prefill, onDone }: { prefill: AlertPrefill; onDone: () => void }) {
  const today = todayISO();
  const [form, setForm] = useState<FormState>(() => initialForm(prefill, today));
  const [submitting, setSubmitting] = useState(false);
  const [blocker, setBlocker] = useState<null | { kind: "auth" } | { kind: "upgrade"; message: string } | { kind: "error"; message: string }>(null);
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const dateError = !form.from || !form.to ? "Pick a start and end date" : form.to < form.from ? "End date must be after start date" : null;
  const maxMilesNum = form.maxMiles.trim() ? Number.parseInt(form.maxMiles.replace(/[^\d]/g, ""), 10) : null;
  const milesError = maxMilesNum != null && (!Number.isFinite(maxMilesNum) || maxMilesNum < 1000) ? "At least 1,000 miles" : null;
  const channelError = form.channels.length === 0 ? "Pick at least one channel" : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (dateError || milesError || channelError || !form.from || !form.to) return;
    setSubmitting(true);
    setBlocker(null);
    try {
      const { alert } = await apiPost<{ alert: AlertRule }>("/api/alerts", {
        name: form.name.trim().slice(0, 80) || undefined,
        origins: expandCodes(prefill.origins),
        destinations: expandCodes(prefill.destinations),
        dateFrom: form.from,
        dateTo: form.to,
        cabin: prefill.cabin,
        passengers: form.passengers,
        maxMiles: maxMilesNum ?? undefined,
        programs: prefill.programs?.length ? prefill.programs : undefined,
        channels: form.channels,
      });
      toast.success("Alert created", {
        description: `${alert.name} · ${fmtDate(alert.dateFrom)} – ${fmtDate(alert.dateTo)}`,
        action: { label: "View alerts", onClick: () => window.location.assign("/alerts") },
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.unauthenticated) setBlocker({ kind: "auth" });
      else if (err instanceof ApiError && err.upgrade) setBlocker({ kind: "upgrade", message: err.message });
      else setBlocker({ kind: "error", message: err instanceof Error ? err.message : "Could not create the alert" });
    } finally {
      setSubmitting(false);
    }
  };

  const route = `${prefill.origins.join("/")} → ${prefill.destinations.join("/")}`;

  return (
    <DialogContent
      eyebrow="Availability alert"
      title={route}
      description={`We check ${CABIN_LABEL[prefill.cabin].toLowerCase()} award space every few hours and tell you the moment seats appear.`}
      footer={
        <>
          <Button variant="ghost" onClick={onDone} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="search-alert-form" loading={submitting} leading={<Bell aria-hidden="true" />}>
            Create alert
          </Button>
        </>
      }
    >
      <form id="search-alert-form" onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} maxLength={80} placeholder="Tokyo in business, spring" />
        </Field>

        <Field label="Travel window" hint="Default is two weeks either side of your search date" error={dateError}>
          <DateRangePicker value={{ from: form.from, to: form.to }} onChange={(r) => patch({ from: r.from, to: r.to })} min={today} showNights={false} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Max miles" optional hint="Per person, one-way" error={milesError}>
            <Input
              mono
              inputMode="numeric"
              placeholder="e.g. 80000"
              value={form.maxMiles}
              onChange={(e) => patch({ maxMiles: e.target.value })}
              trailing={<span className="text-xs">miles</span>}
            />
          </Field>
          <Field label="Passengers">
            <div>
              <NumberStepper label="Passengers" unit="pax" value={form.passengers} onChange={(passengers) => patch({ passengers })} min={1} max={9} />
            </div>
          </Field>
        </div>

        <Field label="Notify me by" error={channelError}>
          <div className="grid gap-x-4 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <Checkbox
                key={c.id}
                label={c.label}
                description={c.description}
                checked={form.channels.includes(c.id)}
                onCheckedChange={(checked) => patch({ channels: checked === true ? Array.from(new Set([...form.channels, c.id])) : form.channels.filter((x) => x !== c.id) })}
              />
            ))}
          </div>
        </Field>

        {blocker?.kind === "auth" && (
          <div role="alert" className="flex flex-col gap-3 rounded-[12px] border border-sky/25 bg-sky-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-fg">
              <Lock className="size-4 text-sky" aria-hidden="true" />
              Sign in to create alerts — it takes ten seconds.
            </span>
            <Button size="sm" variant="secondary" href={loginHref()}>
              Sign in
            </Button>
          </div>
        )}
        {blocker?.kind === "upgrade" && (
          <div role="alert" className="flex flex-col gap-3 rounded-[12px] border border-gold/25 bg-gold-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2 text-fg">
              <Zap className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
              {blocker.message}
            </span>
            <Button size="sm" variant="secondary" href="/pricing">
              Upgrade to Pro
            </Button>
          </div>
        )}
        {blocker?.kind === "error" && (
          <p role="alert" className="text-sm text-rose">
            {blocker.message}
          </p>
        )}
      </form>
    </DialogContent>
  );
}
