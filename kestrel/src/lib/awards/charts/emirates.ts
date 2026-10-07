/**
 * Emirates Skywards — Classic Rewards on Emirates metal, distance-tiered
 * (as published 2025; Saver level, one-way) with heavy carrier surcharges.
 * Flex / Flex Plus (≈ 1.5× / 2×) apply when Saver space is gone — modelled at
 * high demand. e.g. DXB–LHR (3,400 mi) Y 36k / J 72.5k / F 110k;
 * DXB–JFK (6,840 mi) Y 56k / J 108.75k / F 170k.
 * Partner redemptions (JAL, Qantas, Korean, Malaysia, South African, TAP, Air
 * Mauritius, Jetstar, flydubai, United) are estimates.
 */
import {
  allow,
  bandIndex,
  bandLabel,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  quote,
  roundTo,
  row,
  type CabinRow,
  type ChartFn,
} from "./common";
import { genericEstimate } from "./generic";

const EK_METAL = new Set(["EK"]);
const BOOKABLE = allow(["EK", "FZ", "JL", "QF", "KE", "MH", "SA", "TP", "MK", "JQ", "UA", "CZ", "GF"]);

const BANDS: readonly number[] = [2000, 4000, 6000, 8000];
const SAVER: readonly CabinRow[] = [
  row(17_500, 27_000, 42_500, 60_000),
  row(36_000, 52_000, 72_500, 110_000),
  row(45_000, 65_000, 90_000, 135_000),
  row(56_000, 80_000, 108_750, 170_000),
  row(65_000, 95_000, 125_000, 200_000),
];

export const emiratesSkywards: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  if (!EK_METAL.has(carrier)) {
    return genericEstimate(input, {
      factor: 1.15,
      surcharge: { economy: 60, premium: 90, business: 150, first: 200 },
      note: `Skywards: ${carrier} partner estimate`,
    });
  }
  const bi = bandIndex(input.distanceMiles, BANDS);
  const saver = SAVER[bi][input.cabin];
  if (saver == null) return null;
  const d = demandOf(input);
  const tier = d > 0.85 ? "Flex Plus" : d > 0.7 ? "Flex" : "Saver";
  const miles = tier === "Saver" ? saver : roundTo(saver * (tier === "Flex" ? 1.5 : 2), 250);
  const taxes = govTaxes(input) + carrierSurcharge("EK", input.cabin, input.distanceMiles);
  return quote(
    miles,
    taxes,
    tier === "Saver" ? "chart" : "dynamic",
    `Skywards: Emirates-operated ${bandLabel(bi, BANDS)}, Classic ${tier} (high surcharges)`,
    tier === "Saver" ? "standard" : "peak",
  );
};
