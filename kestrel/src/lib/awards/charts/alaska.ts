/**
 * Alaska Airlines Mileage Plan — 2024+ distance-based partner award chart
 * ("starting at" prices, as published 2025), one-way per itinerary. Alaska's own
 * flights price dynamically from 4.5k miles. Alaska adds no surcharges except
 * British Airways' carrier charges.
 *
 * Partner "starting at" by distance:
 *   ≤700 Y 4.5k / J 10k / F 15k · 701–1,400 Y 7.5k / J 15k / F 20k ·
 *   1,401–2,100 Y 10k / J 20k / F 30k · 2,101–2,800 Y 12.5k / J 25k / F 35k ·
 *   2,801–4,000 Y 20k / J 55k / F 70k · 4,001–5,500 Y 25k / J 55k / F 70k ·
 *   5,501–7,000 Y 30k / J 60k / F 70k · 7,001–9,000 Y 35k / J 70k / F 85k ·
 *   9,001+ Y 40k / J 80k / F 100k
 */
import {
  allow,
  bandIndex,
  bandLabel,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  ONEWORLD,
  peakFromDemand,
  quote,
  roundTo,
  row,
  type CabinRow,
  type ChartFn,
} from "./common";

const AS_METAL = new Set(["AS", "QX", "OO"]); // Alaska, Horizon, SkyWest-for-Alaska
/** oneworld + Aer Lingus, Condor, El Al, Icelandair, Korean, LATAM, Singapore, STARLUX, Hawaiian, Porter. */
const BOOKABLE = allow(ONEWORLD, ["EI", "DE", "LY", "FI", "KE", "LA", "SQ", "JX", "HA", "PD"]);

const BANDS: readonly number[] = [700, 1400, 2100, 2800, 4000, 5500, 7000, 9000];
const STARTING_AT: readonly CabinRow[] = [
  row(4_500, 7_500, 10_000, 15_000),
  row(7_500, 12_500, 15_000, 20_000),
  row(10_000, 15_000, 20_000, 30_000),
  row(12_500, 17_500, 25_000, 35_000),
  row(20_000, 32_500, 55_000, 70_000),
  row(25_000, 37_500, 55_000, 70_000),
  row(30_000, 45_000, 60_000, 70_000),
  row(35_000, 50_000, 70_000, 85_000),
  row(40_000, 55_000, 80_000, 100_000),
];

export const alaskaMileagePlan: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const bi = bandIndex(input.distanceMiles, BANDS);
  const base = STARTING_AT[bi][input.cabin];
  if (base == null) return null;
  const d = demandOf(input);
  // "Starting at" — only BA surcharges are passed through.
  const taxes = govTaxes(input) + (carrier === "BA" ? carrierSurcharge("BA", input.cabin, input.distanceMiles) : 0);
  if (AS_METAL.has(carrier)) {
    const miles = roundTo(base * (0.9 + d * 1.4), 500);
    return quote(
      miles,
      taxes,
      "dynamic",
      `Mileage Plan: ${bandLabel(bi, BANDS)}, Alaska-operated dynamic`,
      peakFromDemand(d),
    );
  }
  // Partner space above the floor on busy dates (≈ up to 1.6×).
  const miles = roundTo(base * (1 + Math.max(0, d - 0.5) * 1.2), 500);
  return quote(
    miles,
    taxes,
    "chart",
    `Mileage Plan: ${bandLabel(bi, BANDS)} partner award starting at ${base.toLocaleString("en-US")}`,
    peakFromDemand(d),
  );
};
