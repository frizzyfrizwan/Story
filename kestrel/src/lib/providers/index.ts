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
import type { BoundingBox, ProviderMeta } from "./types";

/**
 * STUB — replaced by the providers agent. Keep these signatures; they are the
 * only surface the feature pages call.
 */

export async function searchAwards(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardSearchResponse> {
  void signal;
  return { query, results: [], source: "simulated", providers: [], generatedAt: new Date().toISOString() };
}

export async function getRouteAvailability(
  origin: string,
  destination: string,
  cabin: Cabin,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<RouteAvailability> {
  void signal;
  return { origin, destination, cabin, days: [], source: "simulated" };
}

export async function getDeals(opts: { origin?: string; cabin?: Cabin; limit?: number } = {}, signal?: AbortSignal): Promise<Deal[]> {
  void opts;
  void signal;
  return [];
}

export async function getLiveAircraft(bbox: BoundingBox, signal?: AbortSignal): Promise<{ aircraft: LiveAircraft[]; time: number; source: "live" | "simulated" }> {
  void bbox;
  void signal;
  return { aircraft: [], time: Date.now() / 1000, source: "simulated" };
}

export async function getFlightStatus(carrier: string, flightNumber: string, date: string, signal?: AbortSignal): Promise<FlightStatus | null> {
  void carrier;
  void flightNumber;
  void date;
  void signal;
  return null;
}

export async function searchHotels(query: HotelSearchQuery, signal?: AbortSignal): Promise<{ quotes: HotelAwardQuote[]; source: "live" | "simulated" }> {
  void query;
  void signal;
  return { quotes: [], source: "simulated" };
}

export async function getFxRates(signal?: AbortSignal): Promise<Record<string, number>> {
  void signal;
  return { USD: 1 };
}

export function listProviders(): ProviderMeta[] {
  return [];
}
