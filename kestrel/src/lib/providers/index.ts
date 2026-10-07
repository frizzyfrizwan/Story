import "server-only";
import type {
  AwardSearchQuery,
  AwardSearchResponse,
  RouteAvailability,
  Cabin,
  Deal,
  LiveAircraft,
  FlightStatus,
  HotelSearchQuery,
  HotelAwardQuote,
} from "@/lib/types";
import { env } from "@/env";
import type { BoundingBox, ProviderMeta } from "./types";
import { createRegistry, type Registry, type SnapshotRow } from "./registry";
import { createFxProvider } from "./fx";
import { createSeatsAeroProvider } from "./seatsaero";
import { createOpenSkyProvider } from "./opensky";
import { createAeroDataBoxProvider, createAviationStackProvider } from "./flightstatus";
import { createAmadeus } from "./amadeus";
import { createDuffelProvider } from "./duffel";
import { simulator } from "./simulator";

/**
 * Provider registry entry point — the only surface the feature pages call.
 *
 * Providers light up from env (see `docs/ARCHITECTURE.md` → Data & integrations):
 *   seats.aero      SEATS_AERO_API_KEY
 *   OpenSky         always on (optional OPENSKY_CLIENT_ID/SECRET)
 *   AviationStack   AVIATIONSTACK_KEY
 *   AeroDataBox     AERODATABOX_KEY
 *   Amadeus         AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET (+ AMADEUS_ENV)
 *   Duffel          DUFFEL_API_KEY
 *   FX              optional EXCHANGERATE_API_KEY (free mirror + static fallback otherwise)
 *   Simulator       always on — the fallback for everything
 */

let warnedPersist = false;

/** Fire-and-forget insert into `availability_snapshot`; never blocks or throws into the request. */
function persistSnapshots(rows: SnapshotRow[]): void {
  void import("@/db")
    .then(async ({ getDb, schema }) => {
      const db = await getDb();
      for (let i = 0; i < rows.length; i += 50) {
        await db.insert(schema.availabilitySnapshots).values(rows.slice(i, i + 50));
      }
    })
    .catch((err: unknown) => {
      if (warnedPersist) return;
      warnedPersist = true;
      console.warn("[providers] snapshot persistence failed:", err instanceof Error ? err.message : err);
    });
}

function log(message: string, meta?: unknown): void {
  if (env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "info") {
    console.warn(`[providers] ${message}`, meta instanceof Error ? meta.message : meta ?? "");
  }
}

function build(): Registry {
  const fx = createFxProvider({ apiKey: env.EXCHANGERATE_API_KEY });
  const rates = (signal?: AbortSignal) => fx.rates(signal);

  const seatsAero = createSeatsAeroProvider({ apiKey: env.SEATS_AERO_API_KEY, rates });
  const openSky = createOpenSkyProvider({ clientId: env.OPENSKY_CLIENT_ID, clientSecret: env.OPENSKY_CLIENT_SECRET });
  const aviationStack = createAviationStackProvider({ apiKey: env.AVIATIONSTACK_KEY });
  const aeroDataBox = createAeroDataBoxProvider({ apiKey: env.AERODATABOX_KEY });
  const amadeus = createAmadeus({ clientId: env.AMADEUS_CLIENT_ID, clientSecret: env.AMADEUS_CLIENT_SECRET, env: env.AMADEUS_ENV, rates });
  const duffel = createDuffelProvider({ apiKey: env.DUFFEL_API_KEY, rates });

  return createRegistry({
    awards: [seatsAero],
    liveFlights: [openSky],
    flightStatus: [aviationStack, aeroDataBox],
    hotels: [amadeus.hotels],
    cashFares: [duffel, amadeus.fares],
    fx,
    simulator,
    catalog: [seatsAero, openSky, aviationStack, aeroDataBox, amadeus.hotels, amadeus.fares, duffel, fx],
    persistSnapshots,
    log,
  });
}

let registry: Registry | null = null;
const reg = (): Registry => (registry ??= build());

export async function searchAwards(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardSearchResponse> {
  return reg().searchAwards(query, signal);
}

export async function getRouteAvailability(
  origin: string,
  destination: string,
  cabin: Cabin,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<RouteAvailability> {
  return reg().getRouteAvailability(origin, destination, cabin, from, to, signal);
}

export async function getDeals(opts: { origin?: string; cabin?: Cabin; limit?: number } = {}, signal?: AbortSignal): Promise<Deal[]> {
  return reg().getDeals(opts, signal);
}

export async function getLiveAircraft(bbox: BoundingBox, signal?: AbortSignal): Promise<{ aircraft: LiveAircraft[]; time: number; source: "live" | "simulated" }> {
  return reg().getLiveAircraft(bbox, signal);
}

export async function getFlightStatus(carrier: string, flightNumber: string, date: string, signal?: AbortSignal): Promise<FlightStatus | null> {
  return reg().getFlightStatus(carrier, flightNumber, date, signal);
}

export async function searchHotels(query: HotelSearchQuery, signal?: AbortSignal): Promise<{ quotes: HotelAwardQuote[]; source: "live" | "simulated" }> {
  return reg().searchHotels(query, signal);
}

export async function getFxRates(signal?: AbortSignal): Promise<Record<string, number>> {
  return reg().getFxRates(signal);
}

export function listProviders(): ProviderMeta[] {
  return reg().listProviders();
}
