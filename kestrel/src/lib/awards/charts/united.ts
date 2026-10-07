/**
 * United MileagePlus — dynamic pricing (no published chart since 2019).
 * We model "saver-level" partner pricing by region pair as published/observed
 * 2025 (partner saver prices are effectively fixed) and let United-operated
 * flights float far above saver with demand.
 *
 * United adds no fuel surcharges on any award.
 */
import type { Cabin } from "@/lib/types";
import {
  allow,
  canBook,
  demandOf,
  govTaxes,
  isAsia,
  lerp,
  lookupPair,
  macroOf,
  peakFromDemand,
  quote,
  roundTo,
  STAR,
  type ChartFn,
  type Macro,
} from "./common";
import { genericEstimate } from "./generic";

const UA_METAL = new Set(["UA"]);
/** Star Alliance plus United's non-alliance partners: Aer Lingus, Hawaiian, Azul, Virgin Australia, Edelweiss, Eurowings, Vistara (legacy). */
const BOOKABLE = allow(STAR, ["EI", "HA", "AD", "VA", "WK", "EW"]);

type Zone = "NA" | "HI" | "CC" | "SA" | "EU" | "ME" | "AF" | "ASIA" | "OCE";
function zoneOf(m: Macro): Zone {
  if (isAsia(m)) return "ASIA";
  switch (m) {
    case "na":
      return "NA";
    case "hi":
      return "HI";
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
    case "oce":
      return "OCE";
  }
}

/** [low, high] saver-level ranges by cabin, one-way (partner metal). */
type Range = [number, number];
type RangeRow = Record<Cabin, Range | null>;
const r = (e: Range, p: Range | null, b: Range, f: Range | null): RangeRow => ({
  economy: e,
  premium: p,
  business: b,
  first: f,
});

const SAVER: Record<string, RangeRow> = {
  "NA|NA": r([6_500, 30_000], [12_000, 40_000], [12_500, 50_000], [25_000, 70_000]),
  "HI|NA": r([22_500, 45_000], [35_000, 60_000], [40_000, 80_000], null),
  "CC|NA": r([17_500, 35_000], [25_000, 45_000], [35_000, 60_000], null),
  "NA|SA": r([30_000, 45_000], [45_000, 60_000], [60_000, 77_000], [100_000, 120_000]),
  "EU|NA": r([30_000, 40_000], [55_000, 70_000], [70_000, 88_000], [110_000, 121_000]),
  "ME|NA": r([44_000, 60_000], [60_000, 80_000], [88_000, 110_000], [121_000, 150_000]),
  "AF|NA": r([44_000, 60_000], [60_000, 80_000], [88_000, 120_000], [150_000, 170_000]),
  "ASIA|NA": r([38_500, 50_000], [60_000, 80_000], [88_000, 110_000], [121_000, 165_000]),
  "NA|OCE": r([40_000, 55_000], [60_000, 85_000], [88_000, 110_000], [130_000, 160_000]),
  "EU|EU": r([8_500, 12_500], [15_000, 20_000], [17_500, 25_000], null),
  "EU|ME": r([20_000, 30_000], [30_000, 40_000], [45_000, 55_000], [70_000, 90_000]),
  "AF|EU": r([25_000, 35_000], [35_000, 45_000], [50_000, 65_000], [80_000, 100_000]),
  "ASIA|EU": r([38_000, 44_000], [55_000, 70_000], [77_000, 88_000], [110_000, 140_000]),
  "EU|OCE": r([50_000, 60_000], [70_000, 90_000], [100_000, 125_000], [150_000, 180_000]),
  "ASIA|ASIA": r([11_000, 20_000], [20_000, 35_000], [20_000, 40_000], [40_000, 60_000]),
  "ASIA|OCE": r([25_000, 35_000], [40_000, 55_000], [50_000, 70_000], [80_000, 100_000]),
  "ASIA|ME": r([30_000, 40_000], [45_000, 60_000], [60_000, 77_000], [90_000, 120_000]),
  "HI|ASIA": r([35_000, 45_000], [55_000, 70_000], [70_000, 90_000], [100_000, 130_000]),
  "HI|OCE": r([35_000, 45_000], [55_000, 70_000], [70_000, 90_000], null),
  "CC|CC": r([10_000, 17_500], [15_000, 25_000], [20_000, 35_000], null),
  "CC|SA": r([20_000, 30_000], [30_000, 40_000], [40_000, 55_000], null),
  "SA|SA": r([10_000, 20_000], [15_000, 30_000], [20_000, 40_000], null),
  "AF|ME": r([20_000, 30_000], [30_000, 40_000], [40_000, 55_000], [60_000, 80_000]),
  "AF|AF": r([12_000, 20_000], [18_000, 30_000], [25_000, 40_000], null),
};

export const unitedMileagePlus: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const za = zoneOf(macroOf(input.originRegion));
  const zb = zoneOf(macroOf(input.destinationRegion));
  const rowRanges = lookupPair(SAVER, za, zb);
  if (!rowRanges)
    return genericEstimate(input, { dynamic: 0.5, note: "United: dynamic estimate (region pair not modelled)" });
  const range = rowRanges[input.cabin];
  if (!range) return null;

  const d = demandOf(input);
  const [lo, hi] = range;
  let miles: number;
  if (UA_METAL.has(carrier)) {
    // United metal: saver floor at low demand, surging to ≈ 1.6× the partner ceiling when full.
    miles = lerp(lo, hi * 1.6, d);
  } else {
    // Partner saver inventory: mostly the published level; a demand nudge toward the ceiling.
    miles = lerp(lo, hi, d);
  }
  return quote(
    roundTo(miles, 100),
    govTaxes(input),
    "dynamic",
    `United: ${za} ↔ ${zb} ${UA_METAL.has(carrier) ? "United-operated dynamic" : "partner saver"} (no surcharges)`,
    peakFromDemand(d),
  );
};
