import type { AwardFare, AwardResult, Cabin, Deal } from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * Helpers shared by the simulator and the live providers: wall-clock ↔ UTC
 * conversion through `Intl` (no tz database dependency), great-circle
 * geometry, and small scoring utilities (typical-miles baseline, deal badges).
 */

// ─── Time zones ───────────────────────────────────────────────

export interface LocalParts {
  y: number;
  m: number; // 1–12
  d: number;
  hh: number;
  mm: number;
  ss: number;
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat | null>();

function formatter(tz: string): Intl.DateTimeFormat | null {
  const cached = FORMATTERS.get(tz);
  if (cached !== undefined) return cached;
  let f: Intl.DateTimeFormat | null = null;
  try {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    f = null; // unknown IANA name → treat as UTC
  }
  FORMATTERS.set(tz, f);
  return f;
}

/** Wall-clock parts of a UTC instant in `tz` (falls back to UTC for unknown zones). */
export function utcToLocalParts(utcMs: number, tz: string): LocalParts {
  const f = formatter(tz);
  const date = new Date(utcMs);
  if (!f) {
    return {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth() + 1,
      d: date.getUTCDate(),
      hh: date.getUTCHours(),
      mm: date.getUTCMinutes(),
      ss: date.getUTCSeconds(),
    };
  }
  const parts = f.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour") % 24, mm: get("minute"), ss: get("second") };
}

/** Offset of `tz` from UTC in minutes at a given instant (east positive). */
export function tzOffsetMinutes(tz: string, utcMs: number): number {
  const p = utcToLocalParts(utcMs, tz);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - utcMs) / 60_000);
}

