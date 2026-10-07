import type { HotelAwardQuote, HotelProgram, HotelProperty, TransferLink, TransferOption } from "@/lib/types";
import { addDays, clamp, daysBetween, hash32, parseISODate, seededRandom } from "@/lib/utils";
import {
  ACCOR_EUR_PER_BLOCK,
  ACCOR_POINTS_PER_BLOCK,
  CHOICE_LEVELS,
  DYNAMIC_PRICING,
  USD_TO_EUR,
  WYNDHAM_TIERS,
  getHotelProgram,
  hyattPoints,
  type HyattSeasonTier,
} from "@/data/hotel-programs";
import { getHotel, getHotelCity } from "@/data/hotels";

/**
 * Hotel award engine — pure and deterministic.
 *
 * Every random-looking quantity (cash noise, dynamic demand noise, availability) is drawn
 * from a PRNG seeded with `hash32(propertyId + "|" + nightDate)`, so the same property on
 * the same night always prices the same way regardless of the stay it is part of. No I/O.
 */

export type SeasonTier = HyattSeasonTier;

export interface HotelQuoteInput {
  property: HotelProperty;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Bank → hotel program links to compute transfer options */
  transfers: TransferLink[];
  /** Live cash rate per night if a provider supplied one */
  liveCashPerNightUsd?: number;
  /** YYYY-MM-DD used to decide whether a transfer bonus is active; bonuses apply as given when omitted */
  asOf?: string;
  /** Override the `fetchedAt` stamp (tests, caching) */
  fetchedAt?: string;
}

export interface NightQuote {
  date: string;
  tier: SeasonTier;
  weekend: boolean;
  holiday?: string;
  points: number;
  cashUsd: number;
  available: boolean;
  /** True when this night was waived by a 5th-night-free rule */
  free: boolean;
}

export interface HotelQuoteDetail {
  quote: HotelAwardQuote;
  nights: NightQuote[];
  program?: HotelProgram;
  freeNights: number;
  freePoints: number;
}

// ─── Seasonality ────────────────────────────────────────────────

export interface SeasonContext {
  resort: boolean;
  peakMonths: number[];
  lowMonths: number[];
  countryCode: string;
}

const RESORT_MOTIFS = new Set<HotelProperty["art"]["motif"]>(["island", "coast", "mountain", "desert"]);
const LUNAR_NEW_YEAR_COUNTRIES = new Set(["CN", "HK", "SG", "VN", "KR", "TW", "MY"]);
const EASTER_COUNTRIES = new Set([
  "GB",
  "FR",
  "ES",
  "IT",
  "PT",
  "NL",
  "AT",
  "CH",
  "DE",
  "IE",
  "BE",
  "MX",
  "CR",
  "AR",
  "BR",
  "PH",
]);
const LUNAR_NEW_YEAR: Record<number, string> = {
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-03",
  2031: "2031-01-23",
  2032: "2032-02-11",
};

/** Derive the seasonal context for a property from its city (falls back to hemisphere + motif heuristics). */
export function seasonContextFor(property: HotelProperty): SeasonContext {
  const city = getHotelCity(property.city);
  const southern = property.lat < 0;
  return {
    resort: city?.resort ?? RESORT_MOTIFS.has(property.art.motif),
    peakMonths: city?.peakMonths ?? (southern ? [12, 1] : [7, 8]),
    lowMonths: city?.lowMonths ?? (southern ? [6, 7] : [1, 2, 11]),
    countryCode: city?.countryCode ?? property.countryCode,
  };
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month - 1, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const last = new Date(year, month, 0);
  return last.getDate() - ((last.getDay() - weekday + 7) % 7);
}

/** Gregorian Easter Sunday (Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
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
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Name of the major holiday a night falls in, if any (drives peak pricing). */
export function holidayFor(date: string, countryCode: string): string | undefined {
  const d = parseISODate(date);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if ((m === 12 && day >= 20) || (m === 1 && day <= 3)) return "Festive season";

  if (countryCode === "US") {
    const tg = nthWeekdayOfMonth(y, 11, 4, 4);
    if (m === 11 && day >= tg - 1 && day <= tg + 2) return "Thanksgiving";
    const md = lastWeekdayOfMonth(y, 5, 1);
    if (m === 5 && day >= md - 3 && day <= md - 1) return "Memorial Day";
    const ld = nthWeekdayOfMonth(y, 9, 1, 1);
    if (m === 9 && day >= ld - 3 && day <= ld - 1) return "Labor Day";
    if (m === 7 && day >= 3 && day <= 5) return "Independence Day";
  }
  if (countryCode === "JP") {
    if ((m === 4 && day >= 29) || (m === 5 && day <= 5)) return "Golden Week";
    if (m === 8 && day >= 13 && day <= 16) return "Obon";
  }
  if (LUNAR_NEW_YEAR_COUNTRIES.has(countryCode)) {
    const lny = LUNAR_NEW_YEAR[y];
    if (lny) {
      const diff = daysBetween(lny, date);
      if (diff >= -2 && diff <= 5) return "Lunar New Year";
    }
  }
  if (EASTER_COUNTRIES.has(countryCode)) {
    const easter = easterSunday(y);
    const diff = daysBetween(easter, date);
    if (countryCode === "BR" && diff >= -51 && diff <= -47) return "Carnival";
    const holyWeek = countryCode === "MX" || countryCode === "CR" || countryCode === "ES" || countryCode === "IT";
    if (diff >= (holyWeek ? -7 : -2) && diff <= 0) return "Easter";
  }
  return undefined;
}

