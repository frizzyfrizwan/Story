"use client";

import { Crosshair, Plane, X } from "lucide-react";
import type { ReactNode } from "react";
import type { LiveAircraft } from "@/lib/types";
import { getAirline } from "@/data/airlines";
import { AirlineTail } from "@/components/art";
import { Badge, Button, Divider, IconButton, SourceBadge } from "@/components/ui";
import { NumberRoll } from "@/components/viz";
import { cn, fmtDate } from "@/lib/utils";
import { FlightStatusCard, FlightStatusError, FlightStatusSkeleton } from "./flight-status-card";
import { isNotFound, type FlightStatusQuery } from "./use-flight-status";
import {
  PHASE_TONE,
  altitudeFt,
  compass,
  deriveFlight,
  fmtHeading,
  phaseOf,
  speedKt,
  verticalFpm,
  type FlightPhase,
} from "./live-utils";

/**
 * <AircraftPanel> — the selected aircraft: identity (callsign, carrier tail, flight number), live
 * readouts (altitude, speed, heading, vertical speed, country, ICAO24), and the derived flight's
 * status as a <FlightStatusCard>. The status query is owned by the parent so the map can draw the
 * route from the same data.
 */

const PHASE_VARIANT: Record<(typeof PHASE_TONE)[FlightPhase], "aurora" | "sky" | "signal" | "neutral"> = {
  aurora: "aurora",
  sky: "sky",
  signal: "signal",
  muted: "neutral",
};

function Readout({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[10px] border border-panel-border bg-bg-elev-2/60 px-3 py-2", className)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">{label}</div>
      <div className="mt-1 truncate font-mono text-base font-medium tnum leading-none text-fg">{value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-fg-subtle">{sub}</div>}
    </div>
  );
}

export interface AircraftPanelProps {
  aircraft: LiveAircraft;
  /** False when the aircraft left the latest frame (we keep the last snapshot). */
  inView: boolean;
  source: "live" | "simulated" | null;
  /** Status lookup for the derived flight number. */
  status: FlightStatusQuery;
  statusDate: string;
  onStatusDateChange: (date: string) => void;
  onTrack: (lonlat: [number, number]) => void;
  onClose?: () => void;
  /** Hide the close button (the surrounding sheet has its own). */
  inSheet?: boolean;
  className?: string;
}

export function AircraftPanel({
  aircraft: ac,
  inView,
  source,
  status,
  statusDate,
  onStatusDateChange,
  onTrack,
  onClose,
  inSheet,
  className,
}: AircraftPanelProps) {
  const airline = ac.carrier ? getAirline(ac.carrier) : undefined;
  const flight = deriveFlight(ac);
  const phase = phaseOf(ac);
  const ft = altitudeFt(ac);
  const kt = speedKt(ac);
  const fpm = verticalFpm(ac);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start gap-3">
        {airline ? (
          <AirlineTail code={airline.iata} color={airline.color} size={40} showCode={false} className="mt-0.5" />
        ) : (
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-panel-border bg-bg-elev-2 text-fg-subtle">
            <Plane className="size-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-mono text-2xl font-semibold tracking-wider text-fg">{ac.callsign ?? ac.icao24.toUpperCase()}</h2>
            {flight && <span className="font-mono text-sm tracking-wider text-fg-subtle">{flight.display}</span>}
          </div>
          <p className="truncate text-sm text-fg-muted">
            {airline?.name ?? "Unknown operator"} · {ac.originCountry}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={PHASE_VARIANT[PHASE_TONE[phase]]} size="sm" dot pulse={inView && phase !== "ON GROUND"} caps>
              {phase}
            </Badge>
            {source && <SourceBadge source={source} />}
            {!inView && (
              <Badge variant="outline" size="sm" caps title="This aircraft is outside the current view; showing its last reported position.">
                Out of view
              </Badge>
            )}
          </div>
        </div>
        {!inSheet && onClose && (
          <IconButton label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
            <X />
          </IconButton>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Readout label="Altitude" value={ft == null ? "—" : <NumberRoll value={ft} suffix={<span className="ml-1 text-[11px] text-fg-subtle">ft</span>} />} />
        <Readout label="Speed" value={kt == null ? "—" : <NumberRoll value={kt} suffix={<span className="ml-1 text-[11px] text-fg-subtle">kt</span>} />} />
        <Readout label="Heading" value={fmtHeading(ac.heading)} sub={compass(ac.heading) || undefined} />
        <Readout
          label="Vertical"
          value={fpm == null ? "—" : `${fpm > 0 ? "+" : ""}${fpm.toLocaleString("en-US")}`}
          sub="ft / min"
        />
        <Readout label="Position" value={`${ac.lat.toFixed(2)}, ${ac.lon.toFixed(2)}`} sub={ac.onGround ? "on ground" : "airborne"} />
        <Readout label="ICAO24" value={ac.icao24.toUpperCase()} sub="transponder" />
      </div>

      <Button size="sm" variant="secondary" leading={<Crosshair />} onClick={() => onTrack([ac.lon, ac.lat])} className="self-start">
        Centre on aircraft
      </Button>

      <Divider label={flight ? `Flight ${flight.display}` : "Flight"} />

      {!flight ? (
        <p className="rounded-[10px] border border-dashed border-panel-border-strong px-4 py-5 text-center text-sm text-fg-muted">
          No airline flight number on this callsign, so there is no schedule to look up.
        </p>
      ) : status.isPending ? (
        <FlightStatusSkeleton />
      ) : status.data ? (
        <FlightStatusCard status={status.data} onTrack={(p) => onTrack([p.lon, p.lat])} />
      ) : (
        <FlightStatusError
          flight={flight.flight}
          date={statusDate}
          kind={isNotFound(status.error) ? "not-found" : "error"}
          onDateChange={onStatusDateChange}
          onRetry={() => void status.refetch()}
        />
      )}
      {flight && status.data && statusDate !== status.data.date && (
        <p className="text-center text-[11px] text-fg-subtle">Showing {fmtDate(status.data.date)}</p>
      )}
    </div>
  );
}
