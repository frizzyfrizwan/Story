/**
 * Shared plumbing for the award charts: input/output contracts, alliance
 * carrier lists, region → zone helpers, peak calendars, demand modelling and a
 * government-tax model (no fuel surcharges — each chart layers its own YQ on top).
 *
 * Everything here is pure, synchronous and deterministic. Charts are keyed by
 * the canonical program ids in docs/ARCHITECTURE.md and carrier IATA codes.
 */
import type { AwardRegion, Cabin } from "@/lib/types";
import { clamp, hash32, parseISODate } from "@/lib/utils";

// ─── Contracts ─────────────────────────────────────────────────

export interface PriceInput {
  programId: string;
  carrier: string;
  origin: string;
  destination: string;
  originRegion: AwardRegion;
  destinationRegion: AwardRegion;
  distanceMiles: number;
  cabin: Cabin;
  /** YYYY-MM-DD, used for peak/off-peak and dynamic pricing */
  date: string;
  /** 0–1 demand signal from the simulator (optional) */
  demand?: number;
}

export interface PriceQuote {
  miles: number;
  taxesUsd: number;
  basis: "chart" | "dynamic" | "estimate";
  /** Human-readable chart note, e.g. "Aeroplan: North America ↔ Atlantic, 4001–6000 mi" */
  note?: string;
  peak?: "off-peak" | "standard" | "peak";
}

export type ChartFn = (input: PriceInput) => PriceQuote | null;

/** Miles per cabin; `null` means the cabin is not offered on that chart row. */
export type CabinRow = Record<Cabin, number | null>;

export const row = (
  economy: number | null,
  premium: number | null,
  business: number | null,
  first: number | null,
): CabinRow => ({ economy, premium, business, first });

// ─── Alliances & carrier allowlists ────────────────────────────

/** Star Alliance members (2025) plus Lufthansa-group/Air Canada affiliates that Star programs price as Star. */
export const STAR: readonly string[] = [
  "AC", "RV", "UA", "NH", "SQ", "AV", "TK", "BR", "TG", "OZ", "LH", "LX", "OS", "SN", "LO", "TP", "A3", "AI",
  "NZ", "CM", "ET", "MS", "SA", "CA", "ZH", "OU", "EN", "4Y", "WK", "EW",
];

/** oneworld members (2025, incl. Oman Air & Fiji Airways) plus Hawaiian (Alaska Air Group, joining 2026). */
export const ONEWORLD: readonly string[] = [
  "AA", "BA", "QR", "CX", "JL", "AS", "QF", "IB", "AY", "RJ", "MH", "UL", "AT", "FJ", "WY", "HA",
];

/** SkyTeam members (2025; SAS joined Sept 2024, ITA still listed). */
export const SKYTEAM: readonly string[] = [
  "DL", "AF", "KL", "KE", "AM", "VS", "SK", "AZ", "VN", "CI", "MU", "GA", "SV", "KQ", "ME", "RO", "OK", "UX", "AR",
];

/** Build a de-duplicated allowlist from alliance lists plus named partners. */
export function allow(...lists: readonly (readonly string[])[]): readonly string[] {
  return Array.from(new Set(lists.flat().map((c) => c.toUpperCase())));
}

export function canBook(carrier: string, list: readonly string[]): boolean {
  return list.includes(carrier.toUpperCase());
}

// ─── Regions & zones ───────────────────────────────────────────

export const REGION_LABEL: Record<AwardRegion, string> = {
  "north-america": "North America",
  hawaii: "Hawaii",
  "central-america": "Central America",
  caribbean: "Caribbean",
  "south-america": "South America",
  europe: "Europe",
  "middle-east": "Middle East",
  "north-africa": "North Africa",
  "sub-saharan-africa": "Sub-Saharan Africa",
  "central-asia": "Central Asia",
  "north-asia": "North Asia",
  "south-asia": "South Asia",
  "southeast-asia": "Southeast Asia",
  oceania: "Oceania",
};

