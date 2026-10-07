"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { AirportCombobox } from "@/components/ui/airport-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRangePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { CabinPicker } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { NumberStepper } from "@/components/ui/stepper";
import { toast } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/tokens";
import { fetchAirports, POPULAR_ORIGINS } from "@/components/explore/airports";
import { AIRLINE_PROGRAMS } from "@/data/programs";
import { ApiError, loginHref } from "@/lib/client/api";
import type { AlertRule, Cabin } from "@/lib/types";
import { addDays, cn, fmtCompact, todayISO } from "@/lib/utils";
import { useCreateAlert, useUpdateAlert, type AlertInput } from "./use-alerts";

export type AlertFormMode = "create" | "edit" | "duplicate";

export interface AlertFormValues {
  name: string;
  origins: string[];
  destinations: string[];
  dateFrom: string | null;
  dateTo: string | null;
  cabin: Cabin;
  passengers: number;
  /** 0 = no cap */
  maxMiles: number;
  programs: string[];
  channels: AlertRule["channels"];
}

export interface AlertFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AlertFormMode;
  /** Source rule for edit / duplicate. */
  alert?: AlertRule | null;
  /** Partial prefill (from a search or an explore link) for create. */
  prefill?: Partial<AlertFormValues>;
  onSaved?: (alert: AlertRule) => void;
}

const MAX_MILES = 300_000;
const MILES_STEP = 5_000;

function defaults(): AlertFormValues {
  const from = todayISO();
  return {
    name: "",
    origins: [],
    destinations: [],
    dateFrom: from,
    dateTo: addDays(from, 60),
    cabin: "business",
    passengers: 1,
    maxMiles: 0,
    programs: [],
    channels: ["inapp", "email"],
  };
}

function fromRule(alert: AlertRule, mode: AlertFormMode): AlertFormValues {
  return {
    name: mode === "duplicate" ? `${alert.name} (copy)` : alert.name,
    origins: alert.origins,
    destinations: alert.destinations,
    dateFrom: alert.dateFrom,
    dateTo: alert.dateTo,
    cabin: alert.cabin,
    passengers: alert.passengers,
    maxMiles: alert.maxMiles ?? 0,
    programs: alert.programs ?? [],
    channels: alert.channels.length ? alert.channels : ["inapp"],
  };
}

const TITLES: Record<AlertFormMode, { title: string; eyebrow: string; cta: string }> = {
  create: { title: "Create an alert", eyebrow: "New alert", cta: "Create alert" },
  edit: { title: "Edit alert", eyebrow: "Alert", cta: "Save changes" },
  duplicate: { title: "Duplicate alert", eyebrow: "New alert", cta: "Create copy" },
};

