import type { Airport, FlightStatus, FlightStatusState, LiveAircraft, RouteDef } from "@/lib/types";
import { carrierFromCallsign, getAirline } from "@/data/airlines";
import { getAirport } from "@/data/airports";
import { ROUTES } from "@/data/routes";
import type { MapBBox } from "@/components/viz";
import { clamp, haversineMiles } from "@/lib/utils";

/**
 * Pure helpers for the Live experience: unit conversion, callsign → flight number, phase of
 * flight, bbox rounding for the query key, and route derivation (guarded — ROUTES may be empty).
 */

// ─── Units ────────────────────────────────────────────────────

export const M_TO_FT = 3.28084;
export const MS_TO_KT = 1.94384;
export const MS_TO_FPM = 196.85;

export function altitudeFt(ac: Pick<LiveAircraft, "altitudeM">): number | null {
  return ac.altitudeM == null ? null : Math.round((ac.altitudeM * M_TO_FT) / 100) * 100;
}

export function speedKt(ac: Pick<LiveAircraft, "velocityMs">): number | null {
  return ac.velocityMs == null ? null : Math.round(ac.velocityMs * MS_TO_KT);
}

export function verticalFpm(ac: Pick<LiveAircraft, "verticalRateMs">): number | null {
  return ac.verticalRateMs == null ? null : Math.round((ac.verticalRateMs * MS_TO_FPM) / 50) * 50;
}

/** "FL350" for cruise altitudes, "2,400 ft" below the transition. */
export function fmtAltitude(ft: number | null): string {
  if (ft == null) return "—";
  if (ft >= 18_000) return `FL${Math.round(ft / 100)}`;
  return `${ft.toLocaleString("en-US")} ft`;
}

