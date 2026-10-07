import type { Airline } from "@/lib/types";

/** STUB — replaced by the geography agent. Keep these exports. */
export const AIRLINES: Airline[] = [];

export const AIRLINE_BY_IATA: Record<string, Airline> = Object.fromEntries(AIRLINES.map((a) => [a.iata, a]));

export function getAirline(iata: string): Airline | undefined {
  return AIRLINE_BY_IATA[iata.toUpperCase()];
}

/** Map an ICAO callsign prefix (e.g. "SIA") to an IATA code ("SQ"). */
export function carrierFromCallsign(callsign: string | null | undefined): string | undefined {
  if (!callsign) return undefined;
  const prefix = callsign.trim().slice(0, 3).toUpperCase();
  return AIRLINES.find((a) => a.icao === prefix)?.iata;
}
