import type {
  AvailabilityDay,
  AwardResult,
  AwardSearchQuery,
  AwardSearchResponse,
  Cabin,
  Deal,
  FlightStatus,
  HotelAwardQuote,
  HotelSearchQuery,
  LiveAircraft,
  RouteAvailability,
} from "@/lib/types";
import { cpp as cppOf } from "@/lib/awards";
import type { Simulator } from "./simulator";
import {
  ProviderError,
  type AwardSearchProvider,
  type BoundingBox,
  type CashFareProvider,
  type FlightStatusProvider,
  type FxProvider,
  type HotelProvider,
  type LiveFlightsProvider,
  type ProviderMeta,
} from "./types";

/**
 * Provider registry — composes live providers with the simulator.
 *
 * Policy: try enabled live providers in order, each under a timeout; on
 * error or empty data fall back to the simulator. Responses carry
 * `providers: [{ id, ms, count, error? }]` so the UI can show what answered,
 * and `source` is "live" whenever any live rows made it into the payload.
 *
 * `createRegistry` is dependency-injected so the composition rules can be
 * unit-tested with fake providers; `index.ts` wires the real ones from env.
 */

export interface ProviderTiming {
  id: string;
  ms: number;
  count: number;
  error?: string;
}

/** A row for the `availability_snapshot` table (persisted fire-and-forget). */
export interface SnapshotRow {
  origin: string;
  destination: string;
  date: string;
  cabin: string;
  programId: string;
  carrier: string;
  miles: number;
  taxesUsd: number;
  seats: number;
  source: string;
  fetchedAt: string;
}

export interface RegistryDeps {
  awards: AwardSearchProvider[];
  liveFlights: LiveFlightsProvider[];
  flightStatus: FlightStatusProvider[];
  hotels: HotelProvider[];
  cashFares: CashFareProvider[];
  fx: FxProvider;
  simulator: Simulator;
  /** Every provider for `listProviders()`, enabled or not (defaults to the lists above). */
  catalog?: ProviderMeta[];
  /** Per-provider timeout (default 8 000 ms) */
  timeoutMs?: number;
  /** Cash-fare enrichment timeout (default 4 000 ms) */
  cashTimeoutMs?: number;
  /** Persist live award rows; must never throw or block. */
  persistSnapshots?: (rows: SnapshotRow[]) => void;
  log?: (message: string, meta?: unknown) => void;
  now?: () => number;
}

