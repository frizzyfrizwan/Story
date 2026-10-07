/**
 * The /search URL contract — the single source of truth for the search page.
 *
 * Server-side params (change → new API call):
 *   from, to    comma lists of IATA or metro codes (≤3 each), e.g. `from=JFK,EWR` or `from=NYC`
 *   date        YYYY-MM-DD
 *   flex        0–7 (±days)
 *   cabin       economy | premium | business | first
 *   pax         1–9
 *   programs    comma list of program ids (bank ids expand to their airline transfer partners)
 *   q           natural-language text; prefills from/to/date/cabin/pax when they are missing
 *
 * Client-side params (filter the loaded results, no refetch):
 *   sort        best | miles | taxes | shortest | departure
 *   stops       any | 0 | 1
 *   fp          comma list of program ids to show
 *   airlines    comma list of IATA carrier codes to show
 *   maxMiles    integer cap on the best fare
 *   mixed       0 hides mixed-cabin itineraries
 *   afford      1 shows only fares the wallet can cover
 *   dep         any | morning | afternoon | evening | night
 *
 * Pure module: usable from the server page and from client components.
 */

import type { AwardSearchQuery, Cabin } from "@/lib/types";
import { CABINS, CABIN_LABEL, CABIN_SHORT } from "@/lib/types";
import { addDays, clamp, fmtDate, parseISODate, toISODate } from "@/lib/utils";
import { expandMetro } from "@/data/airports";
import { PROGRAM_BY_ID } from "@/data/programs";
import { transfersFrom } from "@/data/transfers";

// ─── Types ──────────────────────────────────────────────────────

export const SORT_KEYS = ["best", "miles", "taxes", "shortest", "departure"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_LABEL: Record<SortKey, string> = {
  best: "Best value",
  miles: "Fewest miles",
  taxes: "Lowest taxes",
  shortest: "Shortest",
  departure: "Departure time",
};

export const DEPARTURE_WINDOWS = ["any", "morning", "afternoon", "evening", "night"] as const;
export type DepartureWindow = (typeof DEPARTURE_WINDOWS)[number];
export const DEPARTURE_LABEL: Record<DepartureWindow, { label: string; hint: string }> = {
  any: { label: "Any time", hint: "" },
  morning: { label: "Morning", hint: "05–12" },
  afternoon: { label: "Afternoon", hint: "12–17" },
  evening: { label: "Evening", hint: "17–21" },
  night: { label: "Night", hint: "21–05" },
};

export const STOPS_FILTERS = ["any", "0", "1"] as const;
export type StopsFilter = (typeof STOPS_FILTERS)[number];

/** Everything that changes the API call. */
export interface SearchQueryState {
  origin: string[];
  destination: string[];
  /** YYYY-MM-DD */
  date: string;
  flexDays: number;
  cabin: Cabin;
  passengers: number;
  /** Program ids to restrict the search to (server-side). */
  programs: string[];
}

/** Everything that only re-shapes loaded results. */
export interface ResultFilters {
  sort: SortKey;
  stops: StopsFilter;
  programs: string[];
  airlines: string[];
  maxMiles: number | null;
  mixed: boolean;
  afford: boolean;
  departure: DepartureWindow;
}

export interface SearchState {
  query: SearchQueryState;
  filters: ResultFilters;
  /** Natural-language text the search was described with, if any. */
  q: string;
}

export type ParamRecord = Record<string, string | string[] | undefined>;

export const MAX_AIRPORTS = 3;
/** Default lead time when a search has no date (matches the intent parser). */
export const DEFAULT_LEAD_DAYS = 45;

export const DEFAULT_FILTERS: ResultFilters = {
  sort: "best",
  stops: "any",
  programs: [],
  airlines: [],
  maxMiles: null,
  mixed: true,
  afford: false,
  departure: "any",
};

export function defaultQuery(today: string): SearchQueryState {
  return {
    origin: [],
    destination: [],
    date: addDays(today, DEFAULT_LEAD_DAYS),
    flexDays: 0,
    cabin: "business",
    passengers: 1,
    programs: [],
  };
}

// ─── Parsing ────────────────────────────────────────────────────

function scalar(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[v.length - 1] : v;
}

function listOf(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  const parts = (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(","));
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Uppercase, 3-letter, de-duplicated, capped. Metro codes (NYC) pass through untouched. */
export function parseCodes(v: string | string[] | undefined, max = MAX_AIRPORTS): string[] {
  const out: string[] = [];
  for (const raw of listOf(v)) {
    const code = raw.toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || out.includes(code)) continue;
    out.push(code);
    if (out.length >= max) break;
  }
  return out;
}

function parseDate(v: string | undefined, today: string): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  if (toISODate(parseISODate(v)) !== v) return null;
  // A shared link with a date in the past is useless as-is; roll it to tomorrow.
  return v < today ? addDays(today, 1) : v;
}

