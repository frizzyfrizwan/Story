/**
 * Cathay Pacific Asia Miles — distance-based Standard awards (as published 2025),
 * one-way per segment. Five bands: ultra-short ≤750, short ≤2,750, medium ≤5,000,
 * long ≤7,500, ultra-long 7,501+.
 *
 * Cathay-operated Standard:  Y 7.5k/10k/22k/30k/42k · W 11k/16k/32k/45k/55k ·
 *                            J 16k/25k/45k/70k/85k · F 22k/40k/65k/110k/125k
 *   e.g. HKG–JFK (8,070 mi) J 85k / F 125k; HKG–SFO J 70k; HKG–LHR J 70k; HKG–NRT J 25k.
 * Single-partner awards use a slightly higher table. Choice/Tailored levels
 * (when Standard space is gone) ≈ 1.5× — modelled at high demand.
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
  quote,
  roundTo,
  row,
  type CabinRow,
  type ChartFn,
} from "./common";

const CX_METAL = new Set(["CX", "KA", "HX"]); // Cathay, legacy Dragon, HK Express (Y only in practice)
/** oneworld + Air New Zealand, Bangkok Airways, Lufthansa group, Air China, Gulf Air. */
const BOOKABLE = allow(ONEWORLD, ["NZ", "PG", "LH", "LX", "OS", "CA", "GF", "KA", "HX"]);

const BANDS: readonly number[] = [750, 2750, 5000, 7500];
const STANDARD: readonly CabinRow[] = [
  row(7_500, 11_000, 16_000, 22_000),
  row(10_000, 16_000, 25_000, 40_000),
  row(22_000, 32_000, 45_000, 65_000),
  row(30_000, 45_000, 70_000, 110_000),
  row(42_000, 55_000, 85_000, 125_000),
];
const PARTNER: readonly CabinRow[] = [
  row(10_000, 15_000, 18_000, 25_000),
  row(12_500, 20_000, 28_000, 45_000),
  row(25_000, 35_000, 50_000, 70_000),
  row(35_000, 50_000, 75_000, 110_000),
  row(45_000, 60_000, 90_000, 130_000),
];

export const cathayAsiaMiles: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const bi = bandIndex(input.distanceMiles, BANDS);
  const own = CX_METAL.has(carrier);
  const base = (own ? STANDARD : PARTNER)[bi][input.cabin];
  if (base == null) return null;
  const taxes = govTaxes(input) + carrierSurcharge(carrier, input.cabin, input.distanceMiles);
  if (own) {
    const d = demandOf(input);
    const choice = d > 0.8;
    const miles = choice ? roundTo(base * 1.5, 500) : base;
    return quote(
      miles,
      taxes,
      choice ? "dynamic" : "chart",
      `Asia Miles: Cathay-operated ${bandLabel(bi, BANDS)}, ${choice ? "Choice (Standard sold out)" : "Standard"}`,
      choice ? "peak" : "standard",
    );
  }
  return quote(base, taxes, "chart", `Asia Miles: ${carrier} single-partner award, ${bandLabel(bi, BANDS)}`);
};