export interface NightSeason {
  tier: SeasonTier;
  weekend: boolean;
  holiday?: string;
}

/**
 * Season tier for one night. Holidays are always peak; months listed as peak for the
 * destination are peak; low months price weekday nights off-peak; resorts price Friday
 * and Saturday nights as peak the rest of the year.
 */
export function seasonFor(date: string, ctx: SeasonContext): NightSeason {
  const d = parseISODate(date);
  const dow = d.getDay();
  const weekend = dow === 5 || dow === 6;
  const month = d.getMonth() + 1;
  const holiday = holidayFor(date, ctx.countryCode);
  if (holiday) return { tier: "peak", weekend, holiday };
  if (ctx.peakMonths.includes(month)) return { tier: "peak", weekend };
  if (ctx.lowMonths.includes(month)) return { tier: weekend ? "standard" : "off-peak", weekend };
  if (ctx.resort && weekend) return { tier: "peak", weekend };
  return { tier: "standard", weekend };
}

const CASH_MULT: Record<SeasonTier, number> = { "off-peak": 0.8, standard: 1, peak: 1.3 };
const AVAILABILITY_BASE: Record<SeasonTier, number> = { "off-peak": 0.98, standard: 0.965, peak: 0.9 };

// ─── Per-night pricing ──────────────────────────────────────────

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function snapToLevels(points: number, levels: readonly number[], shift = 0): number {
  let idx = 0;
  let best = Infinity;
  levels.forEach((lvl, i) => {
    const diff = Math.abs(lvl - points);
    if (diff < best) {
      best = diff;
      idx = i;
    }
  });
  return levels[clamp(idx + shift, 0, levels.length - 1)];
}

/** Infer a Hyatt category from the standard points rate when the data omits it. */
function inferHyattCategory(standardPoints: number): number {
  let cat = 1;
  for (let c = 1; c <= 8; c++) if (hyattPoints(c) <= standardPoints) cat = c;
  return cat;
}

/** Accor: cash converted to euros and covered in 2,000-point (€40) blocks, rounded up. */
export function accorPointsFor(cashUsd: number): number {
  return Math.ceil((cashUsd * USD_TO_EUR) / ACCOR_EUR_PER_BLOCK) * ACCOR_POINTS_PER_BLOCK;
}

/** Dynamic programs: cash × k (blended with the property's own anchor), ±15% demand noise, clamped. */
export function dynamicPointsFor(
  property: HotelProperty,
  program: HotelProgram,
  cashUsd: number,
  noise: number,
): number {
  const cfg = DYNAMIC_PRICING[program.id] ?? {
    k: 100 / Math.max(0.1, program.valuationCpp),
    floor: 5_000,
    ceiling: 150_000,
    step: 500,
  };
  const anchorK =
    property.avgCashUsd > 0 && property.avgPointsPerNight > 0
      ? property.avgPointsPerNight / property.avgCashUsd
      : cfg.k;
  const k = (cfg.k + anchorK) / 2;
  const raw = cashUsd * k * noise;
  return clamp(roundTo(raw, cfg.step), cfg.floor, cfg.ceiling);
}

function pointsForNight(
  property: HotelProperty,
  program: HotelProgram | undefined,
  tier: SeasonTier,
  cashUsd: number,
  noise: number,
): number {
  const chart = program?.chartType ?? "dynamic";
  if (chart === "category") {
    const category = property.category ?? inferHyattCategory(property.avgPointsPerNight);
    return hyattPoints(category, tier);
  }
  if (chart === "fixed") {
    switch (program?.id) {
      case "accor-all":
        return accorPointsFor(cashUsd);
      case "wyndham-rewards":
        return snapToLevels(property.avgPointsPerNight, WYNDHAM_TIERS);
      case "choice-privileges":
        return snapToLevels(
          property.avgPointsPerNight,
          CHOICE_LEVELS,
          tier === "peak" ? 1 : tier === "off-peak" ? -1 : 0,
        );
      default:
        return property.avgPointsPerNight;
    }
  }
  if (!program) return Math.round(property.avgPointsPerNight * CASH_MULT[tier]);
  return dynamicPointsFor(property, program, cashUsd, noise);
}

