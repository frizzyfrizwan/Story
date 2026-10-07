/**
 * Air Canada Aeroplan — Flight Reward Chart (as published 2025).
 *
 * Structure: four zones (North America, Atlantic, Pacific, South America) ×
 * distance bands × cabin. Partner awards are fixed; Air Canada-operated flights
 * price dynamically inside a published range (we model the range with demand).
 * Aeroplan levies no fuel surcharges on any carrier; partner bookings carry a
 * CAD 39 (≈ USD 29) partner booking fee.
 *
 * Zone definitions (Aeroplan): North America = Canada, US (incl. Hawaii/Alaska),
 * Mexico, Central America, Caribbean. Atlantic = Europe, Middle East, Africa,
 * India/South Asia (and Central Asia). Pacific = East/Southeast Asia, Oceania.
 */
import type { AwardRegion } from "@/lib/types";
import {
  allow,
  bandIndex,
  bandLabel,
  canBook,
  demandOf,
  genericPeak,
  govTaxes,
  lookupPair,
  quote,
  roundTo,
  row,
  STAR,
  type CabinRow,
  type ChartFn,
} from "./common";
import { genericEstimate } from "./generic";

const AC_METAL = new Set(["AC", "RV"]); // Air Canada + Rouge
/** Star Alliance + Aeroplan's non-alliance partners (Emirates, Etihad, Azul, GOL, Oman Air, Virgin Australia, Air Serbia…). */
const BOOKABLE = allow(STAR, ["EK", "EY", "AD", "G3", "WY", "VA", "JU", "GF", "MK"]);

type Zone = "NA" | "ATL" | "PAC" | "SA";
function zoneOf(r: AwardRegion): Zone {
  switch (r) {
    case "north-america":
    case "hawaii":
    case "central-america":
    case "caribbean":
      return "NA";
    case "south-america":
      return "SA";
    case "north-asia":
    case "southeast-asia":
    case "oceania":
      return "PAC";
    default:
      return "ATL"; // europe, middle-east, africa, south-asia, central-asia
  }
}

interface ZoneChart {
  label: string;
  bands: readonly number[]; // inclusive upper bounds in miles
  partner: readonly CabinRow[];
}

/** Partner (fixed) values, one-way, in points. */
const CHART: Record<string, ZoneChart> = {
  "NA|NA": {
    label: "Within North America",
    bands: [500, 1500, 2750],
    partner: [
      row(6_000, null, 15_000, 25_000),
      row(10_000, null, 20_000, 35_000),
      row(12_500, null, 25_000, 40_000),
      row(17_500, null, 35_000, 55_000),
    ],
  },
  "ATL|NA": {
    label: "North America ↔ Atlantic",
    bands: [4000, 6000, 8000],
    partner: [
      row(35_000, 45_000, 60_000, 70_000),
      row(40_000, 50_000, 70_000, 90_000),
      row(45_000, 55_000, 85_000, 110_000),
      row(60_000, 65_000, 100_000, 125_000),
    ],
  },
  "NA|PAC": {
    label: "North America ↔ Pacific",
    bands: [5000, 7500, 11_000],
    partner: [
      row(35_000, 45_000, 55_000, 80_000),
      row(45_000, 55_000, 75_000, 105_000),
      row(55_000, 65_000, 85_000, 120_000),
      row(65_000, 75_000, 100_000, 135_000),
    ],
  },
  "NA|SA": {
    label: "North America ↔ South America",
    bands: [2500, 5000],
    partner: [row(25_000, 30_000, 40_000, 55_000), row(30_000, 40_000, 50_000, 70_000), row(40_000, 50_000, 60_000, 80_000)],
  },
  "ATL|ATL": {
    label: "Within Atlantic",
    bands: [500, 1500, 3000, 5000],
    partner: [
      row(7_500, null, 15_000, 25_000),
      row(10_000, null, 20_000, 30_000),
      row(15_000, 20_000, 30_000, 45_000),
      row(25_000, 30_000, 45_000, 65_000),
      row(35_000, 40_000, 60_000, 90_000),
    ],
  },
  "PAC|PAC": {
    label: "Within Pacific",
    bands: [500, 1500, 3000, 5000],
    partner: [
      row(7_500, null, 15_000, 25_000),
      row(10_000, null, 20_000, 30_000),
      row(15_000, 20_000, 30_000, 45_000),
      row(25_000, 30_000, 45_000, 65_000),
      row(35_000, 40_000, 60_000, 90_000),
    ],
  },
  "ATL|PAC": {
    label: "Atlantic ↔ Pacific",
    bands: [5000, 7500, 11_000],
    partner: [
      row(35_000, 45_000, 60_000, 85_000),
      row(45_000, 55_000, 75_000, 105_000),
      row(55_000, 65_000, 90_000, 125_000),
      row(65_000, 75_000, 105_000, 140_000),
    ],
  },
  "ATL|SA": {
    label: "Atlantic ↔ South America",
    bands: [5000, 7500],
    partner: [row(35_000, 45_000, 65_000, 90_000), row(45_000, 55_000, 80_000, 110_000), row(55_000, 65_000, 95_000, 125_000)],
  },
  "PAC|SA": {
    label: "Pacific ↔ South America",
    bands: [7500, 11_000],
    partner: [row(45_000, 55_000, 85_000, 115_000), row(55_000, 65_000, 100_000, 135_000), row(65_000, 75_000, 115_000, 150_000)],
  },
  "SA|SA": {
    label: "Within South America",
    bands: [500, 1500, 3000],
    partner: [row(7_500, null, 15_000, null), row(10_000, null, 20_000, null), row(15_000, 20_000, 30_000, null), row(25_000, 30_000, 45_000, null)],
  },
};

const PARTNER_FEE_USD = 29; // CAD 39 partner booking fee

export const aeroplan: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const za = zoneOf(input.originRegion);
  const zb = zoneOf(input.destinationRegion);
  const chart = lookupPair(CHART, za, zb);
  if (!chart) return genericEstimate(input, { note: "Aeroplan: estimate (zone pair not published)" });

  const bi = bandIndex(input.distanceMiles, chart.bands);
  const base = chart.partner[bi][input.cabin];
  if (base == null) return null; // cabin not offered on this chart row
  const bandText = bandLabel(bi, chart.bands);

  if (AC_METAL.has(carrier)) {
    // Air Canada metal: dynamic within the published range — from ≈ 0.9× the
    // partner level at low demand up to ≈ 2.2× at peak.
    const d = demandOf(input);
    const miles = roundTo(base * (0.9 + d * 1.3), 100);
    return quote(miles, govTaxes(input), "dynamic", `Aeroplan: ${chart.label}, ${bandText} (Air Canada dynamic)`, genericPeak(input.date));
  }
  return quote(base, govTaxes(input) + PARTNER_FEE_USD, "chart", `Aeroplan: ${chart.label}, ${bandText} (partner, no surcharges)`, genericPeak(input.date));
};