/** Coarse macro-zone most programs' charts reduce to. */
export type Macro = "na" | "hi" | "cc" | "sa" | "eu" | "me" | "af" | "sasia" | "nasia" | "seasia" | "oce";

export function macroOf(r: AwardRegion): Macro {
  switch (r) {
    case "north-america":
      return "na";
    case "hawaii":
      return "hi";
    case "central-america":
    case "caribbean":
      return "cc";
    case "south-america":
      return "sa";
    case "europe":
      return "eu";
    case "middle-east":
    case "central-asia":
      return "me";
    case "north-africa":
    case "sub-saharan-africa":
      return "af";
    case "south-asia":
      return "sasia";
    case "north-asia":
      return "nasia";
    case "southeast-asia":
      return "seasia";
    case "oceania":
      return "oce";
  }
}

export const isAsia = (m: Macro) => m === "sasia" || m === "nasia" || m === "seasia";
/** "Greater North America" for charts that fold Hawaii/Mexico/Caribbean/Central America into NA. */
export const isGreaterNA = (m: Macro) => m === "na" || m === "hi" || m === "cc";

/** Symmetric pair key ("a|b" sorted) for zone-pair tables. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function lookupPair<T>(table: Record<string, T>, a: string, b: string): T | undefined {
  return table[pairKey(a, b)];
}

/** Index of the first band whose upper bound (inclusive) ≥ distance; last band is open-ended. */
export function bandIndex(distance: number, upperBounds: readonly number[]): number {
  for (let i = 0; i < upperBounds.length; i++) if (distance <= upperBounds[i]) return i;
  return upperBounds.length;
}

export function bandLabel(index: number, upperBounds: readonly number[]): string {
  const lo = index === 0 ? 0 : upperBounds[index - 1] + 1;
  const hi = upperBounds[index];
  return hi == null ? `${lo.toLocaleString("en-US")}+ mi` : `${lo.toLocaleString("en-US")}–${hi.toLocaleString("en-US")} mi`;
}

// ─── Airports used for finer-grained tax / zone decisions ──────

export const CANADA_AIRPORTS = new Set(["YYZ", "YVR", "YUL", "YYC", "YOW", "YEG", "YHZ", "YWG", "YQB", "YYJ"]);
export const MEXICO_AIRPORTS = new Set(["MEX", "CUN", "GDL", "MTY", "SJD", "PVR", "TIJ", "NLU", "MID", "OAX"]);
export const UK_AIRPORTS = new Set(["LHR", "LGW", "LCY", "STN", "LTN", "MAN", "EDI", "GLA", "BHX", "BRS", "NCL", "BFS"]);
export const US_WEST_COAST = new Set(["LAX", "SFO", "SJC", "SEA", "PDX", "SAN", "LAS", "OAK", "SMF", "YVR", "HNL"]);
export const US_CENTRAL = new Set(["ORD", "IAH", "DFW", "DEN", "MSP", "DTW", "AUS", "MEX", "YYC", "MDW", "STL"]);

export const isUsAirport = (iata: string, region: AwardRegion) =>
  (region === "north-america" && !CANADA_AIRPORTS.has(iata) && !MEXICO_AIRPORTS.has(iata)) || region === "hawaii";

// ─── Calendar helpers ──────────────────────────────────────────

export interface Ymd {
  y: number;
  m: number; // 1–12
  d: number; // 1–31
  /** m*100 + d, e.g. 1225 */
  md: number;
  /** 0 = Sunday */
  dow: number;
}

export function ymd(date: string): Ymd {
  const dt = parseISODate(date);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return { y, m, d, md: m * 100 + d, dow: dt.getDay() };
}

