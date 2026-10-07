import type {
  AwardSearchQuery,
  AwardResult,
  RouteAvailability,
  Cabin,
  Deal,
  LiveAircraft,
  FlightStatus,
  HotelSearchQuery,
  HotelAwardQuote,
  DataSource,
} from "@/lib/types";

/**
 * Provider contracts. Every live integration (seats.aero, OpenSky, Amadeus…)
 * and the built-in simulator implement these. The registry composes them:
 * live first, simulator as the always-available fallback.
 */

export interface ProviderMeta {
  id: string;
  label: string;
  source: DataSource;
  /** True when credentials/config allow this provider to run right now. */
  enabled: boolean;
  /** Human hint shown in Settings → Integrations when disabled */
  requires?: string;
}

export interface AwardSearchProvider extends ProviderMeta {
  search(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardResult[]>;
  /** Calendar-style availability for a route over a date range (inclusive). */
  availability(
    origin: string,
    destination: string,
    cabin: Cabin,
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<RouteAvailability>;
  /** Trending/cheap awards, optionally scoped to an origin. */
  deals(opts: { origin?: string; cabin?: Cabin; limit?: number }, signal?: AbortSignal): Promise<Deal[]>;
}

export interface BoundingBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export interface LiveFlightsProvider extends ProviderMeta {
  states(bbox: BoundingBox, signal?: AbortSignal): Promise<{ aircraft: LiveAircraft[]; time: number }>;
}

export interface FlightStatusProvider extends ProviderMeta {
  status(carrier: string, flightNumber: string, date: string, signal?: AbortSignal): Promise<FlightStatus | null>;
}

export interface HotelProvider extends ProviderMeta {
  search(query: HotelSearchQuery, signal?: AbortSignal): Promise<HotelAwardQuote[]>;
}

export interface CashFareProvider extends ProviderMeta {
  /** Lowest cash fare in USD for a route/date/cabin, or null when unknown. */
  lowestFare(origin: string, destination: string, date: string, cabin: Cabin, signal?: AbortSignal): Promise<number | null>;
}

export interface FxProvider extends ProviderMeta {
  /** Rates relative to USD, e.g. { EUR: 0.92 } */
  rates(signal?: AbortSignal): Promise<Record<string, number>>;
}

export class ProviderError extends Error {
  constructor(
    public providerId: string,
    message: string,
    public status?: number,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = "ProviderError";
  }
}
