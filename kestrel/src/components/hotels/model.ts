/**
 * Hotel search — client-safe types, URL contract and list helpers.
 *
 * Nothing here imports the hotel catalogue or the pricing engine: both stay on the server
 * (see `server.ts`). The client only ever sees fully-resolved `HotelResult`s.
 */

import type { HotelCity } from "@/data/hotels";
import { HOTEL_PROGRAM_IDS } from "@/data/hotel-programs";
import type { NightQuote } from "@/lib/hotels/engine";
import type { DataSource, HotelAwardQuote, HotelProgram, HotelProperty, TransferOption } from "@/lib/types";
import { addDays, daysBetween, fmtDate, todayISO } from "@/lib/utils";

// ─── Query / URL contract ─────────────────────────────────────

export interface HotelSearchParams {
  /** City name, alias or airport code; empty when nothing has been searched yet. */
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  programs: string[];
}

export interface StayParams {
  checkIn: string;
  checkOut: string;
  guests: number;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined> | null | undefined;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function readParam(sp: ParamSource, key: string): string | undefined {
  if (!sp) return undefined;
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Default stay: a month out, three nights, two guests. */
export function defaultStay(): StayParams {
  const checkIn = addDays(todayISO(), 30);
  return { checkIn, checkOut: addDays(checkIn, 3), guests: 2 };
}

export function parseStayParams(sp: ParamSource): StayParams {
  const d = defaultStay();
  const rawIn = readParam(sp, "checkIn");
  const rawOut = readParam(sp, "checkOut");
  const checkIn = rawIn && ISO.test(rawIn) ? rawIn : d.checkIn;
  let checkOut = rawOut && ISO.test(rawOut) ? rawOut : addDays(checkIn, 3);
  if (checkOut <= checkIn) checkOut = addDays(checkIn, 3);
  const g = Number(readParam(sp, "guests"));
  const guests = Number.isFinite(g) && g >= 1 && g <= 6 ? Math.round(g) : 2;
  return { checkIn, checkOut, guests };
}

export function parseHotelSearchParams(sp: ParamSource): HotelSearchParams {
  const city = (readParam(sp, "city") ?? "").trim().slice(0, 60);
  const programs = (readParam(sp, "programs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => HOTEL_PROGRAM_IDS.includes(id));
  return { city, ...parseStayParams(sp), programs: Array.from(new Set(programs)) };
}

export function hotelSearchHref(q: HotelSearchParams): string {
  const sp = new URLSearchParams();
  if (q.city) sp.set("city", q.city);
  sp.set("checkIn", q.checkIn);
  sp.set("checkOut", q.checkOut);
  sp.set("guests", String(q.guests));
  if (q.programs.length) sp.set("programs", q.programs.join(","));
  return `/hotels?${sp.toString()}`;
}

export function hotelDetailHref(id: string, stay: StayParams): string {
  const sp = new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) });
  return `/hotels/${encodeURIComponent(id)}?${sp.toString()}`;
}

export function searchKey(q: HotelSearchParams): string {
  return [q.city.toLowerCase(), q.checkIn, q.checkOut, q.guests, q.programs.join(",")].join("|");
}

export function stayKey(s: StayParams): string {
  return `${s.checkIn}|${s.checkOut}|${s.guests}`;
}

export function nightsOf(s: StayParams): number {
  return Math.max(1, daysBetween(s.checkIn, s.checkOut));
}

export function fmtNights(n: number): string {
  return `${n} ${n === 1 ? "night" : "nights"}`;
}

/** "Sat, Mar 28 → Tue, Mar 31" */
export function stayLabel(s: StayParams, opts: { short?: boolean } = {}): string {
  const f = (iso: string) => (opts.short ? fmtDate(iso, { weekday: undefined }) : fmtDate(iso));
  return `${f(s.checkIn)} → ${f(s.checkOut)}`;
}

// ─── Resolved results (what the server hands the client) ──────

export interface ResolvedTransfer {
  bankId: string;
  bankName: string;
  bankShort: string;
  color: string;
  bankPointsNeeded: number;
  ratio: [number, number];
  bonusPercent?: number;
  transferTime: TransferOption["transferTime"];
}

export interface WalletPlanTransfer {
  from: string;
  fromShort: string;
  sourcePoints: number;
  destPoints: number;
  bonusPercent?: number;
  transferTime: TransferOption["transferTime"];
}

export interface WalletPlan {
  affordable: boolean;
  /** Points already held in the hotel program and applied to this stay */
  direct: number;
  shortfall: number;
  transfers: WalletPlanTransfer[];
}

export interface WalletContext {
  signedIn: boolean;
  hasBalances: boolean;
}

export interface HotelResult {
  quote: HotelAwardQuote;
  property: HotelProperty;
  program: HotelProgram;
  /** From `hotelValueBadges` — "Great value", "5th night free", "Peak pricing", … */
  badges: string[];
  transfers: ResolvedTransfer[];
  /** Present when the user is signed in and holds balances */
  plan: WalletPlan | null;
  /** Position in the engine's default order (available → value → fewest points) */
  rank: number;
}

export interface CitySuggestion extends HotelCity {
  hotelCount: number;
  /** Artwork borrowed from the city's signature property */
  art: HotelProperty["art"] | null;
  distanceMiles?: number;
}

export interface HotelSearchResult {
  query: HotelSearchParams;
  nights: number;
  results: HotelResult[];
  source: DataSource;
  /** The matched reference city, when the query resolved to one */
  city: HotelCity | null;
  /** Nearest cities with award hotels — the empty state's suggestions */
  nearby: CitySuggestion[];
  wallet: WalletContext;
  generatedAt: string;
}

export interface HotelDetailPayload {
  result: HotelResult;
  nights: NightQuote[];
  freeNights: number;
  freePoints: number;
  city: HotelCity | null;
  nearby: HotelResult[];
  wallet: WalletContext;
  generatedAt: string;
}

// ─── Labels & tones ───────────────────────────────────────────

export const PROGRAM_SHORT: Record<string, string> = {
  "world-of-hyatt": "Hyatt",
  "marriott-bonvoy": "Marriott",
  "hilton-honors": "Hilton",
  "ihg-one-rewards": "IHG",
  "accor-all": "Accor",
  "choice-privileges": "Choice",
  "wyndham-rewards": "Wyndham",
};

export function programShort(program: Pick<HotelProgram, "id" | "name">): string {
  return PROGRAM_SHORT[program.id] ?? program.name;
}

export const TIER_LABEL: Record<HotelProperty["tier"], string> = {
  luxury: "Luxury",
  upscale: "Upscale",
  midscale: "Midscale",
};

export type SeasonTier = NonNullable<HotelAwardQuote["tier"]>;

export const SEASON_LABEL: Record<SeasonTier, string> = {
  "off-peak": "Off-peak",
  standard: "Standard",
  peak: "Peak",
};

export type BadgeTone = "neutral" | "signal" | "aurora" | "rose" | "violet" | "gold" | "sky" | "outline";

export const SEASON_TONE: Record<SeasonTier, BadgeTone> = {
  "off-peak": "sky",
  standard: "neutral",
  peak: "rose",
};

const BADGE_TONE: Record<string, BadgeTone> = {
  "Great value": "aurora",
  "Good value": "sky",
  "5th night free": "violet",
  "Peak pricing": "rose",
  "Off-peak": "sky",
  "Points > cash": "aurora",
  "Pay cash instead": "gold",
  "Transfer bonus": "signal",
  "Under 10k/night": "gold",
  "No availability": "rose",
};

export function badgeTone(label: string): BadgeTone {
  return BADGE_TONE[label] ?? "neutral";
}

/** Badges worth showing on a card — the sold-out state is rendered separately. */
export function cardBadges(badges: string[]): string[] {
  return badges.filter((b) => b !== "No availability");
}

// ─── Sorting & filtering ──────────────────────────────────────

export type HotelSort = "value" | "points" | "cash" | "cpp" | "stars";

export const SORT_OPTIONS: { value: HotelSort; label: string; description: string }[] = [
  { value: "value", label: "Best value", description: "Available first, then cents per point" },
  { value: "points", label: "Fewest points", description: "Lowest total points for the stay" },
  { value: "cash", label: "Lowest cash", description: "Cheapest to pay outright" },
  { value: "cpp", label: "Highest cpp", description: "Most cents per point redeemed" },
  { value: "stars", label: "Stars", description: "Five-star properties first" },
];

export function sortResults(results: HotelResult[], sort: HotelSort): HotelResult[] {
  const byRank = (a: HotelResult, b: HotelResult) => a.rank - b.rank;
  const list = [...results];
  switch (sort) {
    case "points":
      return list.sort((a, b) => a.quote.totalPoints - b.quote.totalPoints || byRank(a, b));
    case "cash":
      return list.sort((a, b) => a.quote.totalCashUsd - b.quote.totalCashUsd || byRank(a, b));
    case "cpp":
      return list.sort((a, b) => b.quote.cpp - a.quote.cpp || byRank(a, b));
    case "stars":
      return list.sort((a, b) => b.property.stars - a.property.stars || byRank(a, b));
    default:
      return list.sort(byRank);
  }
}

export interface HotelFilters {
  programs: string[];
  tiers: HotelProperty["tier"][];
  stars: number[];
  /** null = any */
  maxPointsPerNight: number | null;
  fifthNightOnly: boolean;
  availableOnly: boolean;
}

export const EMPTY_FILTERS: HotelFilters = {
  programs: [],
  tiers: [],
  stars: [],
  maxPointsPerNight: null,
  fifthNightOnly: false,
  availableOnly: false,
};

export function activeFilterCount(f: HotelFilters): number {
  return (
    (f.programs.length ? 1 : 0) +
    (f.tiers.length ? 1 : 0) +
    (f.stars.length ? 1 : 0) +
    (f.maxPointsPerNight != null ? 1 : 0) +
    (f.fifthNightOnly ? 1 : 0) +
    (f.availableOnly ? 1 : 0)
  );
}

export function applyFilters(results: HotelResult[], f: HotelFilters): HotelResult[] {
  return results.filter((r) => {
    if (f.programs.length && !f.programs.includes(r.program.id)) return false;
    if (f.tiers.length && !f.tiers.includes(r.property.tier)) return false;
    if (f.stars.length && !f.stars.includes(r.property.stars)) return false;
    if (f.maxPointsPerNight != null && r.quote.pointsPerNight > f.maxPointsPerNight) return false;
    if (f.fifthNightOnly && !r.quote.fifthNightFreeApplied) return false;
    if (f.availableOnly && !r.quote.available) return false;
    return true;
  });
}

/** Slider ceiling for the points filter: the priciest night in the set, rounded up to 5k. */
export function pointsCeiling(results: HotelResult[]): number {
  const max = results.reduce((m, r) => Math.max(m, r.quote.pointsPerNight), 0);
  return Math.max(10_000, Math.ceil(max / 5_000) * 5_000);
}

/** Toggle a value in a list without duplicates. */
export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Region name from an ISO country code ("JP" → "Japan"), falling back to the code. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function flagEmoji(code: string): string {
  if (code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export const COMPARE_MAX = 3;
