/**
 * Kestrel value scoring: cents-per-point versus a cabin benchmark, adjusted for
 * taxes, seat availability and stops, plus badge thresholds.
 */
import type { Cabin } from "@/lib/types";
import { clamp } from "@/lib/utils";

export interface ScoreInput {
  programId: string;
  cabin: Cabin;
  miles: number;
  taxesUsd: number;
  cashUsd: number;
  distanceMiles: number;
  seats: number | null;
  stops: number;
}

/** Cents per point = (cash − taxes) / miles × 100. */
export function cpp(miles: number, taxesUsd: number, cashUsd: number): number {
  if (miles <= 0) return 0;
  return Math.max(0, ((cashUsd - taxesUsd) / miles) * 100);
}

/** Editorial cpp benchmark per cabin: hitting it scores ≈ 70 points. */
export const CPP_BENCHMARK: Record<Cabin, number> = { economy: 1.5, premium: 1.8, business: 2.5, first: 4.0 };

export const BADGE = {
  sweetSpot: "Sweet spot",
  lowTaxes: "Low taxes",
  wideOpen: "Wide open",
  nonstop: "Nonstop",
  rare: "Rare",
  surchargeHeavy: "Surcharge heavy",
} as const;

/** Thresholds (exported so the UI legend and tests share them). */
export const SCORE_THRESHOLDS = {
  /** cpp ≥ this multiple of the cabin benchmark earns "Sweet spot" */
  sweetSpotMultiple: 1.8,
  lowTaxesUsd: 60,
  surchargeHeavyUsd: 400,
  wideOpenSeats: 4,
} as const;

/** cpp ratio → 0–100 via a saturating curve: ratio 1 ≈ 70, 2 ≈ 91, 0.5 ≈ 45, 3 ≈ 97. */
function cppScore(ratio: number): number {
  const k = 1.204; // solves 1 − e^(−k) = 0.70
  return 100 * (1 - Math.exp(-k * Math.max(0, ratio)));
}

/** 0–100 score plus badges like "Sweet spot", "Low taxes", "Wide open". */
export function scoreFare(input: ScoreInput): { valueScore: number; badges: string[]; cpp: number } {
  const { cabin, miles, taxesUsd, cashUsd, seats, stops } = input;
  const c = cpp(miles, taxesUsd, cashUsd);
  const bench = CPP_BENCHMARK[cabin];
  const ratio = bench > 0 ? c / bench : 0;

  // No redemption value at all (taxes ≥ cash, or no cash reference) → zero, no modifiers.
  if (c <= 0) {
    const badges: string[] = [];
    if (taxesUsd < SCORE_THRESHOLDS.lowTaxesUsd) badges.push(BADGE.lowTaxes);
    if (stops === 0) badges.push(BADGE.nonstop);
    if (taxesUsd > SCORE_THRESHOLDS.surchargeHeavyUsd) badges.push(BADGE.surchargeHeavy);
    return { valueScore: 0, badges, cpp: 0 };
  }

  let score = cppScore(ratio);

  // Taxes as a share of the cash fare you'd otherwise pay — heavy surcharges erode the redemption.
  const taxRatio = cashUsd > 0 ? taxesUsd / cashUsd : 0;
  score -= clamp(taxRatio * 50, 0, 15);

  // Availability: open space is worth something, a lone seat is fragile.
  if (seats != null) {
    if (seats >= 7) score += 6;
    else if (seats >= SCORE_THRESHOLDS.wideOpenSeats) score += 5;
    else if (seats >= 2) score += 2;
    else if (seats <= 1) score -= 2;
  }

  // Connections: −4 each, capped.
  score -= clamp(stops * 4, 0, 10);

  const badges: string[] = [];
  if (ratio >= SCORE_THRESHOLDS.sweetSpotMultiple) badges.push(BADGE.sweetSpot);
  if (taxesUsd < SCORE_THRESHOLDS.lowTaxesUsd) badges.push(BADGE.lowTaxes);
  if (seats != null && seats >= SCORE_THRESHOLDS.wideOpenSeats) badges.push(BADGE.wideOpen);
  if (stops === 0) badges.push(BADGE.nonstop);
  if (seats != null && seats <= 1 && (cabin === "business" || cabin === "first")) badges.push(BADGE.rare);
  if (taxesUsd > SCORE_THRESHOLDS.surchargeHeavyUsd) badges.push(BADGE.surchargeHeavy);

  return { valueScore: Math.round(clamp(score, 0, 100)), badges, cpp: Math.round(c * 100) / 100 };
}
