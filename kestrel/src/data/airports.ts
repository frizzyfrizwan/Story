import type { Airport, AwardRegion } from "@/lib/types";
import { haversineMiles } from "@/lib/utils";
import generated from "./generated/airports.json";

/**
 * Curated world airports (~450) generated from OpenFlights by `scripts/build-airports.ts`.
 * Regenerate with `pnpm tsx scripts/build-airports.ts`; do not hand-edit the JSON.
 */
export const AIRPORTS: Airport[] = generated as unknown as Airport[];

export const AIRPORT_BY_IATA: Record<string, Airport> = Object.fromEntries(AIRPORTS.map((a) => [a.iata, a]));

export function getAirport(iata: string): Airport | undefined {
  return AIRPORT_BY_IATA[iata.toUpperCase()];
}

// ─── Metros ───────────────────────────────────────────────────

export interface Metro {
  code: string;
  name: string;
  members: string[];
}

const METRO_NAMES: Record<string, string> = {
  NYC: "New York",
  LON: "London",
  PAR: "Paris",
  TYO: "Tokyo",
  CHI: "Chicago",
  WAS: "Washington",
  MIL: "Milan",
  ROM: "Rome",
  SEL: "Seoul",
  OSA: "Osaka",
  BUE: "Buenos Aires",
  SAO: "São Paulo",
  BKK: "Bangkok",
  JKT: "Jakarta",
  MOW: "Moscow",
  STO: "Stockholm",
};

/** Metro areas (NYC, LON, TYO…) with their member airports, hubs first. */
export const METROS: Metro[] = Object.entries(
  AIRPORTS.reduce<Record<string, Airport[]>>((acc, a) => {
    if (a.metro) (acc[a.metro] ??= []).push(a);
    return acc;
  }, {}),
).map(([code, members]) => ({
  code,
  name: METRO_NAMES[code] ?? members[0].city,
  members: members.sort((a, b) => Number(Boolean(b.hub)) - Number(Boolean(a.hub)) || a.iata.localeCompare(b.iata)).map((a) => a.iata),
}));

const METRO_BY_CODE: Record<string, Metro> = Object.fromEntries(METROS.map((m) => [m.code, m]));

/** Expand a metro code (NYC, LON, TYO) to member airports; passes through plain codes. */
export function expandMetro(code: string): string[] {
  const c = code.toUpperCase();
  return METRO_BY_CODE[c]?.members.slice() ?? [c];
}

export function regionOf(iata: string): AwardRegion | undefined {
  return getAirport(iata)?.region;
}

/** Great-circle distance between two airports in statute miles (0 when either is unknown). */
export function airportDistanceMiles(a: string | Airport, b: string | Airport): number {
  const A = typeof a === "string" ? getAirport(a) : a;
  const B = typeof b === "string" ? getAirport(b) : b;
  if (!A || !B) return 0;
  return haversineMiles(A.lat, A.lon, B.lat, B.lon);
}

// ─── Search ───────────────────────────────────────────────────

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

interface SearchIndexEntry {
  airport: Airport;
  iata: string;
  city: string;
  name: string;
  country: string;
  metroName: string;
  hub: 0 | 1;
}

const INDEX: SearchIndexEntry[] = AIRPORTS.map((a) => ({
  airport: a,
  iata: a.iata.toLowerCase(),
  city: fold(a.city),
  name: fold(a.name),
  country: fold(a.country),
  metroName: a.metro ? fold(METRO_NAMES[a.metro] ?? "") : "",
  hub: a.hub ? 1 : 0,
}));

const HUBS_FIRST = AIRPORTS.filter((a) => a.hub);

/**
 * Rank: exact IATA (or metro code) > IATA prefix > city/metro startsWith > name/country includes.
 * Hubs win ties; then shorter city names (closer match), then IATA for stability.
 * "New York" matches every NYC metro member, "Tokyo" matches NRT + HND.
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = fold(query.trim());
  if (!q) return HUBS_FIRST.slice(0, limit);

  const qUpper = q.toUpperCase();
  const metroMembers = new Set(METRO_BY_CODE[qUpper]?.members ?? []);

  const scored: { entry: SearchIndexEntry; score: number }[] = [];
  for (const entry of INDEX) {
    let score = 0;
    if (entry.iata === q || metroMembers.has(entry.airport.iata)) score = 500;
    else if (q.length <= 3 && entry.iata.startsWith(q)) score = 400;
    else if (entry.city.startsWith(q) || (entry.metroName && entry.metroName.startsWith(q))) score = 300;
    else if (entry.city.includes(q) || entry.name.includes(q) || entry.country.includes(q)) score = 200;
    else continue;
    scored.push({ entry, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.entry.hub - a.entry.hub ||
      a.entry.city.length - b.entry.city.length ||
      a.entry.iata.localeCompare(b.entry.iata),
  );
  return scored.slice(0, limit).map((s) => s.entry.airport);
}

/** All airports in an award region, hubs first. */
export function airportsInRegion(region: AwardRegion): Airport[] {
  return AIRPORTS.filter((a) => a.region === region).sort((a, b) => Number(Boolean(b.hub)) - Number(Boolean(a.hub)));
}
