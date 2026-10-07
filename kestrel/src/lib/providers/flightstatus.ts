import type { FlightStatus, FlightStatusState } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { asArray, asNumber, asString, buildUrl, fetchJson, isRecord, memo, pick } from "./http";
import { localToUtcMs, splitLocalIso, toLocalIso } from "./shared";
import { ProviderError, type FlightStatusProvider } from "./types";

/**
 * Flight status providers.
 *
 *   AviationStack  GET http://api.aviationstack.com/v1/flights?access_key=&flight_iata=UA1&flight_date=YYYY-MM-DD
 *   AeroDataBox    GET https://aerodatabox.p.rapidapi.com/flights/number/{UA1}/{date}   (x-rapidapi-key)
 *
 * Each is enabled by its env key. Both map to `FlightStatus`; `status()` returns
 * null when the flight is unknown for that date (not an error).
 */

export const AVIATIONSTACK_ID = "aviationstack";
export const AVIATIONSTACK_BASE = "http://api.aviationstack.com/v1";
export const AERODATABOX_ID = "aerodatabox";
export const AERODATABOX_BASE = "https://aerodatabox.p.rapidapi.com";
export const AERODATABOX_HOST = "aerodatabox.p.rapidapi.com";

const STATUS_TTL_MS = 60_000;

/** "ua", "UA0001" → { carrier: "UA", number: "1", iata: "UA1" } */
export function normalizeFlightNumber(carrier: string, flightNumber: string): { carrier: string; number: string; iata: string } {
  const c = carrier.trim().toUpperCase();
  let n = flightNumber.trim().toUpperCase().replace(/\s+/g, "");
  if (c && n.startsWith(c)) n = n.slice(c.length);
  const digits = n.replace(/\D/g, "");
  const number = digits ? String(Number(digits)) : n;
  return { carrier: c, number, iata: `${c}${number}` };
}

function progressBetween(depUtc: number | undefined, arrUtc: number | undefined, nowMs: number): number | undefined {
  if (depUtc === undefined || arrUtc === undefined || arrUtc <= depUtc) return undefined;
  return clamp((nowMs - depUtc) / (arrUtc - depUtc), 0, 1);
}

// ─── AviationStack ────────────────────────────────────────────

const AVIATIONSTACK_STATUS: Record<string, FlightStatusState> = {
  scheduled: "scheduled",
  active: "active",
  landed: "landed",
  cancelled: "cancelled",
  incident: "unknown",
  diverted: "diverted",
};

/**
 * AviationStack timestamps are local wall-clock times with a misleading
 * "+00:00" suffix; we keep the wall clock and use `departure.timezone` for UTC math.
 */
function aviationStackUtc(value: string | undefined, tz: string | undefined): number | undefined {
  const local = toLocalIso(value);
  if (!local) return undefined;
  const parts = splitLocalIso(local);
  if (!parts) return undefined;
  return localToUtcMs(parts.date, parts.hh, parts.mm, tz ?? "UTC");
}

export function mapAviationStackFlight(raw: unknown, carrier: string, number: string, date: string, nowMs: number): FlightStatus | null {
  if (!isRecord(raw)) return null;
  const dep = isRecord(raw.departure) ? raw.departure : {};
  const arr = isRecord(raw.arrival) ? raw.arrival : {};
  const origin = asString(dep.iata)?.toUpperCase();
  const destination = asString(arr.iata)?.toUpperCase();
  const scheduledDeparture = toLocalIso(asString(dep.scheduled));
  const scheduledArrival = toLocalIso(asString(arr.scheduled));
  if (!origin || !destination || !scheduledDeparture || !scheduledArrival) return null;

  const rawStatus = asString(raw.flight_status)?.toLowerCase() ?? "";
  let status: FlightStatusState = AVIATIONSTACK_STATUS[rawStatus] ?? "unknown";
  const delayMin = asNumber(dep.delay) ?? asNumber(arr.delay);
  if (status === "scheduled" && (delayMin ?? 0) > 0) status = "delayed";

  const depTz = asString(dep.timezone);
  const arrTz = asString(arr.timezone);
  const depUtc = aviationStackUtc(asString(dep.actual) ?? asString(dep.estimated) ?? asString(dep.scheduled), depTz);
  const arrUtc = aviationStackUtc(asString(arr.estimated) ?? asString(arr.scheduled), arrTz);

  const live = isRecord(raw.live) ? raw.live : null;
  const lat = live ? asNumber(live.latitude) : undefined;
  const lon = live ? asNumber(live.longitude) : undefined;
  const aircraft = isRecord(raw.aircraft) ? raw.aircraft : null;

  return {
    carrier,
    flightNumber: number,
    date: asString(raw.flight_date) ?? date,
    origin,
    destination,
    scheduledDeparture,
    estimatedDeparture: toLocalIso(asString(dep.actual) ?? asString(dep.estimated)),
    scheduledArrival,
    estimatedArrival: toLocalIso(asString(arr.actual) ?? asString(arr.estimated)),
    status,
    delayMin: delayMin !== undefined && delayMin > 0 ? Math.round(delayMin) : undefined,
    aircraft: aircraft ? asString(aircraft.iata) ?? asString(aircraft.icao) : undefined,
    registration: aircraft ? asString(aircraft.registration) : undefined,
    terminal: asString(dep.terminal),
    gate: asString(dep.gate),
    progress: status === "active" ? progressBetween(depUtc, arrUtc, nowMs) : undefined,
    position:
      live && lat !== undefined && lon !== undefined
        ? { lat, lon, altitudeM: asNumber(live.altitude) ?? null, heading: asNumber(live.direction) ?? null }
        : undefined,
    source: "live",
  };
}

