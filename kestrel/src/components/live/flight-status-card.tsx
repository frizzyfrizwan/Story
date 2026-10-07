"use client";

import { Crosshair, RotateCw, SearchX, Sparkles, TriangleAlert } from "lucide-react";
import type { FlightStatus } from "@/lib/types";
import { getAirline } from "@/data/airlines";
import { getAirport } from "@/data/airports";
import { AirlineTail } from "@/components/art";
import { Badge, Button, DatePicker, SkeletonCard } from "@/components/ui";
import { BoardingPass, RouteLine } from "@/components/viz";
import { cn, fmtDate, fmtTime, todayISO } from "@/lib/utils";
import { STATUS_LABEL, STATUS_VARIANT, displayFlight, fmtAltitude, altitudeFt } from "./live-utils";

/**
 * <FlightStatusCard> — a flight's status as a boarding pass: route + cities, a RouteLine whose
 * plane sits at `progress`, scheduled vs estimated times, delay / status badges, aircraft and
 * gate details on the stub, and two actions: track it on the map, or search award seats for
 * the same route.
 *
 * <FlightStatusError> — the 404 / failure state with a date picker to retry another day.
 * <FlightStatusSkeleton> — loading placeholder shaped like the pass.
 */

const BIG_DELAY_MIN = 15;

function City({ code, align }: { code: string; align: "left" | "right" }) {
  const ap = getAirport(code);
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <div className="truncate text-sm font-medium text-fg">{ap?.city ?? code}</div>
      <div className="truncate text-[11px] text-fg-subtle">{ap ? ap.name : "Unknown airport"}</div>
    </div>
  );
}

function TimeCell({
  label,
  scheduled,
  estimated,
  bigDelay,
}: {
  label: string;
  scheduled: string;
  estimated?: string;
  bigDelay: boolean;
}) {
  const changed = Boolean(estimated && fmtTime(estimated) !== fmtTime(scheduled));
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "font-mono text-2xl font-medium tnum leading-none",
            changed ? "text-fg-subtle line-through decoration-fg-faint" : "text-fg",
          )}
        >
          {fmtTime(scheduled)}
        </span>
        {changed && estimated && (
          <span className={cn("font-mono text-2xl font-medium tnum leading-none", bigDelay ? "text-rose" : "text-signal")}>
            {fmtTime(estimated)}
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-fg-subtle">
        {fmtDate((estimated ?? scheduled).slice(0, 10))} · local
      </div>
    </div>
  );
}

function StubRow({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0">
      <dt className="text-[9.5px] uppercase tracking-[0.18em] text-fg-subtle">{k}</dt>
      <dd className="truncate font-medium text-fg">{v ?? "—"}</dd>
    </div>
  );
}

export interface FlightStatusCardProps {
  status: FlightStatus;
  /** Fly the map to the aircraft's reported position (only offered when one exists). */
  onTrack?: (position: { lat: number; lon: number }) => void;
  className?: string;
}

