import type { Airport, AwardRegion } from "@/lib/types";

/** STUB — replaced by the geography agent. Keep these exports. */
export const AIRPORTS: Airport[] = [];

export const AIRPORT_BY_IATA: Record<string, Airport> = Object.fromEntries(AIRPORTS.map((a) => [a.iata, a]));

export function getAirport(iata: string): Airport | undefined {
  return AIRPORT_BY_IATA[iata.toUpperCase()];
}

/** Fuzzy search by code, city, name or country. Hubs rank first. */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS.filter((a) => a.hub).slice(0, limit);
  return AIRPORTS.filter((a) => a.iata.toLowerCase().startsWith(q) || a.city.toLowerCase().includes(q)).slice(0, limit);
}

/** Expand a metro code (NYC, LON, TYO) to member airports; passes through plain codes. */
export function expandMetro(code: string): string[] {
  const c = code.toUpperCase();
  const members = AIRPORTS.filter((a) => a.metro === c).map((a) => a.iata);
  return members.length ? members : [c];
}

export function regionOf(iata: string): AwardRegion | undefined {
  return getAirport(iata)?.region;
}