export interface AviationStackDeps {
  apiKey?: string;
  baseUrl?: string;
  now?: () => number;
  timeoutMs?: number;
}

export function createAviationStackProvider(deps: AviationStackDeps = {}): FlightStatusProvider {
  const base = deps.baseUrl ?? AVIATIONSTACK_BASE;
  const now = deps.now ?? (() => Date.now());
  const enabled = Boolean(deps.apiKey);
  return {
    id: AVIATIONSTACK_ID,
    label: "AviationStack",
    source: "live",
    enabled,
    requires: enabled ? undefined : "AVIATIONSTACK_KEY",
    async status(carrier, flightNumber, date, signal) {
      if (!deps.apiKey) throw new ProviderError(AVIATIONSTACK_ID, "not configured (AVIATIONSTACK_KEY)");
      const f = normalizeFlightNumber(carrier, flightNumber);
      return memo(`aviationstack:${f.iata}:${date}`, STATUS_TTL_MS, async () => {
        const url = buildUrl(base, "/flights", { access_key: deps.apiKey, flight_iata: f.iata, flight_date: date, limit: 10 });
        const payload = await fetchJson(url, { signal }, { providerId: AVIATIONSTACK_ID, timeoutMs: deps.timeoutMs ?? 8_000 });
        const apiError = pick(payload, "error");
        if (isRecord(apiError)) {
          throw new ProviderError(AVIATIONSTACK_ID, asString(apiError.message) ?? asString(apiError.code) ?? "api error", asNumber(apiError.code));
        }
        const rows = asArray(pick(payload, "data")).filter(isRecord);
        const match =
          rows.find((r) => asString(pick(r, "flight", "iata"))?.toUpperCase() === f.iata && asString(r.flight_date) === date) ??
          rows.find((r) => asString(pick(r, "flight", "iata"))?.toUpperCase() === f.iata) ??
          rows[0];
        return match ? mapAviationStackFlight(match, f.carrier, f.number, date, now()) : null;
      });
    },
  };
}

// ─── AeroDataBox ──────────────────────────────────────────────

const AERODATABOX_STATUS: Record<string, FlightStatusState> = {
  expected: "scheduled",
  checkin: "scheduled",
  boarding: "scheduled",
  gatehold: "scheduled",
  departed: "active",
  enroute: "active",
  approaching: "active",
  arrived: "landed",
  canceled: "cancelled",
  cancelled: "cancelled",
  canceleduncertain: "cancelled",
  delayed: "delayed",
  diverted: "diverted",
  unknown: "unknown",
};

/** "2026-10-07 12:35Z" → ms */
function adbUtc(value: unknown): number | undefined {
  const s = asString(value);
  if (!s) return undefined;
  const ms = Date.parse(s.replace(" ", "T"));
  return Number.isFinite(ms) ? ms : undefined;
}

