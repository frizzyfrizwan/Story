/**
 * JAL Mileage Bank (as published 2025).
 *
 *  • JAL-operated international: zone chart from Japan, Standard level
 *    (one-way = half the published round trip): North America Y 25k / W 40k /
 *    J 50k / F 70k; Europe Y 27.5k / W 45k / J 55k / F 80k; Hawaii Y 20k / J 40k;
 *    Oceania Y 18k / J 40k; SE Asia Y 17.5k / J 36k; China/HK/Taiwan Y 10k / J 24k;
 *    Korea Y 7.5k / J 18k. "PLUS" dynamic pricing applies when Standard space is
 *    sold out (modelled at high demand, ≈ 1.5×).
 *  • Partner (oneworld + Emirates, Air France, Bangkok Airways, China Eastern,
 *    Hawaiian, Jetstar, Aeromexico): round-trip distance chart; one-way sold at half.
 *    Round-trip JFK–LHR (6,902 mi) business 80k → 40k one-way; LAX–NRT round trip
 *    10,900 mi business 110k → 55k one-way; HKG–JFK round trip 16,140 mi business 150k.
 */
import {
  allow,
  bandIndex,
  bandLabel,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  macroOf,
  ONEWORLD,
  quote,
  roundTo,
  row,
  type CabinRow,
  type ChartFn,
  type PriceInput,
  type PriceQuote,
} from "./common";
import { genericEstimate } from "./generic";

const JL_METAL = new Set(["JL", "NU", "JQ"]);
const BOOKABLE = allow(ONEWORLD, ["EK", "AF", "PG", "MU", "HA", "JQ", "AM", "NU"]);

const JAPAN = new Set(["NRT", "HND", "KIX", "ITM", "NGO", "FUK", "CTS", "OKA", "HIJ", "SDJ", "KOJ", "KMJ"]);
const KOREA = new Set(["ICN", "GMP", "PUS", "CJU"]);

function jlZone(iata: string, region: PriceInput["originRegion"]): { label: string; rowValues: CabinRow } | null {
  if (KOREA.has(iata)) return { label: "Japan ↔ Korea", rowValues: row(7_500, null, 18_000, null) };
  switch (macroOf(region)) {
    case "na":
      return { label: "Japan ↔ North America", rowValues: row(25_000, 40_000, 50_000, 70_000) };
    case "hi":
      return { label: "Japan ↔ Hawaii", rowValues: row(20_000, 32_500, 40_000, null) };
    case "eu":
      return { label: "Japan ↔ Europe", rowValues: row(27_500, 45_000, 55_000, 80_000) };
    case "oce":
      return { label: "Japan ↔ Oceania", rowValues: row(18_000, 30_000, 40_000, null) };
    case "nasia":
      return { label: "Japan ↔ China / Hong Kong / Taiwan", rowValues: row(10_000, null, 24_000, null) };
    case "seasia":
      return { label: "Japan ↔ Southeast Asia", rowValues: row(17_500, 25_000, 36_000, null) };
    case "sasia":
      return { label: "Japan ↔ India", rowValues: row(22_500, null, 50_000, null) };
    default:
      return null;
  }
}

/** Partner chart, one-way bands (half the published round-trip bands). */
const PARTNER_BANDS: readonly number[] = [
  500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 10_000, 12_500, 14_500, 17_000,
];
const PARTNER: readonly CabinRow[] = [
  row(6_000, 7_500, 9_000, 12_500),
  row(7_500, 10_000, 12_500, 17_500),
  row(10_000, 13_500, 17_500, 25_000),
  row(12_500, 17_500, 22_500, 32_500),
  row(15_000, 27_500, 40_000, 60_000),
  row(17_500, 31_000, 45_000, 67_500),
  row(22_500, 38_500, 55_000, 80_000),
  row(25_000, 43_500, 62_500, 90_000),
  row(30_000, 52_500, 75_000, 110_000),
  row(35_000, 60_000, 85_000, 125_000),
  row(37_500, 66_000, 95_000, 140_000),
  row(40_000, 72_500, 105_000, 150_000),
  row(45_000, 82_500, 120_000, 170_000),
];

function priceJL(input: PriceInput): PriceQuote | null {
  const jpOrigin = JAPAN.has(input.origin);
  const jpDest = JAPAN.has(input.destination);
  if (jpOrigin && jpDest) {
    if (input.cabin === "first" || input.cabin === "premium") return null;
    const miles =
      input.cabin === "economy"
        ? input.distanceMiles <= 400
          ? 6_000
          : 7_500
        : input.distanceMiles <= 400
          ? 10_000
          : 12_000;
    return quote(miles, govTaxes(input), "chart", "JAL Mileage Bank: domestic Japan award");
  }
  if (!jpOrigin && !jpDest)
    return genericEstimate(input, { note: "JAL Mileage Bank: estimate (JAL-operated flights touch Japan)" });
  const other = jpOrigin ? input.destination : input.origin;
  const zone = jlZone(other, jpOrigin ? input.destinationRegion : input.originRegion);
  if (!zone) return genericEstimate(input, { note: "JAL Mileage Bank: estimate" });
  const base = zone.rowValues[input.cabin];
  if (base == null) return null;
  const d = demandOf(input);
  const plus = d > 0.72;
  const miles = plus ? roundTo(base * 1.5, 500) : base;
  const taxes = govTaxes(input) + carrierSurcharge("JL", input.cabin, input.distanceMiles);
  return quote(
    miles,
    taxes,
    plus ? "dynamic" : "chart",
    `JAL Mileage Bank: ${zone.label}, ${plus ? "PLUS (Standard sold out)" : "Standard"}`,
    plus ? "peak" : "standard",
  );
}

export const jalMileageBank: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  if (JL_METAL.has(carrier)) return priceJL(input);
  const bi = bandIndex(input.distanceMiles, PARTNER_BANDS);
  const miles = PARTNER[bi][input.cabin];
  if (miles == null) return null;
  const taxes = govTaxes(input) + carrierSurcharge(carrier, input.cabin, input.distanceMiles);
  return quote(
    miles,
    taxes,
    "chart",
    `JAL Mileage Bank: ${carrier} partner distance chart, ${bandLabel(bi, PARTNER_BANDS)} (one-way = ½ round trip)`,
  );
};
