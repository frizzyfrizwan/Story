/**
 * Cash-fare and "market-typical award" models used when no live fare exists.
 * Pure and deterministic: the only variation comes from hash32 of the inputs.
 *
 * Calibration targets (one-way, 2025 market):
 *   Economy transatlantic (≈3,500 mi) ≈ $600–1,100
 *   Business long-haul (3,500–7,000 mi) ≈ $3,500–6,500
 *   First long-haul ≈ $8,000–14,000
 */
import type { Cabin } from "@/lib/types";
import { clamp, hash32 } from "@/lib/utils";
import { inWindow, isChristmasNY, isSummer, nearEaster, nearThanksgiving, ymd } from "./charts/common";

interface FareCurve {
  /** Fixed component — airport charges, minimum fare floor */
  base: number;
  /** Dollars per mile up to the knee */
  perMile: number;
}

const CURVE: Record<Cabin, FareCurve> = {
  economy: { base: 120, perMile: 0.17 },
  premium: { base: 250, perMile: 0.34 },
  business: { base: 600, perMile: 0.85 },
  first: { base: 1400, perMile: 1.75 },
};

/** Ultra-long-haul fares grow sub-linearly beyond ~7,000 mi. */
function effectiveDistance(distanceMiles: number): number {
  const d = Math.max(0, distanceMiles);
  return d <= 7000 ? d : 7000 + (d - 7000) * 0.6;
}

/** Seasonal multiplier on cash fares: summer and holidays cost more, deep winter less. */
export function seasonalFareMultiplier(date?: string): number {
  if (!date) return 1;
  const x = ymd(date);
  if (isChristmasNY(x) || nearThanksgiving(x)) return 1.22;
  if (isSummer(x)) return 1.15;
  if (nearEaster(x, 5, 5)) return 1.08;
  if (inWindow(x.md, 106, 228)) return 0.88;
  if (inWindow(x.md, 1101, 1216)) return 0.93;
  return 1;
}

/** Estimated lowest cash fare in USD for a one-way itinerary when no live fare is available. */
export function estimateCashFare(distanceMiles: number, cabin: Cabin, date?: string): number {
  const c = CURVE[cabin];
  const d = effectiveDistance(distanceMiles);
  const raw = c.base + d * c.perMile;
  const season = seasonalFareMultiplier(date);
  // ±8 % deterministic noise so adjacent dates/routes don't all land on the same number.
  const u = (hash32(`cash:${date ?? ""}:${cabin}:${Math.round(distanceMiles)}`) % 10_000) / 10_000;
  const noise = 1 + (u * 2 - 1) * 0.08;
  return Math.round(clamp(raw * season * noise, 60, 40_000));
}

/**
 * Market-typical award price (miles) for a cabin/distance across programs —
 * the yardstick for "savings %" on deals. Calibrated so a 3,500 mi transatlantic
 * sits near Y 26k / W 40k / J 62k / F 85k and a 7,000 mi flight near J 100k.
 */
export function typicalMilesFor(cabin: Cabin, distanceMiles: number): number {
  const d = Math.max(0, distanceMiles);
  const knee = (k: number, slopeAfter: number) => (d <= k ? d : k + (d - k) * slopeAfter);
  let miles: number;
  switch (cabin) {
    case "economy":
      miles = 5000 + 6.0 * knee(5000, 0.7);
      break;
    case "premium":
      miles = 8000 + 9.0 * knee(4500, 0.6);
      break;
    case "business":
      miles = 10_000 + 15.0 * knee(4000, 0.55);
      break;
    case "first":
      miles = 15_000 + 20.0 * knee(4000, 0.55);
      break;
  }
  return Math.round(miles / 500) * 500;
}