export function mapAeroDataBoxFlight(raw: unknown, carrier: string, number: string, date: string, nowMs: number): FlightStatus | null {
  if (!isRecord(raw)) return null;
  const dep = isRecord(raw.departure) ? raw.departure : {};
  const arr = isRecord(raw.arrival) ? raw.arrival : {};
  const origin = asString(pick(dep, "airport", "iata"))?.toUpperCase();
  const destination = asString(pick(arr, "airport", "iata"))?.toUpperCase();
  const scheduledDeparture = toLocalIso(asString(pick(dep, "scheduledTime", "local")));
  const scheduledArrival = toLocalIso(asString(pick(arr, "scheduledTime", "local")));
  if (!origin || !destination || !scheduledDeparture || !scheduledArrival) return null;

  const rawStatus = asString(raw.status)?.replace(/\s+/g, "").toLowerCase() ?? "unknown";
  const status: FlightStatusState = AERODATABOX_STATUS[rawStatus] ?? "unknown";

  const depRevised = pick(dep, "revisedTime") ?? pick(dep, "predictedTime");
  const arrRevised = pick(arr, "revisedTime") ?? pick(arr, "predictedTime");
  const depSchedUtc = adbUtc(pick(dep, "scheduledTime", "utc"));
  const depEstUtc = adbUtc(pick(depRevised, "utc")) ?? adbUtc(pick(dep, "runwayTime", "utc"));
  const arrEstUtc = adbUtc(pick(arrRevised, "utc")) ?? adbUtc(pick(arr, "scheduledTime", "utc"));
  const delayMin = depSchedUtc !== undefined && depEstUtc !== undefined ? Math.round((depEstUtc - depSchedUtc) / 60_000) : undefined;

  const loc = isRecord(raw.location) ? raw.location : null;
  const lat = loc ? asNumber(loc.lat) : undefined;
  const lon = loc ? asNumber(loc.lon) : undefined;
  const aircraft = isRecord(raw.aircraft) ? raw.aircraft : null;

  return {
    carrier,
    flightNumber: number,
    date,
    origin,
    destination,
    scheduledDeparture,
    estimatedDeparture: toLocalIso(asString(pick(depRevised, "local"))),
    scheduledArrival,
    estimatedArrival: toLocalIso(asString(pick(arrRevised, "local"))),
    status,
    delayMin: delayMin !== undefined && delayMin > 0 ? delayMin : undefined,
    aircraft: aircraft ? asString(aircraft.model) : undefined,
    registration: aircraft ? asString(aircraft.reg) : undefined,
    terminal: asString(dep.terminal),
    gate: asString(dep.gate),
    progress: status === "active" ? progressBetween(depEstUtc ?? depSchedUtc, arrEstUtc, nowMs) : undefined,
    position:
      loc && lat !== undefined && lon !== undefined
        ? {
            lat,
            lon,
            altitudeM: asNumber(pick(loc, "altitude", "meter")) ?? asNumber(pick(loc, "pressureAltitude", "meter")) ?? null,
            heading: asNumber(pick(loc, "trueTrack", "deg")) ?? null,
          }
        : undefined,
    source: "live",
  };
}

export interface AeroDataBoxDeps {
  apiKey?: string;
  baseUrl?: string;
  now?: () => number;
  timeoutMs?: number;
}

export function createAeroDataBoxProvider(deps: AeroDataBoxDeps = {}): FlightStatusProvider {
  const base = deps.baseUrl ?? AERODATABOX_BASE;
  const now = deps.now ?? (() => Date.now());
  const enabled = Boolean(deps.apiKey);
  return {
    id: AERODATABOX_ID,
    label: "AeroDataBox",
    source: "live",
    enabled,
    requires: enabled ? undefined : "AERODATABOX_KEY",
    async status(carrier, flightNumber, date, signal) {
      if (!deps.apiKey) throw new ProviderError(AERODATABOX_ID, "not configured (AERODATABOX_KEY)");
      const f = normalizeFlightNumber(carrier, flightNumber);
      return memo(`aerodatabox:${f.iata}:${date}`, STATUS_TTL_MS, async () => {
        const url = buildUrl(base, `/flights/number/${encodeURIComponent(f.iata)}/${encodeURIComponent(date)}`, {
          withAircraftImage: false,
          withLocation: true,
        });
        let payload: unknown;
        try {
          payload = await fetchJson(
            url,
            { headers: { "x-rapidapi-key": deps.apiKey ?? "", "x-rapidapi-host": AERODATABOX_HOST, Accept: "application/json" }, signal },
            { providerId: AERODATABOX_ID, timeoutMs: deps.timeoutMs ?? 8_000 },
          );
        } catch (e) {
          if (e instanceof ProviderError && e.status === 404) return null; // unknown flight/date
          throw e;
        }
        const rows = Array.isArray(payload) ? payload.filter(isRecord) : isRecord(payload) ? [payload] : [];
        const wanted = f.iata;
        const match =
          rows.find((r) => (asString(r.number) ?? "").replace(/\s+/g, "").toUpperCase() === wanted && asString(pick(r, "departure", "scheduledTime", "local"))?.startsWith(date)) ??
          rows.find((r) => (asString(r.number) ?? "").replace(/\s+/g, "").toUpperCase() === wanted) ??
          rows[0];
        return match ? mapAeroDataBoxFlight(match, f.carrier, f.number, date, now()) : null;
      });
    },
  };
}
