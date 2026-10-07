/**
 * Avianca LifeMiles — Star Alliance partner zone chart (as published 2025), one-way.
 * No fuel surcharges on any carrier; taxes are low ($30–80 on most international awards).
 * Avianca-operated flights price dynamically around the chart level.
 *
 * Selected: North America ↔ Europe Y 30k / W 41k / J 63k / F 87k;
 * NA ↔ North Asia Y 35k / J 75k / F 90k; NA ↔ SE/South Asia Y 40k / J 78k / F 99k;
 * NA ↔ South America (south) Y 30k / J 60k; NA ↔ Oceania Y 42.5k / J 80k.
 */
import type { AwardRegion } from "@/lib/types";
import {
  allow,
  canBook,
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

const AV_METAL = new Set(["AV", "TA", "2K"]); // Avianca, TACA/Avianca El Salvador, Avianca Ecuador
/** Star Alliance + Iberia, Aeromexico. */
const BOOKABLE = allow(STAR, ["IB", "AM"]);

const SA_NORTH = new Set(["BOG", "MDE", "CLO", "CTG", "BAQ", "LIM", "CUZ", "UIO", "GYE", "CCS", "GEO"]);

type Z = "NA" | "HI" | "CC" | "SAN" | "SAS" | "EU" | "ME" | "AF" | "NASIA" | "SASIA" | "OCE";
function zoneOf(iata: string, region: AwardRegion): Z {
  if (MEXICO_AIRPORTS.has(iata)) return "CC";
  const m = macroOf(region);
  switch (m) {
    case "na":
      return "NA";
    case "hi":
      return "HI";
    case "cc":
      return "CC";
    case "sa":
      return SA_NORTH.has(iata) ? "SAN" : "SAS";
    case "eu":
      return "EU";
    case "me":
      return "ME";
    case "af":
      return "AF";
    case "nasia":
      return "NASIA";
    case "seasia":
    case "sasia":
      return "SASIA";
    case "oce":
      return "OCE";
  }
}

const CHART: Record<string, CabinRow> = {
  "NA|NA": row(7_500, null, 15_000, 25_000), // ≤ 1,500 mi; longer handled below
  "HI|NA": row(15_000, 22_500, 30_000, 45_000),
  "CC|NA": row(15_000, 20_000, 30_000, 45_000),
  "NA|SAN": row(20_000, 28_000, 36_000, 54_000),
  "NA|SAS": row(30_000, 40_000, 60_000, 85_000),
  "EU|NA": row(30_000, 41_000, 63_000, 87_000),
  "ME|NA": row(40_000, 55_000, 78_000, 100_000),
  "AF|NA": row(42_500, 58_000, 78_000, 100_000),
  "NA|NASIA": row(35_000, 50_000, 75_000, 90_000),
  "NA|SASIA": row(40_000, 55_000, 78_000, 99_000),
  "NA|OCE": row(42_500, 58_000, 80_000, 100_000),
  "EU|EU": row(10_000, null, 20_000, 30_000),
  "EU|ME": row(25_000, 35_000, 50_000, 70_000),
  "AF|EU": row(25_000, 35_000, 50_000, 70_000),
  "EU|NASIA": row(40_000, 55_000, 75_000, 100_000),
  "EU|SASIA": row(40_000, 55_000, 75_000, 100_000),
  "EU|SAN": row(35_000, 50_000, 70_000, 95_000),
  "EU|SAS": row(40_000, 55_000, 78_000, 100_000),
  "EU|OCE": row(55_000, 75_000, 100_000, 130_000),
  "NASIA|NASIA": row(15_000, 20_000, 25_000, 40_000),
  "NASIA|SASIA": row(15_000, 20_000, 25_000, 40_000),
  "SASIA|SASIA": row(15_000, 20_000, 25_000, 40_000),
  "NASIA|OCE": row(25_000, 35_000, 50_000, 70_000),
  "OCE|SASIA": row(25_000, 35_000, 50_000, 70_000),
  "ME|NASIA": row(25_000, 35_000, 50_000, 70_000),
  "ME|SASIA": row(25_000, 35_000, 50_000, 70_000),
  "AF|ME": row(20_000, 28_000, 40_000, 60_000),
  "CC|CC": row(10_000, null, 20_000, null),
  "CC|SAN": row(12_500, null, 25_000, null),
  "CC|SAS": row(20_000, null, 40_000, null),
  "SAN|SAN": row(8_000, null, 16_000, null),
  "SAN|SAS": row(15_000, null, 30_000, null),
  "SAS|SAS": row(10_000, null, 20_000, null),
  "HI|NASIA": row(30_000, 42_000, 60_000, 80_000),
  "HI|OCE": row(30_000, 42_000, 60_000, null),
};

export const aviancaLifeMiles: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const za = zoneOf(input.origin, input.originRegion);
  const zb = zoneOf(input.destination, input.destinationRegion);
  const chartRow = lookupPair(CHART, za, zb);
  if (!chartRow) return genericEstimate(input, { note: "LifeMiles: estimate (zone pair not published)" });
  let miles = chartRow[input.cabin];
  if (miles == null) return null;
  if (za === "NA" && zb === "NA" && input.distanceMiles > 1500) miles = input.cabin === "economy" ? 12_500 : input.cabin === "business" ? 25_000 : 35_000;

  const taxes = govTaxes(input); // no YQ, ever
  if (AV_METAL.has(carrier)) {
    const d = demandOf(input);
    return quote(roundTo(miles * (0.85 + d * 0.5), 100), taxes, "dynamic", `LifeMiles: ${za} ↔ ${zb}, Avianca-operated dynamic (chart ${miles.toLocaleString("en-US")})`, peakFromDemand(d));
  }
  return quote(miles, taxes, "chart", `LifeMiles: ${za} ↔ ${zb} Star Alliance chart (no surcharges)`);
};