export function fmtHeading(deg: number | null): string {
  if (deg == null) return "—";
  const d = ((Math.round(deg) % 360) + 360) % 360;
  return `${String(d).padStart(3, "0")}°`;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compass(deg: number | null): string {
  if (deg == null) return "";
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ─── Flight identity ──────────────────────────────────────────

export interface DerivedFlight {
  /** IATA carrier, e.g. "SQ" */
  carrier: string;
  /** Digits + optional suffix, e.g. "22" */
  number: string;
  /** "SQ22" — what /api/live/status accepts */
  flight: string;
  /** "SQ 22" — for display */
  display: string;
}

/**
 * "SIA22" → SQ 22 via the ICAO → IATA table; "UA1234" (IATA-style callsigns) also works.
 * Returns null for private / unknown callsigns.
 */
export function deriveFlight(ac: Pick<LiveAircraft, "callsign" | "carrier">): DerivedFlight | null {
  const cs = ac.callsign?.trim().toUpperCase();
  if (!cs) return null;
  const carrier = ac.carrier?.toUpperCase() ?? carrierFromCallsign(cs);
  if (!carrier) return null;
  const airline = getAirline(carrier);
  let rest = "";
  if (airline?.icao && cs.startsWith(airline.icao)) rest = cs.slice(airline.icao.length);
  else if (cs.startsWith(carrier)) rest = cs.slice(carrier.length);
  else rest = cs.replace(/^[A-Z]{3}/, "");
  const m = /^(\d{1,4}[A-Z]?)$/.exec(rest);
  if (!m) return null;
  const number = m[1].replace(/^0+(?=\d)/, "");
  return { carrier, number, flight: `${carrier}${number}`, display: `${carrier} ${number}` };
}

/** "sq 22" / "SQ22" / "ua 1" → "SQ22"; null when it is not a flight number. */
export function normaliseFlightInput(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(s);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

/** "SQ22" → "SQ 22" */
export function displayFlight(flight: string): string {
  const m = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(flight.toUpperCase());
  return m ? `${m[1]} ${m[2]}` : flight.toUpperCase();
}

// ─── Phase of flight ──────────────────────────────────────────

export type FlightPhase = "CLIMBING" | "CRUISING" | "DESCENDING" | "ON GROUND";

export function phaseOf(ac: Pick<LiveAircraft, "verticalRateMs" | "onGround">): FlightPhase {
  if (ac.onGround) return "ON GROUND";
  const v = ac.verticalRateMs ?? 0;
  if (v > 1.5) return "CLIMBING";
  if (v < -1.5) return "DESCENDING";
  return "CRUISING";
}

export const PHASE_TONE: Record<FlightPhase, "aurora" | "sky" | "signal" | "muted"> = {
  CLIMBING: "aurora",
  CRUISING: "sky",
  DESCENDING: "signal",
  "ON GROUND": "muted",
};

// ─── Status presentation ──────────────────────────────────────

export const STATUS_LABEL: Record<FlightStatusState, string> = {
  scheduled: "Scheduled",
  active: "In flight",
  landed: "Landed",
  cancelled: "Cancelled",
  diverted: "Diverted",
  delayed: "Delayed",
  unknown: "Unknown",
};

export const STATUS_VARIANT: Record<FlightStatusState, "sky" | "aurora" | "neutral" | "rose" | "gold" | "signal" | "outline"> = {
  scheduled: "sky",
  active: "aurora",
  landed: "neutral",
  cancelled: "rose",
  diverted: "gold",
  delayed: "signal",
  unknown: "outline",
};

// ─── Bounding box ─────────────────────────────────────────────

/** Round outward to half-degree steps so small pans reuse the same query key (and cache). */
export function roundBBox(b: MapBBox, step = 0.5): MapBBox {
  const down = (n: number) => Math.floor(n / step) * step;
  const up = (n: number) => Math.ceil(n / step) * step;
  let lamin = clamp(down(b.lamin), -90, 90);
  let lamax = clamp(up(b.lamax), -90, 90);
  let lomin = clamp(down(b.lomin), -180, 180);
  let lomax = clamp(up(b.lomax), -180, 180);
  if (lamin >= lamax) {
    lamin = clamp(lamin - step, -90, 89);
    lamax = clamp(lamax + step, lamin + step, 90);
  }
  if (lomin >= lomax) {
    lomin = clamp(lomin - step, -180, 179);
    lomax = clamp(lomax + step, lomin + step, 180);
  }
  return { lamin, lomin, lamax, lomax };
}

export function bboxCenter(b: MapBBox): [number, number] {
  return [(b.lomin + b.lomax) / 2, (b.lamin + b.lamax) / 2];
}

/** Evenly-strided sample that preserves spatial spread (the API sorts by callsign, so this is unbiased). */
export function sampleAircraft<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const out: T[] = new Array(max);
  const stride = list.length / max;
  for (let i = 0; i < max; i++) out[i] = list[Math.floor(i * stride)];
  return out;
}

// ─── Routes (guarded — ROUTES may still be a stub) ────────────

const ROUTE_BY_FLIGHT: Map<string, RouteDef> | null = (() => {
  if (!ROUTES.length) return null;
  const m = new Map<string, RouteDef>();
  for (const r of ROUTES) {
    const fn = r.flightNumber?.replace(/\s+/g, "").toUpperCase();
    // Only full flight numbers ("SQ22") are addressable; bare prefixes ("SQ") are not.
    if (fn && /\d/.test(fn)) m.set(fn, r);
  }
  return m.size ? m : null;
})();

export interface RouteEnds {
  origin: string;
  destination: string;
  from?: Airport;
  to?: Airport;
}

/** Origin/destination for a flight number from the curated route table, when it carries full numbers. */
export function routeForFlight(flight: string | null | undefined): RouteEnds | null {
  if (!flight || !ROUTE_BY_FLIGHT) return null;
  const r = ROUTE_BY_FLIGHT.get(flight.replace(/\s+/g, "").toUpperCase());
  if (!r) return null;
  return { origin: r.origin, destination: r.destination, from: getAirport(r.origin), to: getAirport(r.destination) };
}

export function routeFromStatus(status: FlightStatus | null | undefined): RouteEnds | null {
  if (!status) return null;
  return {
    origin: status.origin,
    destination: status.destination,
    from: getAirport(status.origin),
    to: getAirport(status.destination),
  };
}

// ─── Geometry ─────────────────────────────────────────────────

/** Nautical miles between an aircraft and a point. */
export function distanceNm(ac: Pick<LiveAircraft, "lat" | "lon">, lonlat: [number, number]): number {
  return Math.round(haversineMiles(ac.lat, ac.lon, lonlat[1], lonlat[0]) * 0.868976);
}

export function nearestAircraft(list: LiveAircraft[], lonlat: [number, number], limit: number): { ac: LiveAircraft; nm: number }[] {
  const scored = list.map((ac) => ({ ac, nm: distanceNm(ac, lonlat) }));
  scored.sort((a, b) => a.nm - b.nm || (a.ac.callsign ?? "").localeCompare(b.ac.callsign ?? ""));
  return scored.slice(0, limit);
}

/** Seconds since an epoch-seconds or epoch-ms timestamp, clamped at zero. */
export function secondsAgo(now: number, then: number | null | undefined): number | null {
  if (then == null) return null;
  const ms = then < 1e12 ? then * 1000 : then;
  return Math.max(0, Math.round((now - ms) / 1000));
}

export function fmtAgo(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