export function FlightStatusCard({ status, onTrack, className }: FlightStatusCardProps) {
  const airline = getAirline(status.carrier);
  const flight = `${status.carrier}${status.flightNumber}`;
  const delay = status.delayMin ?? 0;
  const bigDelay = delay > BIG_DELAY_MIN;
  const state = status.status;

  const progress = state === "landed" ? 1 : state === "active" ? (status.progress ?? 0.5) : 0;
  const pct = Math.round(progress * 100);
  const caption =
    state === "active"
      ? `${pct}% flown${status.position ? ` · ${fmtAltitude(altitudeFt({ altitudeM: status.position.altitudeM }))}` : ""}`
      : state === "landed"
        ? "Arrived"
        : state === "cancelled"
          ? "Cancelled"
          : state === "diverted"
            ? "Diverted"
            : state === "delayed"
              ? `Delayed · +${delay} min`
              : "Nonstop";

  const stub = (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px] sm:grid-cols-1 sm:gap-y-2.5">
      <StubRow k="Aircraft" v={status.aircraft} />
      <StubRow k="Reg" v={status.registration} />
      <StubRow k="Terminal" v={status.terminal} />
      <StubRow k="Gate" v={status.gate} />
    </dl>
  );

  return (
    <BoardingPass
      id={`${flight}-${status.date}`}
      className={className}
      carrierColor={airline?.color}
      carrier={
        <>
          <AirlineTail code={status.carrier} color={airline?.color} size={20} showCode={false} />
          <span className="truncate">
            {airline?.name ?? status.carrier} · {displayFlight(flight)}
          </span>
        </>
      }
      label={
        <span className="flex items-center gap-1.5">
          {delay > 0 && (
            <Badge variant={bigDelay ? "rose" : "gold"} size="sm" icon={bigDelay ? <TriangleAlert /> : undefined}>
              +{delay} min
            </Badge>
          )}
          <Badge variant={STATUS_VARIANT[state]} size="sm" dot pulse={state === "active"} caps>
            {STATUS_LABEL[state]}
          </Badge>
        </span>
      }
      main={
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <City code={status.origin} align="left" />
            <City code={status.destination} align="right" />
          </div>
          <RouteLine
            origin={status.origin}
            destination={status.destination}
            progress={progress}
            carrierColor={airline?.color}
            caption={caption}
            className="mx-auto"
          />
          <div className="grid grid-cols-2 gap-4 border-t border-panel-border pt-3">
            <TimeCell label="Departs" scheduled={status.scheduledDeparture} estimated={status.estimatedDeparture} bigDelay={bigDelay} />
            <TimeCell label="Arrives" scheduled={status.scheduledArrival} estimated={status.estimatedArrival} bigDelay={bigDelay} />
          </div>
        </div>
      }
      stub={stub}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leading={<Crosshair />}
            disabled={!status.position || !onTrack}
            onClick={() => status.position && onTrack?.(status.position)}
          >
            Track on map
          </Button>
          <Button
            size="sm"
            variant="primary"
            leading={<Sparkles />}
            href={`/search?from=${encodeURIComponent(status.origin)}&to=${encodeURIComponent(status.destination)}&cabin=business`}
          >
            Find award seats
          </Button>
          <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle sm:inline">
            {status.source === "simulated" ? "Demo data" : status.source}
          </span>
        </div>
      }
      barcodeText={`${flight} · ${status.date}`}
    />
  );
}

// ─── Error / not found ─────────────────────────────────────────

export interface FlightStatusErrorProps {
  flight: string;
  date: string;
  kind?: "not-found" | "error";
  message?: string;
  onDateChange: (date: string) => void;
  onRetry?: () => void;
  className?: string;
}

export function FlightStatusError({
  flight,
  date,
  kind = "not-found",
  message,
  onDateChange,
  onRetry,
  className,
}: FlightStatusErrorProps) {
  const when = date === todayISO() ? "today" : `on ${fmtDate(date)}`;
  const notFound = kind === "not-found";
  return (
    <div
      role="alert"
      className={cn(
        "animate-rise rounded-[var(--radius-lg)] border border-dashed border-panel-border-strong bg-bg-elev-1/70 px-5 py-6 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto grid size-12 place-items-center rounded-full border",
          notFound ? "border-rose/30 bg-rose-soft text-rose" : "border-gold/30 bg-gold-soft text-gold",
        )}
      >
        {notFound ? <SearchX className="size-5" aria-hidden="true" /> : <TriangleAlert className="size-5" aria-hidden="true" />}
      </div>
      <h3 className="mt-4 font-display text-lg tracking-tight text-fg balance-text">
        {notFound ? `We couldn't find ${displayFlight(flight)} ${when}` : `Status lookup for ${displayFlight(flight)} failed`}
      </h3>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-fg-muted pretty-text">
        {message ??
          (notFound
            ? "Check the number or try another date — schedules roll over at midnight local time."
            : "The status provider didn't answer. Try again in a moment.")}
      </p>
      <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <DatePicker
          value={date}
          onChange={(iso) => iso && onDateChange(iso)}
          allowPast
          clearable={false}
          size="sm"
          className="sm:w-48"
        />
        {onRetry && (
          <Button size="sm" variant="secondary" leading={<RotateCw />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function FlightStatusSkeleton({ className }: { className?: string }) {
  return <SkeletonCard variant="boarding-pass" className={className} />;
}
