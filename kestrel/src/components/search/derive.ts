/**
 * Pure result shaping for the search page: filtering, sorting, grouping and facet counts.
 * Keeps the components declarative and makes the "instant" filter feedback cheap.
 */

import type { AwardFare, AwardResult, AwardSearchResponse, Itinerary } from "@/lib/types";
import { daysBetween, fmtCompact } from "@/lib/utils";
import type { DepartureWindow, ResultFilters, SortKey, StopsFilter } from "./search-params";

export interface VisibleResult {
  id: string;
  result: AwardResult;
  /** Fares that survive the fare-level filters (programs, max miles, affordability). */
  fares: AwardFare[];
  /** The best of `fares`. */
  best: AwardFare;
  /** Departure date of the first segment, YYYY-MM-DD. */
  date: string;
  /** Local departure of the first segment. */
  departure: string;
  carriers: string[];
}

export interface DeriveOptions {
  isAffordable?: (fare: AwardFare) => boolean;
  /** Facet counting: evaluate every filter except this one. */
  ignore?: keyof ResultFilters;
}

/** "60k" rather than Intl's "60K". */
export function fmtK(n: number | null | undefined): string {
  return fmtCompact(n).replace(/K$/, "k");
}

export function pickBest(fares: AwardFare[]): AwardFare {
  return fares.reduce((a, b) =>
    b.valueScore > a.valueScore || (b.valueScore === a.valueScore && (b.miles < a.miles || (b.miles === a.miles && b.taxesUsd < a.taxesUsd)))
      ? b
      : a,
  );
}

export function hourOf(isoLocal: string): number {
  const m = /T(\d{2})/.exec(isoLocal);
  return m ? Number(m[1]) : 12;
}

export function departureWindowOf(isoLocal: string): Exclude<DepartureWindow, "any"> {
  const h = hourOf(isoLocal);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function toVisible(result: AwardResult, fares: AwardFare[]): VisibleResult {
  const first = result.itinerary.segments[0];
  return {
    id: result.itinerary.id,
    result,
    fares,
    best: pickBest(fares),
    date: first?.departure.slice(0, 10) ?? "",
    departure: first?.departure ?? "",
    carriers: uniq(result.itinerary.segments.map((s) => s.carrier)),
  };
}

function passesResultFilters(r: AwardResult, f: ResultFilters, ignore?: keyof ResultFilters): boolean {
  const it = r.itinerary;
  if (ignore !== "stops" && f.stops !== "any" && it.stops > Number(f.stops)) return false;
  if (ignore !== "mixed" && !f.mixed && r.fares.some((x) => x.mixedCabin) && r.fares.every((x) => x.mixedCabin)) return false;
  if (ignore !== "departure" && f.departure !== "any") {
    const first = it.segments[0];
    if (!first || departureWindowOf(first.departure) !== f.departure) return false;
  }
  if (ignore !== "airlines" && f.airlines.length) {
    if (!it.segments.some((s) => f.airlines.includes(s.carrier))) return false;
  }
  return true;
}

function passesFareFilters(fare: AwardFare, f: ResultFilters, opts: DeriveOptions): boolean {
  const { ignore, isAffordable } = opts;
  if (ignore !== "programs" && f.programs.length && !f.programs.includes(fare.programId)) return false;
  if (ignore !== "maxMiles" && f.maxMiles != null && fare.miles > f.maxMiles) return false;
  if (ignore !== "afford" && f.afford && isAffordable && !isAffordable(fare)) return false;
  if (ignore !== "mixed" && !f.mixed && fare.mixedCabin) return false;
  return true;
}

/** Filter at the itinerary and fare level; an itinerary survives only if at least one fare does. */
export function applyFilters(results: AwardResult[], filters: ResultFilters, opts: DeriveOptions = {}): VisibleResult[] {
  const out: VisibleResult[] = [];
  for (const r of results) {
    if (!r?.itinerary?.segments?.length || !r.fares?.length) continue;
    if (!passesResultFilters(r, filters, opts.ignore)) continue;
    const fares = r.fares.filter((x) => passesFareFilters(x, filters, opts));
    if (!fares.length) continue;
    out.push(toVisible(r, fares));
  }
  return out;
}

const SORTERS: Record<SortKey, (a: VisibleResult, b: VisibleResult) => number> = {
  best: (a, b) => b.best.valueScore - a.best.valueScore || a.best.miles - b.best.miles || a.best.taxesUsd - b.best.taxesUsd,
  miles: (a, b) => a.best.miles - b.best.miles || a.best.taxesUsd - b.best.taxesUsd,
  taxes: (a, b) => a.best.taxesUsd - b.best.taxesUsd || a.best.miles - b.best.miles,
  shortest: (a, b) => a.result.itinerary.totalDurationMin - b.result.itinerary.totalDurationMin || a.best.miles - b.best.miles,
  departure: (a, b) => a.departure.localeCompare(b.departure) || a.best.miles - b.best.miles,
};

export function sortVisible(items: VisibleResult[], sort: SortKey): VisibleResult[] {
  return [...items].sort(SORTERS[sort]);
}

export interface DateGroup {
  date: string;
  items: VisibleResult[];
}

/** Stable date order; items keep their sorted order inside each group. */
export function groupByDate(items: VisibleResult[]): DateGroup[] {
  const map = new Map<string, VisibleResult[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, items: list }));
}