/** Price a single night. Exposed for calendars and tests. */
export function quoteNight(
  property: HotelProperty,
  date: string,
  opts: { program?: HotelProgram; ctx?: SeasonContext; liveCashPerNightUsd?: number } = {},
): NightQuote {
  const program = opts.program ?? getHotelProgram(property.programId);
  const ctx = opts.ctx ?? seasonContextFor(property);
  const season = seasonFor(date, ctx);
  const rng = seededRandom(hash32(`${property.id}|${date}`));

  // Draw order is part of the contract: availability, cash noise, demand noise.
  const availDraw = rng();
  const cashNoise = 0.9 + rng() * 0.2; // ±10%
  const demandNoise = 0.85 + rng() * 0.3; // ±15%

  let cashUsd: number;
  if (opts.liveCashPerNightUsd != null && opts.liveCashPerNightUsd > 0) {
    cashUsd = opts.liveCashPerNightUsd;
  } else {
    let mult = CASH_MULT[season.tier];
    if (season.weekend) mult *= ctx.resort ? 1.1 : 0.92;
    if (season.holiday) mult *= 1.1;
    cashUsd = Math.round(property.avgCashUsd * mult * cashNoise);
  }

  let pAvailable = AVAILABILITY_BASE[season.tier];
  if (season.weekend) pAvailable *= 0.98;
  if (season.holiday) pAvailable *= 0.9;
  if (property.tier === "luxury") pAvailable *= 0.99;

  return {
    date,
    tier: season.tier,
    weekend: season.weekend,
    holiday: season.holiday,
    points: pointsForNight(property, program, season.tier, cashUsd, demandNoise),
    cashUsd,
    available: availDraw < pAvailable,
    free: false,
  };
}

// ─── Stay-level quote ───────────────────────────────────────────

const TIER_RANK: Record<SeasonTier, number> = { "off-peak": 0, standard: 1, peak: 2 };

function dominantTier(nights: NightQuote[]): SeasonTier {
  const counts: Record<SeasonTier, number> = { "off-peak": 0, standard: 0, peak: 0 };
  for (const n of nights) counts[n.tier]++;
  return (Object.keys(counts) as SeasonTier[]).sort((a, b) => counts[b] - counts[a] || TIER_RANK[b] - TIER_RANK[a])[0];
}

/** Apply "every 5th night free": the cheapest night in each complete block of five is waived. */
function applyFifthNightFree(nights: NightQuote[]): { freeNights: number; freePoints: number } {
  let freeNights = 0;
  let freePoints = 0;
  for (let start = 0; start + 5 <= nights.length; start += 5) {
    const block = nights.slice(start, start + 5);
    const cheapest = block.reduce((min, n) => (n.points < min.points ? n : min), block[0]);
    cheapest.free = true;
    freeNights++;
    freePoints += cheapest.points;
  }
  return { freeNights, freePoints };
}

/** Bank points needed to cover `points` via a transfer link, honouring ratio, bonus, minimum and 1,000-point increments. */
export function transferOptionFor(link: TransferLink, points: number, asOf?: string): TransferOption {
  const [fromUnits, toUnits] = link.ratio;
  const bonusActive =
    link.bonus != null && (asOf == null || (asOf >= link.bonus.startsAt && asOf <= link.bonus.endsAt));
  const bonusPercent = bonusActive && link.bonus ? link.bonus.percent : undefined;
  const multiplier = 1 + (bonusPercent ?? 0) / 100;
  const raw = points <= 0 ? 0 : (points * fromUnits) / (toUnits * multiplier);
  const rounded = Math.ceil(raw / 1_000) * 1_000;
  return {
    bankProgramId: link.from,
    ratio: link.ratio,
    bankPointsNeeded: Math.max(rounded, link.minimum),
    bonusPercent,
    transferTime: link.transferTime,
  };
}

/** Value score 0–100 against the program's editorial valuation: 50 at benchmark, 100 at ≥ 2.2× benchmark. */
export function valueScoreFor(cpp: number, benchmarkCpp: number): number {
  if (!(benchmarkCpp > 0) || !(cpp > 0)) return 0;
  const ratio = cpp / benchmarkCpp;
  const score = ratio <= 1 ? 50 * ratio : 50 + 50 * Math.min(1, (ratio - 1) / 1.2);
  return clamp(Math.round(score), 0, 100);
}