/** Create / edit / duplicate form. 402 shows an upgrade CTA inline; 401 bounces to login. */
export function AlertFormDialog({ open, onOpenChange, mode, alert, prefill, onSaved }: AlertFormDialogProps) {
  const router = useRouter();
  const create = useCreateAlert();
  const update = useUpdateAlert();
  const [values, setValues] = useState<AlertFormValues>(defaults);
  const [errors, setErrors] = useState<Partial<Record<keyof AlertFormValues, string>>>({});
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [programQuery, setProgramQuery] = useState("");

  // Re-seed the form on the closed → open edge only, so a background refetch of `alert` never wipes edits in progress.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setErrors({});
      setUpgrade(null);
      setProgramQuery("");
      if (alert && mode !== "create") setValues(fromRule(alert, mode));
      else setValues({ ...defaults(), ...stripUndefined(prefill ?? {}) });
    }
    wasOpen.current = open;
  }, [open, alert, mode, prefill]);

  const set = <K extends keyof AlertFormValues>(key: K, value: AlertFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const saving = create.isPending || update.isPending;
  const copy = TITLES[mode];

  const visiblePrograms = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    return q ? AIRLINE_PROGRAMS.filter((p) => p.name.toLowerCase().includes(q) || p.shortName.toLowerCase().includes(q)) : AIRLINE_PROGRAMS;
  }, [programQuery]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!values.origins.length) next.origins = "Pick at least one origin";
    if (!values.destinations.length) next.destinations = "Pick at least one destination";
    if (!values.dateFrom || !values.dateTo) next.dateFrom = "Pick a date window";
    else if (values.dateTo < values.dateFrom) next.dateFrom = "End date must be after the start";
    if (!values.channels.length) next.channels = "Choose at least one channel";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate() || !values.dateFrom || !values.dateTo) return;
    const input: AlertInput = {
      name: values.name.trim() || undefined,
      origins: values.origins,
      destinations: values.destinations,
      dateFrom: values.dateFrom,
      dateTo: values.dateTo,
      cabin: values.cabin,
      passengers: values.passengers,
      maxMiles: values.maxMiles > 0 ? values.maxMiles : undefined,
      programs: values.programs.length ? values.programs : undefined,
      channels: values.channels,
    };
    try {
      const saved =
        mode === "edit" && alert
          ? (await update.mutateAsync({ id: alert.id, input: { ...input, name: values.name.trim() || alert.name, maxMiles: values.maxMiles > 0 ? values.maxMiles : null, programs: values.programs } })).alert
          : (await create.mutateAsync(input)).alert;
      toast.success(mode === "edit" ? "Alert updated" : "Alert created", {
        description: `${saved.origins.join("/")} → ${saved.destinations.join("/")} · we'll check daily.`,
      });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.unauthenticated) {
        router.push(loginHref());
        return;
      }
      if (err instanceof ApiError && err.upgrade) {
        setUpgrade(err.message);
        return;
      }
      toast.error("Couldn't save the alert", { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        size="lg"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description="We scan every day and tell you the moment award space appears in your window."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving}>
              {copy.cta}
            </Button>
          </>
        }
      >
        {upgrade && (
          <div className="mb-5 flex flex-col gap-3 rounded-[var(--radius)] border border-gold/30 bg-gold-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-fg">Free plan limit reached</p>
                <p className="text-[13px] text-fg-muted">{upgrade}</p>
              </div>
            </div>
            <Button size="sm" href="/pricing" className="shrink-0">
              Upgrade to Pro
            </Button>
          </div>
        )}

        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Name" optional hint="Leave blank and we'll name it after the route.">
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Tokyo in sakura season, lie-flat" maxLength={80} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="From" error={errors.origins} required>
              <AirportCombobox
                multiple
                max={6}
                value={values.origins}
                onChange={(codes) => set("origins", codes)}
                fetcher={fetchAirports}
                recent={POPULAR_ORIGINS}
                placeholder="Origins"
              />
            </Field>
            <Field label="To" error={errors.destinations} required>
              <AirportCombobox
                multiple
                max={6}
                value={values.destinations}
                onChange={(codes) => set("destinations", codes)}
                fetcher={fetchAirports}
                placeholder="Destinations"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Travel window" error={errors.dateFrom} required>
              <DateRangePicker
                value={{ from: values.dateFrom, to: values.dateTo }}
                onChange={(range) => setValues((v) => ({ ...v, dateFrom: range.from, dateTo: range.to }))}
                placeholder="Pick a window"
              />
            </Field>
            <NumberStepper label="Passengers" value={values.passengers} onChange={(n) => set("passengers", n)} min={1} max={9} unit="pax" className="sm:mt-7" />
          </div>

          <Field label="Cabin">
            <CabinPicker value={values.cabin} onChange={(c) => set("cabin", c)} fullWidth />
          </Field>

          <Slider
            label="Max miles per seat"
            value={[values.maxMiles]}
            onValueChange={([m]) => set("maxMiles", m)}
            min={0}
            max={MAX_MILES}
            step={MILES_STEP}
            marks={[50_000, 100_000, 150_000, 200_000, 250_000]}
            formatValue={(v) => (v <= 0 ? "No cap" : fmtCompact(v).toUpperCase())}
            tone="aurora"
          />

          <Field
            label="Programs"
            optional
            hint={values.programs.length ? `${values.programs.length} selected — only these programs will trigger.` : "Any program. Pick a few to narrow it down."}
            labelAction={
              <input
                type="search"
                value={programQuery}
                onChange={(e) => setProgramQuery(e.target.value)}
                placeholder="Filter…"
                aria-label="Filter programs"
                className="h-7 w-28 rounded-full border border-panel-border bg-bg-elev-1 px-2.5 text-xs text-fg outline-none placeholder:text-fg-subtle focus-visible:border-signal/60"
              />
            }
          >
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-1 p-2 scrollbar-thin" role="group" aria-label="Programs">
              {visiblePrograms.map((p) => {
                const on = values.programs.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("programs", on ? values.programs.filter((id) => id !== p.id) : [...values.programs, p.id])}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                      on ? "border-signal/40 bg-signal-soft text-signal" : "border-panel-border bg-bg-elev-2 text-fg-muted hover:border-panel-border-strong hover:text-fg",
                      focusRing,
                    )}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                    {p.shortName}
                  </button>
                );
              })}
              {visiblePrograms.length === 0 && <span className="px-1 py-1 text-xs text-fg-subtle">No programs match</span>}
            </div>
          </Field>

          <Field label="Notify me" error={errors.channels}>
            <div className="flex flex-wrap gap-x-6">
              {(
                [
                  ["inapp", "In-app", "Shows in your notifications"],
                  ["email", "Email", "One digest per scan"],
                ] as const
              ).map(([id, label, description]) => (
                <Checkbox
                  key={id}
                  label={label}
                  description={description}
                  checked={values.channels.includes(id)}
                  onCheckedChange={(c) => set("channels", c === true ? Array.from(new Set([...values.channels, id])) : values.channels.filter((ch) => ch !== id))}
                />
              ))}
            </div>
          </Field>
          <button type="submit" className="sr-only">
            {copy.cta}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