function parseIntIn(v: string | undefined, min: number, max: number, fallback: number): number {
  if (v == null || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

function parseCabin(v: string | undefined, fallback: Cabin): Cabin {
  const c = v?.toLowerCase();
  return (CABINS as readonly string[]).includes(c ?? "") ? (c as Cabin) : fallback;
}

function parseEnum<T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T {
  return v != null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function parseProgramIds(v: string | string[] | undefined): string[] {
  return Array.from(new Set(listOf(v).map((s) => s.toLowerCase()).filter((id) => PROGRAM_BY_ID[id])));
}

export function parseSearchState(params: ParamRecord, opts: { today: string; fallback?: SearchQueryState }): SearchState {
  const base = opts.fallback ?? defaultQuery(opts.today);
  let query: SearchQueryState = {
    origin: parseCodes(params.from),
    destination: parseCodes(params.to),
    date: parseDate(scalar(params.date), opts.today) ?? base.date,
    flexDays: parseIntIn(scalar(params.flex), 0, 7, base.flexDays),
    cabin: parseCabin(scalar(params.cabin), base.cabin),
    passengers: parseIntIn(scalar(params.pax), 1, 9, base.passengers),
    programs: parseProgramIds(params.programs),
  };
  // A `q`-only link: the server parsed the description into `fallback`; adopt its route.
  if (!hasRoute(query) && opts.fallback && hasRoute(opts.fallback)) {
    query = { ...query, origin: opts.fallback.origin, destination: opts.fallback.destination };
    if (!params.date) query.date = opts.fallback.date;
    if (!params.flex) query.flexDays = opts.fallback.flexDays;
    if (!params.cabin) query.cabin = opts.fallback.cabin;
    if (!params.pax) query.passengers = opts.fallback.passengers;
    if (!params.programs) query.programs = opts.fallback.programs;
  }

  const maxMilesRaw = scalar(params.maxMiles);
  const maxMiles = maxMilesRaw ? parseIntIn(maxMilesRaw, 1000, 2_000_000, 0) || null : null;

  const filters: ResultFilters = {
    sort: parseEnum(scalar(params.sort), SORT_KEYS, DEFAULT_FILTERS.sort),
    stops: parseEnum(scalar(params.stops), STOPS_FILTERS, DEFAULT_FILTERS.stops),
    programs: parseProgramIds(params.fp),
    airlines: listOf(params.airlines)
      .map((s) => s.toUpperCase())
      .filter((s) => /^[A-Z0-9]{2}$/.test(s)),
    maxMiles,
    mixed: scalar(params.mixed) !== "0",
    afford: scalar(params.afford) === "1",
    departure: parseEnum(scalar(params.dep), DEPARTURE_WINDOWS, DEFAULT_FILTERS.departure),
  };

  return { query, filters, q: (scalar(params.q) ?? "").trim().slice(0, 500) };
}

/** Collect a URLSearchParams-like object into the record shape Next hands server pages. */
export function recordFromSearchParams(sp: { forEach(cb: (value: string, key: string) => void): void }): ParamRecord {
  const out: ParamRecord = {};
  sp.forEach((value, key) => {
    const prev = out[key];
    out[key] = prev === undefined ? value : ([] as string[]).concat(prev, value);
  });
  return out;
}

// ─── Serialising ────────────────────────────────────────────────

export function hasRoute(q: Pick<SearchQueryState, "origin" | "destination">): boolean {
  return q.origin.length > 0 && q.destination.length > 0;
}

/** Query string (without the `?`), defaults omitted so links stay short. */
export function serializeSearchState(state: SearchState): string {
  const p = new URLSearchParams();
  const { query, filters } = state;
  if (query.origin.length) p.set("from", query.origin.join(","));
  if (query.destination.length) p.set("to", query.destination.join(","));
  if (query.date) p.set("date", query.date);
  if (query.flexDays) p.set("flex", String(query.flexDays));
  p.set("cabin", query.cabin);
  if (query.passengers > 1) p.set("pax", String(query.passengers));
  if (query.programs.length) p.set("programs", query.programs.join(","));
  if (state.q) p.set("q", state.q);
  if (filters.sort !== DEFAULT_FILTERS.sort) p.set("sort", filters.sort);
  if (filters.stops !== DEFAULT_FILTERS.stops) p.set("stops", filters.stops);
  if (filters.programs.length) p.set("fp", filters.programs.join(","));
  if (filters.airlines.length) p.set("airlines", filters.airlines.join(","));
  if (filters.maxMiles != null) p.set("maxMiles", String(filters.maxMiles));
  if (!filters.mixed) p.set("mixed", "0");
  if (filters.afford) p.set("afford", "1");
  if (filters.departure !== DEFAULT_FILTERS.departure) p.set("dep", filters.departure);
  return p.toString();
}

export function searchHref(state: SearchState): string {
  const qs = serializeSearchState(state);
  return qs ? `/search?${qs}` : "/search";
}

export function countActiveFilters(f: ResultFilters): number {
  let n = 0;
  if (f.stops !== "any") n++;
  if (f.programs.length) n++;
  if (f.airlines.length) n++;
  if (f.maxMiles != null) n++;
  if (!f.mixed) n++;
  if (f.afford) n++;
  if (f.departure !== "any") n++;
  return n;
}

// ─── Bridges to the domain query ────────────────────────────────

/** "Using Amex points" → every airline program Amex transfers to. Airline ids pass through. */
export function expandProgramIds(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const p = PROGRAM_BY_ID[id];
    if (!p) continue;
    if (p.kind === "bank") {
      for (const link of transfersFrom(id)) {
        if (PROGRAM_BY_ID[link.to]?.kind === "airline") out.add(link.to);
      }
    } else out.add(id);
  }
  return Array.from(out);
}

/** The object sent to /api/awards/search — also the TanStack Query key. Null until a route is set. */
export function toAwardQuery(q: SearchQueryState): AwardSearchQuery | null {
  if (!hasRoute(q) || !q.date) return null;
  const programs = expandProgramIds(q.programs);
  return {
    origin: q.origin,
    destination: q.destination,
    date: q.date,
    flexDays: q.flexDays,
    cabin: q.cabin,
    passengers: q.passengers,
    ...(programs.length ? { programs } : {}),
  };
}

export function fromAwardQuery(aq: AwardSearchQuery, base: SearchQueryState): SearchQueryState {
  return {
    origin: parseCodes(aq.origin),
    destination: parseCodes(aq.destination),
    date: aq.date || base.date,
    flexDays: clamp(aq.flexDays ?? 0, 0, 7),
    cabin: aq.cabin ?? base.cabin,
    passengers: clamp(aq.passengers || 1, 1, 9),
    programs: parseProgramIds(aq.programs),
  };
}

/** The single real airport pair used for the availability strip and alerts. */
export function primaryPair(q: SearchQueryState): { origin: string; destination: string } | null {
  if (!hasRoute(q)) return null;
  const origin = expandMetro(q.origin[0])[0];
  const destination = expandMetro(q.destination[0])[0];
  return origin && destination ? { origin, destination } : null;
}

/** Expand metro codes to member airports, capped (the alerts API takes ≤6). */
export function expandCodes(codes: string[], max = 6): string[] {
  const out: string[] = [];
  for (const c of codes) for (const m of expandMetro(c)) if (!out.includes(m) && out.length < max) out.push(m);
  return out;
}

// ─── Labels ─────────────────────────────────────────────────────

const route = (q: SearchQueryState) => `${q.origin.join("/") || "?"} → ${q.destination.join("/") || "?"}`;

/** "JFK → NRT · May 14 ±3 · J · 2 pax" */
export function summarizeQuery(q: SearchQueryState): string {
  const parts = [route(q)];
  if (q.date) parts.push(`${fmtDate(q.date, { weekday: undefined })}${q.flexDays ? ` ±${q.flexDays}` : ""}`);
  parts.push(CABIN_SHORT[q.cabin]);
  if (q.passengers > 1) parts.push(`${q.passengers} pax`);
  return parts.join(" · ");
}

/** "JFK → NRT · Business · May 14" */
export function metadataTitle(q: SearchQueryState): string {
  if (!hasRoute(q)) return "Award search";
  const parts = [route(q), CABIN_LABEL[q.cabin]];
  if (q.date) parts.push(fmtDate(q.date, { weekday: undefined }));
  return parts.join(" · ");
}
