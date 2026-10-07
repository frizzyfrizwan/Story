/**
 * Turkish Airlines Miles&Smiles — region award chart (as published 2025), one-way.
 * Hawaii counts as "North America" (the famous 7.5k Y / 12.5k J on United).
 * Turkish passes partner fuel surcharges and levies its own on TK metal
 * (≈ $200–300 all-in from Istanbul in business).
 *
 * Selected one-way values: within North America Y 7.5k / J 12.5k;
 * NA ↔ Europe Y 30k / W 37.5k / J 45k / F 67.5k; NA ↔ Middle East J 52.5k;
 * NA ↔ Far East Y 45k / J 67.5k; intra-Europe Y 10k / J 15k.
 */
import type { AwardRegion } from "@/lib/types";
import {
  allow,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  lookupPair,
  macroOf,
  MEXICO_AIRPORTS,
  peakFromDemand,
  quote,
  roundTo,
  row,
  STAR,
  type CabinRow,
  type ChartFn,
} from "./common";
import { genericEstimate } from "./generic";

const TK_METAL = new Set(["TK", "AJ"]); // Turkish + AJet
const BOOKABLE = allow(STAR);

type Z = "NA" | "CC" | "SA" | "EU" | "ME" | "AF" | "SASIA" | "FE" | "OCE";
function zoneOf(iata: string, region: AwardRegion): Z {
  const m = macroOf(region);
  if (m === "na" || m === "hi" || MEXICO_AIRPORTS.has(iata)) return "NA";
  switch (m) {
    case "cc":
      return "CC";
    case "sa":
      return "SA";
    case "eu":
      return "EU";
    case "me":
      return "ME";
    case "af":
      return "AF";
    case "sasia":
      return "SASIA";
    case "nasia":
    case "seasia":
      return "FE";
    case "oce":
      return "OCE";
    default:
      return "NA";
  }
}

const CHART: Record<string, CabinRow> = {
  "NA|NA": row(7_500, null, 12_500, 20_000),
  "CC|NA": row(12_500, null, 20_000, 30_000),
  "NA|SA": row(30_000, null, 50_000, 70_000),
  "EU|NA": row(30_000, 37_500, 45_000, 67_500),
  "ME|NA": row(35_000, 42_500, 52_500, 75_000),
  "AF|NA": row(40_000, 50_000, 60_000, 85_000),
  "NA|SASIA": row(40_000, 50_000, 60_000, 85_000),
  "FE|NA": row(45_000, 55_000, 67_500, 90_000),
  "NA|OCE": row(50_000, 60_000, 75_000, 100_000),
  "EU|EU": row(10_000, null, 15_000, 25_000),
  "EU|ME": row(15_000, null, 25_000, 40_000),
  "AF|EU": row(20_000, null, 35_000, 50_000),
  "EU|SASIA": row(25_000, null, 40_000, 60_000),
  "EU|FE": row(30_000, 37_500, 45_000, 67_500),
  "EU|OCE": row(40_000, 50_000, 60_000, 85_000),
  "EU|SA": row(35_000, null, 55_000, 80_000),
  "ME|ME": row(10_000, null, 15_000, 25_000),
  "AF|ME": row(15_000, null, 25_000, 40_000),
  "ME|SASIA": row(15_000, null, 25_000, 40_000),
  "FE|ME": row(25_000, null, 40_000, 60_000),
  "ME|OCE": row(35_000, null, 55_000, 80_000),
  "FE|FE": row(15_000, null, 25_000, 40_000),
  "FE|SASIA": row(15_000, null, 25_000, 40_000),
  "SASIA|SASIA": row(10_000, null, 17_500, 30_000),
  "FE|OCE": row(25_000, null, 40_000, 60_000),
  "AF|AF": row(15_000, null, 25_000, 40_000),
  "AF|SASIA": row(20_000, null, 35_000, 50_000),
  "AF|FE": row(30_000, null, 45_000, 65_000),
  "SA|SA": row(10_000, null, 20_000, null),
  "CC|CC": row(10_000, null, 17_500, null),
  "CC|SA": row(15_000, null, 30_000, null),
};

export const turkishMilesSmiles: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const za = zoneOf(input.origin, input.originRegion);
  const zb = zoneOf(input.destination, input.destinationRegion);
  const chartRow = lookupPair(CHART, za, zb);
  if (!chartRow) return genericEstimate(input, { note: "Miles&Smiles: estimate (region pair not published)" });
  const base = chartRow[input.cabin];
  if (base == null) return null;
  const taxes = govTaxes(input) + carrierSurcharge(carrier, input.cabin, input.distanceMiles);
  if (TK_METAL.has(carrier)) {
    // TK metal since 2024: chart level is the floor, busy dates run up to ≈ 1.3×.
    const d = demandOf(input);
    const miles = roundTo(base * (1 + Math.max(0, d - 0.5) * 0.6), 500);
    return quote(miles, taxes, "dynamic", `Miles&Smiles: ${za} ↔ ${zb}, Turkish-operated (chart ${base.toLocaleString("en-US")}, variable)`, peakFromDemand(d));
  }
  return quote(base, taxes, "chart", `Miles&Smiles: ${za} ↔ ${zb} Star Alliance partner chart`);
};