/** Inclusive month/day window; wraps across New Year when from > to (e.g. 1217 → 105). */
export function inWindow(md: number, from: number, to: number): boolean {
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** Gregorian Easter Sunday (anonymous/Meeus algorithm). */
export function easterMd(year: number): { m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

function dayOfYear(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

/** True when `date` is within ±`spread` days of Easter Sunday. */
export function nearEaster(date: Ymd, before = 9, after = 8): boolean {
  const e = easterMd(date.y);
  const doy = dayOfYear(date.y, date.m, date.d);
  const edoy = dayOfYear(date.y, e.m, e.d);
  return doy >= edoy - before && doy <= edoy + after;
}

/** Lunar New Year dates (used for Asia peaks). */
const LUNAR_NEW_YEAR: Record<number, [number, number]> = {
  2024: [2, 10],
  2025: [1, 29],
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
};

export function nearLunarNewYear(date: Ymd, spread = 4): boolean {
  const lny = LUNAR_NEW_YEAR[date.y];
  if (!lny) return false;
  const doy = dayOfYear(date.y, date.m, date.d);
  const l = dayOfYear(date.y, lny[0], lny[1]);
  return Math.abs(doy - l) <= spread;
}

/** US Thanksgiving = 4th Thursday of November; peak window Tue → Sun. */
export function nearThanksgiving(date: Ymd): boolean {
  if (date.m !== 11) return false;
  const first = new Date(date.y, 10, 1).getDay(); // 0 = Sun
  const firstThu = 1 + ((4 - first + 7) % 7);
  const thanks = firstThu + 21;
  return date.d >= thanks - 2 && date.d <= thanks + 3;
}

export const isSummer = (x: Ymd) => inWindow(x.md, 615, 831);
export const isChristmasNY = (x: Ymd) => inWindow(x.md, 1217, 105);
export const isGoldenWeek = (x: Ymd) => inWindow(x.md, 427, 506);
export const isObon = (x: Ymd) => inWindow(x.md, 809, 818);

/**
 * Baseline demand 0–1 derived from the calendar when the simulator passes no
 * demand signal: holidays ≈ 0.85, summer ≈ 0.7, spring/Easter ≈ 0.6, shoulder ≈ 0.4,
 * deep winter ≈ 0.25. A small deterministic jitter keeps neighbouring days distinct.
 */
export function seasonalDemand(date: string, seed = ""): number {
  const x = ymd(date);
  let base: number;
  if (isChristmasNY(x) || nearThanksgiving(x)) base = 0.85;
  else if (isSummer(x)) base = 0.7;
  else if (nearEaster(x) || inWindow(x.md, 310, 410)) base = 0.6;
  else if (inWindow(x.md, 106, 228)) base = 0.25;
  else if (inWindow(x.md, 1101, 1216)) base = 0.35;
  else base = 0.4;
  // Fridays/Sundays are pricier than Tuesdays/Wednesdays.
  if (x.dow === 5 || x.dow === 0) base += 0.05;
  else if (x.dow === 2 || x.dow === 3) base -= 0.05;
  const j = ((hash32(`demand:${seed}:${date}`) % 1000) / 1000 - 0.5) * 0.16;
  return clamp(base + j, 0, 1);
}

export function demandOf(input: PriceInput): number {
  return input.demand == null ? seasonalDemand(input.date, `${input.origin}-${input.destination}`) : clamp(input.demand, 0, 1);
}

export function peakFromDemand(d: number): PriceQuote["peak"] {
  return d >= 0.65 ? "peak" : d <= 0.35 ? "off-peak" : "standard";
}

/** Generic "northern-hemisphere leisure" peak flag used by fixed charts without their own calendar. */
export function genericPeak(date: string): PriceQuote["peak"] {
  const x = ymd(date);
  if (isSummer(x) || isChristmasNY(x) || nearThanksgiving(x) || nearEaster(x, 5, 5)) return "peak";
  if (inWindow(x.md, 106, 228) || inWindow(x.md, 1101, 1216)) return "off-peak";
  return "standard";
}

// ─── Numeric helpers ───────────────────────────────────────────

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Deterministic multiplier in [1 − pct, 1 + pct]. */
export function jitter(seed: string, pct: number): number {
  const u = (hash32(seed) % 10_000) / 10_000; // [0,1)
  return 1 + (u * 2 - 1) * pct;
}

/** Interpolate a [lo, hi] band by demand (0–1). */
export function lerp(lo: number, hi: number, t: number): number {
  return lo + (hi - lo) * clamp(t, 0, 1);
}

export function cabinOf(rowValues: CabinRow, cabin: Cabin): number | null {
  return rowValues[cabin];
}

// ─── Government tax model (no carrier surcharges) ──────────────

const PREMIUM: Record<Cabin, boolean> = { economy: false, premium: true, business: true, first: true };

/**
 * Typical government/airport taxes & fees in USD for a one-way award, by origin
 * and destination. Excludes carrier-imposed surcharges (YQ), which each chart adds.
 * Calibrated to 2025 levels: US domestic ≈ $11, US→intl ≈ $40–60, UK APD makes
 * ex-UK premium cabins ≈ $350+, EU ≈ $60–110, Asia ≈ $30–50.
 */
export function govTaxes(input: PriceInput): number {
  const { origin, destination, originRegion, destinationRegion, cabin } = input;
  const premium = PREMIUM[cabin];
  const oMacro = macroOf(originRegion);
  const dMacro = macroOf(destinationRegion);
  const originUS = isUsAirport(origin, originRegion);
  const destUS = isUsAirport(destination, destinationRegion);

  // Domestic / near-domestic cases first.
  if (originUS && destUS) return roundTo(11 * jitter(`tax:${origin}${destination}`, 0.05), 1);
  if (originRegion === "north-america" && destinationRegion === "north-america") {
    // US↔Canada / US↔Mexico / within Canada
    const canadaLeg = CANADA_AIRPORTS.has(origin) || CANADA_AIRPORTS.has(destination);
    const base = canadaLeg ? 55 : 48;
    return roundTo(base * jitter(`tax:${origin}${destination}`, 0.08), 1);
  }

  let departure: number;
  if (UK_AIRPORTS.has(origin)) {
    // UK Air Passenger Duty (2025): long-haul Y ≈ £90, premium ≈ £224 + airport PSC.
    const longHaul = !(dMacro === "eu" || dMacro === "af" && destinationRegion === "north-africa");
    departure = longHaul ? (premium ? 370 : 165) : premium ? 100 : 55;
  } else {
    switch (oMacro) {
      case "na":
      case "hi":
        departure = 38;
        break;
      case "cc":
        departure = 55;
        break;
      case "sa":
        departure = premium ? 70 : 60;
        break;
      case "eu":
        departure = premium ? 110 : 62;
        break;
      case "me":
        departure = premium ? 70 : 50;
        break;
      case "af":
        departure = premium ? 95 : 72;
        break;
      case "sasia":
        departure = premium ? 45 : 32;
        break;
      case "nasia":
      case "seasia":
        departure = premium ? 48 : 36;
        break;
      case "oce":
        departure = premium ? 62 : 52;
        break;
    }
  }

  let arrival: number;
  if (destUS) arrival = 42;
  else if (CANADA_AIRPORTS.has(destination)) arrival = 28;
  else if (MEXICO_AIRPORTS.has(destination)) arrival = 40;
  else
    switch (dMacro) {
      case "cc":
        arrival = 32;
        break;
      case "sa":
        arrival = 30;
        break;
      case "eu":
        arrival = UK_AIRPORTS.has(destination) ? 8 : 14;
        break;
      case "me":
        arrival = 22;
        break;
      case "af":
        arrival = 26;
        break;
      case "oce":
        arrival = 24;
        break;
      default:
        arrival = 14;
    }

  return roundTo((departure + arrival) * jitter(`tax:${origin}${destination}:${cabin}`, 0.08), 1);
}

/** Convenience: final quote with integer miles and whole-dollar taxes. */
export function quote(
  miles: number,
  taxesUsd: number,
  basis: PriceQuote["basis"],
  note?: string,
  peak?: PriceQuote["peak"],
): PriceQuote {
  const q: PriceQuote = { miles: Math.max(1, Math.round(miles)), taxesUsd: Math.max(0, Math.round(taxesUsd)), basis };
  if (note) q.note = note;
  if (peak) q.peak = peak;
  return q;
}

export const CABIN_CODE: Record<Cabin, string> = { economy: "Y", premium: "W", business: "J", first: "F" };