// ─── Facets ─────────────────────────────────────────────────────

export interface Facets {
  programs: { id: string; count: number }[];
  airlines: { code: string; count: number }[];
  /** Range of best-fare miles across the raw results (null when empty). */
  miles: { min: number; max: number } | null;
  stops: Record<StopsFilter, number>;
  departure: Record<DepartureWindow, number>;
}

/** Counts answer "how many itineraries would I see if I picked this?" given every other active filter. */
export function computeFacets(results: AwardResult[], filters: ResultFilters, opts: DeriveOptions = {}): Facets {
  const programs = new Map<string, number>();
  for (const v of applyFilters(results, filters, { ...opts, ignore: "programs" })) {
    for (const id of uniq(v.fares.map((f) => f.programId))) programs.set(id, (programs.get(id) ?? 0) + 1);
  }
  const airlines = new Map<string, number>();
  for (const v of applyFilters(results, filters, { ...opts, ignore: "airlines" })) {
    for (const c of v.carriers) airlines.set(c, (airlines.get(c) ?? 0) + 1);
  }
  const stopsBase = applyFilters(results, filters, { ...opts, ignore: "stops" });
  const stops: Record<StopsFilter, number> = {
    any: stopsBase.length,
    "0": stopsBase.filter((v) => v.result.itinerary.stops === 0).length,
    "1": stopsBase.filter((v) => v.result.itinerary.stops <= 1).length,
  };
  const depBase = applyFilters(results, filters, { ...opts, ignore: "departure" });
  const departure: Record<DepartureWindow, number> = { any: depBase.length, morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const v of depBase) departure[departureWindowOf(v.departure)]++;

  let miles: Facets["miles"] = null;
  for (const r of results) {
    for (const f of r.fares ?? []) {
      miles = miles ? { min: Math.min(miles.min, f.miles), max: Math.max(miles.max, f.miles) } : { min: f.miles, max: f.miles };
    }
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  return {
    programs: Array.from(programs, ([id, count]) => ({ id, count })).sort(byCount),
    airlines: Array.from(airlines, ([code, count]) => ({ code, count })).sort(byCount),
    miles,
    stops,
    departure,
  };
}

// ─── Itinerary helpers ──────────────────────────────────────────

export function layoversOf(it: Itinerary): { airport: string; minutes: number }[] {
  const out: { airport: string; minutes: number }[] = [];
  for (let i = 1; i < it.segments.length; i++) {
    const prev = it.segments[i - 1];
    const next = it.segments[i];
    // Both stamps are local wall-clock at the same airport, so a plain difference is the layover.
    const ms = new Date(next.departure).getTime() - new Date(prev.arrival).getTime();
    out.push({ airport: next.origin, minutes: Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60_000)) : 0 });
  }
  return out;
}

/** Calendar days between the first departure and the final arrival (+1, +2 …). */
export function dayOffset(it: Itinerary): number {
  const first = it.segments[0];
  const last = it.segments[it.segments.length - 1];
  if (!first || !last) return 0;
  try {
    return Math.max(0, daysBetween(first.departure.slice(0, 10), last.arrival.slice(0, 10)));
  } catch {
    return 0;
  }
}

/** "Searched 12 programs in 1.2s" inputs. */
export function searchStats(res: AwardSearchResponse | undefined): { programs: number; seconds: number; results: number } {
  if (!res) return { programs: 0, seconds: 0, results: 0 };
  const programs = new Set<string>();
  for (const r of res.results ?? []) for (const f of r.fares ?? []) programs.add(f.programId);
  const ms = (res.providers ?? []).reduce((sum, p) => sum + (Number.isFinite(p.ms) ? p.ms : 0), 0);
  return { programs: programs.size, seconds: Math.max(0.1, Math.round(ms / 100) / 10), results: res.results?.length ?? 0 };
}
