/**
 * Air France-KLM Flying Blue — zone-based "from" pricing that varies by month
 * (as published 2025). The lowest price per zone pair is fixed but the level
 * offered on a given date moves with demand; Promo Rewards knock 25 % off
 * selected zones each month.
 *
 * Surcharges: medium on AF/KL metal (≈ $120–240 YQ long-haul, plus higher
 * French/Dutch departure taxes), none on Delta, high on Virgin Atlantic.
 * AF La Première is not bookable with miles by ordinary members → null.
 */
import type { AwardRegion, Cabin } from "@/lib/types";
import { hash32 } from "@/lib/utils";
import {
  allow,
  canBook,
  demandOf,
  govTaxes,
  isAsia,
  lerp,
  lookupPair,
  macroOf,
  pairKey,
  peakFromDemand,
  quote,
  roundTo,
  SKYTEAM,
  ymd,
  type ChartFn,
} from "./common";
import { genericEstimate } from "./generic";

const AFKL_METAL = new Set(["AF", "KL", "A5", "WA", "TO", "HV"]); // incl. HOP!, Cityhopper, Transavia
/** SkyTeam + Etihad, Qantas, WestJet, Japan Airlines, Air Mauritius, Air Tahiti Nui, GOL, Transavia, HOP!, Cityhopper. */
const BOOKABLE = allow(SKYTEAM, ["EY", "QF", "WS", "JL", "MK", "TN", "G3", "TO", "HV", "A5", "WA"]);

type Zone = "NA" | "CC" | "SA" | "EU" | "ME" | "AF" | "ASIA" | "OCE";
function zoneOf(r: AwardRegion): Zone {
  const m = macroOf(r);
  if (r === "north-africa") return "EU"; // Flying Blue: "Europe & North Africa"
  if (isAsia(m)) return "ASIA";
  switch (m) {
    case "na":
    case "hi":
      return "NA";
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

type Range = [number, number];
type RangeRow = Record<Cabin, Range | null>;
const r = (e: Range, p: Range | null, b: Range, f: Range | null = null): RangeRow => ({ economy: e, premium: p, business: b, first: f });

/** Lowest → typical-high one-way prices by zone pair. */
const ZONES: Record<string, RangeRow> = {
  "EU|NA": r([20_000, 35_000], [35_000, 55_000], [50_000, 75_000]),
  "EU|EU": r([7_500, 12_000], null, [16_000, 30_000]),
  "EU|ME": r([20_000, 30_000], [30_000, 45_000], [45_000, 70_000]),
  "AF|EU": r([25_000, 40_000], [40_000, 60_000], [60_000, 95_000]),
  "ASIA|EU": r([30_000, 45_000], [50_000, 75_000], [75_000, 110_000]),
  "EU|SA": r([35_000, 55_000], [55_000, 85_000], [85_000, 130_000]),
  "CC|EU": r([25_000, 40_000], [40_000, 60_000], [60_000, 90_000]),
  "EU|OCE": r([45_000, 70_000], [70_000, 110_000], [110_000, 150_000]),
  "NA|NA": r([8_500, 20_000], [15_000, 30_000], [20_000, 45_000]),
  "CC|NA": r([15_000, 30_000], [25_000, 45_000], [35_000, 60_000]),
  "NA|SA": r([30_000, 50_000], [45_000, 75_000], [75_000, 120_000]),
  "ME|NA": r([30_000, 50_000], [50_000, 75_000], [70_000, 110_000]),
  "AF|NA": r([35_000, 55_000], [55_000, 85_000], [85_000, 130_000]),
  "ASIA|NA": r([35_000, 55_000], [55_000, 85_000], [85_000, 120_000]),
  "NA|OCE": r([50_000, 80_000], [75_000, 120_000], [120_000, 170_000]),
  "ASIA|ASIA": r([12_000, 25_000], [20_000, 40_000], [30_000, 60_000]),
  "ASIA|OCE": r([25_000, 45_000], [40_000, 65_000], [60_000, 100_000]),
  "ASIA|ME": r([25_000, 40_000], [40_000, 60_000], [60_000, 90_000]),
  "AF|AF": r([12_000, 25_000], [20_000, 40_000], [30_000, 60_000]),
  "AF|ME": r([20_000, 30_000], [30_000, 45_000], [45_000, 70_000]),
  "ME|ME": r([10_000, 20_000], null, [25_000, 45_000]),
  "SA|SA": r([10_000, 25_000], null, [25_000, 50_000]),
  "CC|CC": r([10_000, 20_000], null, [25_000, 45_000]),
  "CC|SA": r([20_000, 35_000], null, [45_000, 80_000]),
};

const YQ_AFKL_LONG: Record<Cabin, number> = { economy: 120, premium: 160, business: 240, first: 240 };
const YQ_AFKL_SHORT: Record<Cabin, number> = { economy: 20, premium: 20, business: 35, first: 35 };
const YQ_PARTNER: Record<string, Partial<Record<Cabin, number>>> = {
  VS: { economy: 250, premium: 350, business: 450, first: 450 },
  KE: { economy: 40, premium: 60, business: 90, first: 120 },
  EY: { economy: 60, premium: 80, business: 120, first: 150 },
  QF: { economy: 80, premium: 120, business: 180, first: 220 },
};

/** Promo Rewards (−25 %): a deterministic quarter of zone-pair × month combos on AF/KL metal, Y/W/J only. */
function isPromo(za: Zone, zb: Zone, date: string, cabin: Cabin, metal: boolean): boolean {
  if (!metal || cabin === "first") return false;
  if (za !== "EU" && zb !== "EU") return false;
  const { y, m } = ymd(date);
  return hash32(`fb-promo:${pairKey(za, zb)}:${y}-${m}:${cabin}`) % 4 === 0;
}

export const flyingBlue: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const metal = AFKL_METAL.has(carrier);
  if (metal && input.cabin === "first") return null; // La Première: not available for standard award bookings

  const za = zoneOf(input.originRegion);
  const zb = zoneOf(input.destinationRegion);
  const ranges = lookupPair(ZONES, za, zb);
  if (!ranges) return genericEstimate(input, { dynamic: 0.4, note: "Flying Blue: estimate (zone pair not published)" });
  const range = ranges[input.cabin];
  if (!range) {
    // Partner First (e.g. Korean Air): roughly double the business level.
    if (input.cabin === "first" && ranges.business) {
      const d = demandOf(input);
      return quote(roundTo(lerp(ranges.business[0], ranges.business[1], d) * 2, 500), govTaxes(input) + (YQ_PARTNER[carrier]?.first ?? 0), "estimate", `Flying Blue: ${za} ↔ ${zb} partner First estimate`, peakFromDemand(d));
    }
    return null;
  }

  const d = demandOf(input);
  let miles = lerp(range[0], range[1], d);
  const promo = isPromo(za, zb, input.date, input.cabin, metal);
  if (promo) miles *= 0.75;
  miles = roundTo(miles, 500);

  let taxes = govTaxes(input);
  if (metal) taxes += (za === "EU" && zb === "EU" ? YQ_AFKL_SHORT : YQ_AFKL_LONG)[input.cabin];
  else taxes += YQ_PARTNER[carrier]?.[input.cabin] ?? 0;

  const note = `Flying Blue: ${za} ↔ ${zb} from ${range[0].toLocaleString("en-US")} (monthly variable${promo ? ", Promo Reward −25 %" : ""})`;
  return quote(miles, taxes, promo ? "chart" : "dynamic", note, peakFromDemand(d));
};