export interface Registry {
  searchAwards(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardSearchResponse>;
  getRouteAvailability(origin: string, destination: string, cabin: Cabin, from: string, to: string, signal?: AbortSignal): Promise<RouteAvailability>;
  getDeals(opts?: { origin?: string; cabin?: Cabin; limit?: number }, signal?: AbortSignal): Promise<Deal[]>;
  getLiveAircraft(bbox: BoundingBox, signal?: AbortSignal): Promise<{ aircraft: LiveAircraft[]; time: number; source: "live" | "simulated" }>;
  getFlightStatus(carrier: string, flightNumber: string, date: string, signal?: AbortSignal): Promise<FlightStatus | null>;
  searchHotels(query: HotelSearchQuery, signal?: AbortSignal): Promise<{ quotes: HotelAwardQuote[]; source: "live" | "simulated" }>;
  getFxRates(signal?: AbortSignal): Promise<Record<string, number>>;
  listProviders(): ProviderMeta[];
}

type Attempt<T> = { ok: true; value: T; ms: number } | { ok: false; error: string; ms: number };

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CASH_TIMEOUT_MS = 4_000;
const MAX_SNAPSHOT_ROWS = 200;

function errorText(e: unknown): string {
  if (e instanceof ProviderError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Run `fn` with a timeout and the caller's abort signal; never throws. */
async function attempt<T>(id: string, timeoutMs: number, outer: AbortSignal | undefined, now: () => number, fn: (signal: AbortSignal) => Promise<T>): Promise<Attempt<T>> {
  const started = now();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  outer?.addEventListener("abort", onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderError(id, `timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const value = await Promise.race([fn(controller.signal), timeout]);
    return { ok: true, value, ms: now() - started };
  } catch (e) {
    return { ok: false, error: errorText(e), ms: now() - started };
  } finally {
    if (timer) clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}

export function snapshotsFromResults(results: AwardResult[]): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    const first = r.itinerary.segments[0];
    const last = r.itinerary.segments[r.itinerary.segments.length - 1];
    if (!first || !last) continue;
    const date = first.departure.slice(0, 10);
    for (const f of r.fares) {
      if (f.source !== "live") continue;
      const key = `${first.origin}:${last.destination}:${date}:${f.cabin}:${f.programId}:${first.carrier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        origin: first.origin,
        destination: last.destination,
        date,
        cabin: f.cabin,
        programId: f.programId,
        carrier: first.carrier,
        miles: f.miles,
        taxesUsd: f.taxesUsd,
        seats: f.seats ?? 0,
        source: f.source,
        fetchedAt: f.fetchedAt,
      });
      if (rows.length >= MAX_SNAPSHOT_ROWS) return rows;
    }
  }
  return rows;
}

export function snapshotsFromDays(origin: string, destination: string, days: AvailabilityDay[], fetchedAt: string): SnapshotRow[] {
  return days
    .filter((d) => d.source === "live")
    .slice(0, MAX_SNAPSHOT_ROWS)
    .map((d) => ({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      date: d.date,
      cabin: d.cabin,
      programId: d.programId,
      carrier: d.carrier,
      miles: d.miles,
      taxesUsd: d.taxesUsd,
      seats: d.seats,
      source: d.source,
      fetchedAt,
    }));
}

export function createRegistry(deps: RegistryDeps): Registry {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cashTimeoutMs = deps.cashTimeoutMs ?? DEFAULT_CASH_TIMEOUT_MS;
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? (() => undefined);
  const persist = (rows: SnapshotRow[]) => {
    if (!rows.length || !deps.persistSnapshots) return;
    try {
      deps.persistSnapshots(rows);
    } catch (e) {
      log("snapshot persistence failed", e);
    }
  };
  const enabled = <T extends ProviderMeta>(list: T[]): T[] => list.filter((p) => p.enabled);
  const { simulator } = deps;

  /** Attach a live cash fare (one call, primary O&D only) and refresh cpp on matching results. */
  async function enrichCash(results: AwardResult[], query: AwardSearchQuery, providers: ProviderTiming[], signal?: AbortSignal): Promise<AwardResult[]> {
    const provider = enabled(deps.cashFares)[0];
    const first = results[0];
    if (!provider || !first) return results;
    const origin = first.itinerary.segments[0]?.origin;
    const destination = first.itinerary.segments[first.itinerary.segments.length - 1]?.destination;
    const date = first.itinerary.segments[0]?.departure.slice(0, 10) ?? query.date;
    if (!origin || !destination) return results;
    const r = await attempt(provider.id, cashTimeoutMs, signal, now, (s) => provider.lowestFare(origin, destination, date, query.cabin, s));
    if (!r.ok) {
      providers.push({ id: provider.id, ms: r.ms, count: 0, error: r.error });
      return results;
    }
    const cash = r.value;
    providers.push({ id: provider.id, ms: r.ms, count: cash === null ? 0 : 1 });
    if (cash === null) return results;
    return results.map((res) => {
      const segs = res.itinerary.segments;
      const matches = segs[0]?.origin === origin && segs[segs.length - 1]?.destination === destination && segs[0]?.departure.startsWith(date);
      if (!matches) return res;
      const fares = res.fares.map((f) => ({ ...f, cpp: Math.round(cppOf(f.miles, f.taxesUsd, cash) * 100) / 100 }));
      const best = fares.find((f) => f.programId === res.bestFare.programId) ?? fares[0];
      return { ...res, fares, bestFare: best, cashPriceUsd: cash };
    });
  }

  async function searchAwards(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardSearchResponse> {
    const providers: ProviderTiming[] = [];
    const live: AwardResult[] = [];
    const seen = new Set<string>();
    for (const p of enabled(deps.awards)) {
      const r = await attempt(p.id, timeoutMs, signal, now, (s) => p.search(query, s));
      if (!r.ok) {
        providers.push({ id: p.id, ms: r.ms, count: 0, error: r.error });
        log(`award provider ${p.id} failed`, r.error);
        continue;
      }
      providers.push({ id: p.id, ms: r.ms, count: r.value.length });
      for (const res of r.value) {
        if (seen.has(res.itinerary.id)) continue;
        seen.add(res.itinerary.id);
        live.push(res);
      }
    }

    let results = live;
    if (!live.length) {
      const r = await attempt(simulator.meta.id, timeoutMs, signal, now, (s) => simulator.search(query, s));
      providers.push(r.ok ? { id: simulator.meta.id, ms: r.ms, count: r.value.length } : { id: simulator.meta.id, ms: r.ms, count: 0, error: r.error });
      results = r.ok ? r.value : [];
    } else {
      persist(snapshotsFromResults(live));
    }

    results = await enrichCash(results, query, providers, signal);
    return { query, results, source: live.length ? "live" : "simulated", providers, generatedAt: new Date(now()).toISOString() };
  }

  async function getRouteAvailability(origin: string, destination: string, cabin: Cabin, from: string, to: string, signal?: AbortSignal): Promise<RouteAvailability> {
    for (const p of enabled(deps.awards)) {
      const r = await attempt(p.id, timeoutMs, signal, now, (s) => p.availability(origin, destination, cabin, from, to, s));
      if (!r.ok) {
        log(`availability provider ${p.id} failed`, r.error);
        continue;
      }
      if (r.value.days.length) {
        persist(snapshotsFromDays(origin, destination, r.value.days, new Date(now()).toISOString()));
        return { ...r.value, source: "live" };
      }
    }
    return simulator.availability(origin, destination, cabin, from, to, signal);
  }

  async function getDeals(opts: { origin?: string; cabin?: Cabin; limit?: number } = {}, signal?: AbortSignal): Promise<Deal[]> {
    for (const p of enabled(deps.awards)) {
      const r = await attempt(p.id, timeoutMs, signal, now, (s) => p.deals(opts, s));
      if (!r.ok) {
        log(`deals provider ${p.id} failed`, r.error);
        continue;
      }
      if (r.value.length) return r.value;
    }
    return simulator.deals(opts, signal);
  }

  async function getLiveAircraft(bbox: BoundingBox, signal?: AbortSignal): Promise<{ aircraft: LiveAircraft[]; time: number; source: "live" | "simulated" }> {
    for (const p of enabled(deps.liveFlights)) {
      const r = await attempt(p.id, timeoutMs, signal, now, (s) => p.states(bbox, s));
      if (!r.ok) {
        log(`live flights provider ${p.id} failed`, r.error);
        continue;
      }
      if (r.value.aircraft.length) return { ...r.value, source: "live" };
    }
    const sim = await simulator.states(bbox, signal);
    return { ...sim, source: "simulated" };
  }

  async function getFlightStatus(carrier: string, flightNumber: string, date: string, signal?: AbortSignal): Promise<FlightStatus | null> {
    for (const p of enabled(deps.flightStatus)) {
      const r = await attempt(p.id, timeoutMs, signal, now, (s) => p.status(carrier, flightNumber, date, s));
      if (!r.ok) {
        log(`flight status provider ${p.id} failed`, r.error);
        continue;
      }
      if (r.value) return r.value;
    }
    return simulator.status(carrier, flightNumber, date, signal);
  }

  async function searchHotels(query: HotelSearchQuery, signal?: AbortSignal): Promise<{ quotes: HotelAwardQuote[]; source: "live" | "simulated" }> {
    const [simQuotes, liveQuotes] = await Promise.all([
      simulator.hotels(query, signal).catch((e: unknown) => {
        log("simulator hotels failed", e);
        return [] as HotelAwardQuote[];
      }),
      (async () => {
        const out: HotelAwardQuote[] = [];
        const seen = new Set<string>();
        for (const p of enabled(deps.hotels)) {
          const r = await attempt(p.id, timeoutMs, signal, now, (s) => p.search(query, s));
          if (!r.ok) {
            log(`hotel provider ${p.id} failed`, r.error);
            continue;
          }
          for (const q of r.value) {
            if (seen.has(q.propertyId)) continue;
            seen.add(q.propertyId);
            out.push(q);
          }
        }
        return out;
      })(),
    ]);
    if (!liveQuotes.length) return { quotes: simQuotes, source: "simulated" };
    const liveIds = new Set(liveQuotes.map((q) => q.propertyId));
    const merged = [...liveQuotes, ...simQuotes.filter((q) => !liveIds.has(q.propertyId))].sort((a, b) => b.valueScore - a.valueScore || a.totalPoints - b.totalPoints);
    return { quotes: merged, source: "live" };
  }

  async function getFxRates(signal?: AbortSignal): Promise<Record<string, number>> {
    try {
      return await deps.fx.rates(signal);
    } catch (e) {
      log("fx failed", e);
      return { USD: 1 };
    }
  }

  function listProviders(): ProviderMeta[] {
    const all: ProviderMeta[] = deps.catalog ?? [...deps.awards, ...deps.liveFlights, ...deps.flightStatus, ...deps.hotels, ...deps.cashFares, deps.fx];
    const metas = all.map(({ id, label, source, enabled: on, requires }) => ({ id, label, source, enabled: on, requires }));
    const seen = new Set<string>();
    const out: ProviderMeta[] = [];
    for (const m of [...metas, simulator.meta]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }

  return { searchAwards, getRouteAvailability, getDeals, getLiveAircraft, getFlightStatus, searchHotels, getFxRates, listProviders };
}