/** Convert a local wall-clock time (YYYY-MM-DD + hh:mm in `tz`) into a UTC timestamp. */
export function localToUtcMs(dateISO: string, hh: number, mm: number, tz: string): number {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh, mm);
  const off1 = tzOffsetMinutes(tz, guess);
  let utc = guess - off1 * 60_000;
  const off2 = tzOffsetMinutes(tz, utc);
  if (off2 !== off1) utc = guess - off2 * 60_000; // DST edge
  return utc;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** UTC instant → "YYYY-MM-DDTHH:MM" wall clock in `tz` (the domain's local ISO format). */
export function utcToLocalIso(utcMs: number, tz: string): string {
  const p = utcToLocalParts(utcMs, tz);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.hh)}:${pad2(p.mm)}`;
}

/** "2026-10-07T08:35:00+00:00" / "2026-10-07 08:35-04:00" / "2026-10-07T08:35" → "2026-10-07T08:35" */
export function toLocalIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value.trim());
  return m ? `${m[1]}T${m[2]}` : undefined;
}

/** Parse a local ISO (no offset) into {date, hh, mm}. */
export function splitLocalIso(localIso: string): { date: string; hh: number; mm: number } | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(localIso);
  if (!m) return undefined;
  return { date: m[1], hh: Number(m[2]), mm: Number(m[3]) };
}

/** Add minutes to a local ISO in one zone and express the result in another zone. */
export function shiftLocalIso(localIso: string, fromTz: string, toTz: string, minutes: number): string {
  const parts = splitLocalIso(localIso);
  if (!parts) return localIso;
  const utc = localToUtcMs(parts.date, parts.hh, parts.mm, fromTz) + minutes * 60_000;
  return utcToLocalIso(utc, toTz);
}

// ─── Geometry ─────────────────────────────────────────────────

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Spherical linear interpolation along the great circle, f ∈ [0,1]. */
export function slerp(lat1: number, lon1: number, lat2: number, lon2: number, f: number): { lat: number; lon: number } {
  const φ1 = toRad(lat1);
  const λ1 = toRad(lon1);
  const φ2 = toRad(lat2);
  const λ2 = toRad(lon2);
  const sinHalf = Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2);
  const d = 2 * Math.asin(Math.min(1, sinHalf));
  if (d < 1e-9) return { lat: lat1, lon: lon1 };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: toDeg(Math.atan2(y, x)) };
}

/** Initial great-circle bearing in degrees [0, 360). */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Rough block time from distance: ~500 mph cruise + 40 min taxi/climb/descent. */
export function estimateDurationMin(distanceMiles: number): number {
  return Math.round(40 + distanceMiles / 8.3);
}

// ─── Fares & deals ────────────────────────────────────────────

/** Highest value score, ties broken by fewest miles then lowest taxes. */
export function pickBestFare(fares: AwardFare[]): AwardFare {
  return fares.reduce((best, f) => {
    if (f.valueScore > best.valueScore) return f;
    if (f.valueScore < best.valueScore) return best;
    if (f.miles < best.miles) return f;
    if (f.miles > best.miles) return best;
    return f.taxesUsd < best.taxesUsd ? f : best;
  });
}

/** Sort results by best fare: value score desc, miles asc, taxes asc, stops asc. */
export function sortResults(results: AwardResult[]): AwardResult[] {
  return [...results].sort(
    (a, b) =>
      b.bestFare.valueScore - a.bestFare.valueScore ||
      a.bestFare.miles - b.bestFare.miles ||
      a.bestFare.taxesUsd - b.bestFare.taxesUsd ||
      a.itinerary.stops - b.itinerary.stops,
  );
}

/**
 * Editorial "typical" one-way award price for a distance/cabin — the baseline
 * used to express a deal's savings. Business ≈ 20k + 10 miles per flown mile,
 * i.e. ~70k for a 5 000-mile flight.
 */
export function typicalMiles(distanceMiles: number, cabin: Cabin): number {
  const d = Math.max(0, distanceMiles);
  const raw: Record<Cabin, number> = {
    economy: 7_000 + d * 4.5,
    premium: 12_000 + d * 7,
    business: 20_000 + d * 10,
    first: 35_000 + d * 14,
  };
  return Math.round(raw[cabin] / 500) * 500;
}

/** Percentage below the baseline, clamped to [0, 90]. */
export function savingsPct(miles: number, baselineMiles: number): number {
  if (baselineMiles <= 0 || miles <= 0) return 0;
  return clamp(Math.round((1 - miles / baselineMiles) * 100), 0, 90);
}

/** Map free-form scoring badges onto the fixed `Deal.badge` vocabulary. */
export function dealBadge(badges: string[], seats: number | null, cabin: Cabin, hasBonus = false): Deal["badge"] {
  const lower = badges.map((b) => b.toLowerCase());
  if (lower.some((b) => b.includes("sweet"))) return "sweet-spot";
  if (hasBonus || lower.some((b) => b.includes("bonus"))) return "transfer-bonus";
  if (lower.some((b) => b.includes("wide"))) return "wide-open";
  if (lower.some((b) => b.includes("rare"))) return "rare";
  if (cabin === "first") return "rare";
  if ((seats ?? 0) >= 4) return "wide-open";
  return "ai-pick";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function uniq<T>(items: Iterable<T>): T[] {
  return Array.from(new Set(items));
}

/** Inclusive YYYY-MM-DD list from `from` to `to`, capped. */
export function dateRange(from: string, to: string, addDays: (iso: string, n: number) => string, daysBetween: (a: string, b: string) => number, cap = 366): string[] {
  const n = clamp(daysBetween(from, to), 0, cap);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

/** A tiny ISO country-code → name table so simulated aircraft look like OpenSky rows. */
export const COUNTRY_NAME: Readonly<Record<string, string>> = {
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  GB: "United Kingdom",
  IE: "Ireland",
  FR: "France",
  DE: "Germany",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  GR: "Greece",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  TR: "Turkey",
  IL: "Israel",
  AE: "United Arab Emirates",
  QA: "Qatar",
  SA: "Saudi Arabia",
  ET: "Ethiopia",
  KE: "Kenya",
  ZA: "South Africa",
  EG: "Egypt",
  MA: "Morocco",
  IN: "India",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  PH: "Philippines",
  HK: "Hong Kong",
  TW: "Taiwan",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  AU: "Australia",
  NZ: "New Zealand",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  PA: "Panama",
};

export function countryName(code: string | undefined): string {
  if (!code) return "Unknown";
  return COUNTRY_NAME[code.toUpperCase()] ?? code.toUpperCase();
}