/** Full quote with the per-night breakdown. */
export function quoteHotelDetailed(input: HotelQuoteInput): HotelQuoteDetail {
  const { property, checkIn, checkOut, transfers } = input;
  const program = getHotelProgram(property.programId);
  const ctx = seasonContextFor(property);
  const nightCount = Math.max(1, daysBetween(checkIn, checkOut));

  const nights: NightQuote[] = [];
  for (let i = 0; i < nightCount; i++) {
    nights.push(
      quoteNight(property, addDays(checkIn, i), { program, ctx, liveCashPerNightUsd: input.liveCashPerNightUsd }),
    );
  }

  const grossPoints = nights.reduce((s, n) => s + n.points, 0);
  const totalCashUsd = Math.round(nights.reduce((s, n) => s + n.cashUsd, 0));
  const fifthNightEligible = (program?.fifthNightFree ?? false) && nightCount >= 5;
  const { freeNights, freePoints } = fifthNightEligible
    ? applyFifthNightFree(nights)
    : { freeNights: 0, freePoints: 0 };
  const totalPoints = grossPoints - freePoints;

  const cpp = totalPoints > 0 ? Math.round((totalCashUsd / totalPoints) * 100 * 100) / 100 : 0;
  const valueScore = valueScoreFor(cpp, program?.valuationCpp ?? 1);

  const transferOptions = transfers
    .filter((t) => t.to === property.programId)
    .map((t) => transferOptionFor(t, totalPoints, input.asOf))
    .sort((a, b) => a.bankPointsNeeded - b.bankPointsNeeded || a.bankProgramId.localeCompare(b.bankProgramId));

  const quote: HotelAwardQuote = {
    propertyId: property.id,
    checkIn,
    checkOut,
    nights: nightCount,
    pointsPerNight: Math.round(grossPoints / nightCount),
    totalPoints,
    cashPerNightUsd: Math.round(totalCashUsd / nightCount),
    totalCashUsd,
    cpp,
    valueScore,
    available: nights.every((n) => n.available),
    fifthNightFreeApplied: freeNights > 0,
    tier: dominantTier(nights),
    transferOptions,
    source: input.liveCashPerNightUsd != null ? "cached" : "simulated",
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
  };

  return { quote, nights, program, freeNights, freePoints };
}

export function quoteHotel(input: HotelQuoteInput): HotelAwardQuote {
  return quoteHotelDetailed(input).quote;
}

// ─── Presentation helpers ───────────────────────────────────────

function programForQuote(quote: HotelAwardQuote): HotelProgram | undefined {
  const property = getHotel(quote.propertyId);
  return property ? getHotelProgram(property.programId) : undefined;
}

/**
 * Short badge strings for a quote, e.g. "Great value", "5th night free", "Peak pricing",
 * "Points > cash" (points beat paying cash at the program's valuation).
 */
export function hotelValueBadges(quote: HotelAwardQuote, program?: HotelProgram): string[] {
  const prog = program ?? programForQuote(quote);
  const benchmark = prog?.valuationCpp ?? 0;
  const badges: string[] = [];

  if (!quote.available) badges.push("No availability");
  if (quote.valueScore >= 75) badges.push("Great value");
  else if (quote.valueScore >= 60) badges.push("Good value");
  if (quote.fifthNightFreeApplied) badges.push("5th night free");
  if (quote.tier === "peak") badges.push("Peak pricing");
  else if (quote.tier === "off-peak") badges.push("Off-peak");
  if (benchmark > 0 && quote.cpp > 0) {
    if (quote.cpp >= benchmark) badges.push("Points > cash");
    else if (quote.cpp < benchmark * 0.6) badges.push("Pay cash instead");
  }
  if (quote.transferOptions.some((t) => (t.bonusPercent ?? 0) > 0)) badges.push("Transfer bonus");
  if (quote.pointsPerNight > 0 && quote.pointsPerNight <= 10_000) badges.push("Under 10k/night");
  return badges;
}

/** Sort helper: available first, then best value, then fewest points. */
export function compareQuotes(a: HotelAwardQuote, b: HotelAwardQuote): number {
  if (a.available !== b.available) return a.available ? -1 : 1;
  if (a.valueScore !== b.valueScore) return b.valueScore - a.valueScore;
  if (a.totalPoints !== b.totalPoints) return a.totalPoints - b.totalPoints;
  return a.propertyId.localeCompare(b.propertyId);
}
