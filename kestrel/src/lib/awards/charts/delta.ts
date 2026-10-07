/**
 * Delta SkyMiles — fully dynamic, no published chart. Ranges below are typical
 * observed 2025 one-way prices (saver floor → peak ceiling). Partner awards
 * (Air France, KLM, Virgin Atlantic, Korean, LATAM…) are also dynamic but
 * generally capped well below Delta-metal peaks.
 *
 * Delta adds no surcharges on its own metal; it passes Virgin Atlantic's
 * carrier surcharges and a moderate amount on Air France/KLM departures from Europe.
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
  SKYTEAM,
  type ChartFn,
  type Macro,
} from "./common";
import { genericEstimate } from "./generic";

const DL_METAL = new Set(["DL"]);
/** SkyTeam + LATAM, WestJet, Air Tahiti Nui, Hawaiian (interline), Riyadh Air (2026). */
const BOOKABLE = allow(SKYTEAM, ["LA", "WS", "TN", "HA", "RX"]);

type Zone = "NA" | "HI" | "CC" | "SA" | "EU" | "MEAF" | "ASIA" | "OCE";
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
    case "af":
      return "MEAF";
    case "oce":
      return "OCE";
  }
}

type Range = [number, number];
type RangeRow = Record<Cabin, Range | null>;
const r = (e: Range, p: Range, b: Range, f: Range | null): RangeRow => ({
  economy: e,
  premium: p,
  business: b,
  first: f,
});

const RANGES: Record<string, RangeRow> = {
  "NA|NA": r([5_000, 30_000], [8_000, 40_000], [15_000, 60_000], [25_000, 90_000]),
  "HI|NA": r([20_000, 45_000], [30_000, 70_000], [50_000, 100_000], null),
  "CC|NA": r([15_000, 40_000], [25_000, 60_000], [40_000, 90_000], null),
  "NA|SA": r([30_000, 70_000], [50_000, 100_000], [80_000, 200_000], null),
  "EU|NA": r([35_000, 80_000], [60_000, 120_000], [120_000, 350_000], null),
  "MEAF|NA": r([50_000, 100_000], [80_000, 150_000], [170_000, 400_000], null),
  "ASIA|NA": r([45_000, 100_000], [80_000, 150_000], [150_000, 400_000], null),
  "NA|OCE": r([50_000, 120_000], [90_000, 170_000], [150_000, 400_000], null),
  "EU|EU": r([12_000, 30_000], [18_000, 40_000], [30_000, 60_000], null),
  "EU|MEAF": r([25_000, 60_000], [40_000, 80_000], [70_000, 180_000], null),
  "ASIA|EU": r([40_000, 90_000], [70_000, 130_000], [120_000, 300_000], null),
  "EU|OCE": r([60_000, 130_000], [100_000, 180_000], [180_000, 400_000], null),
  "ASIA|ASIA": r([12_000, 35_000], [20_000, 50_000], [30_000, 90_000], null),
  "ASIA|OCE": r([30_000, 70_000], [50_000, 100_000], [80_000, 180_000], null),
  "ASIA|MEAF": r([35_000, 80_000], [55_000, 110_000], [100_000, 250_000], null),
  "CC|CC": r([10_000, 25_000], [15_000, 35_000], [25_000, 60_000], null),
  "SA|SA": r([10_000, 30_000], [15_000, 40_000], [25_000, 70_000], null),
  "CC|SA": r([20_000, 45_000], [30_000, 60_000], [50_000, 110_000], null),
  "HI|ASIA": r([40_000, 90_000], [70_000, 130_000], [120_000, 300_000], null),
  "HI|OCE": r([40_000, 90_000], [70_000, 130_000], [120_000, 300_000], null),
  "MEAF|MEAF": r([15_000, 40_000], [25_000, 60_000], [40_000, 100_000], null),
};

const YQ: Record<string, Partial<Record<Cabin, number>>> = {
  VS: { economy: 250, premium: 350, business: 450, first: 450 },
};
const EU_ORIGIN_AFKL_YQ: Partial<Record<Cabin, number>> = { economy: 90, premium: 120, business: 150, first: 150 };

export const deltaSkyMiles: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const za = zoneOf(macroOf(input.originRegion));
  const zb = zoneOf(macroOf(input.destinationRegion));
  const ranges = lookupPair(RANGES, za, zb);
  if (!ranges) return genericEstimate(input, { factor: 1.6, dynamic: 0.6, note: "SkyMiles: dynamic estimate" });
  const range = ranges[input.cabin];
  if (!range) {
    // Delta sells no international First; partner First (e.g. Korean Air) prices ≈ 35 % above Delta One.
    if (input.cabin === "first" && ranges.business) {
      const d = demandOf(input);
      return quote(
        roundTo(lerp(ranges.business[0], ranges.business[1], d) * 1.35, 1000),
        govTaxes(input),
        "estimate",
        "SkyMiles: no First cabin — estimated above Delta One",
        peakFromDemand(d),
      );
    }
    return null;
  }

  const d = demandOf(input);
  const [lo, hi] = range;
  const isDelta = DL_METAL.has(carrier);
  // Partner inventory rarely reaches Delta-metal peaks: cap partners at ≈ 55 % of the way up.
  const miles = isDelta ? lerp(lo, hi, d) : lerp(lo, lo + (hi - lo) * 0.55, d);

  let taxes = govTaxes(input) + (YQ[carrier]?.[input.cabin] ?? 0);
  if ((carrier === "AF" || carrier === "KL") && macroOf(input.originRegion) === "eu")
    taxes += EU_ORIGIN_AFKL_YQ[input.cabin] ?? 0;

  return quote(
    roundTo(miles, 500),
    taxes,
    "dynamic",
    `SkyMiles: ${za} ↔ ${zb} ${isDelta ? "Delta-operated" : "partner"} dynamic`,
    peakFromDemand(d),
  );
};
