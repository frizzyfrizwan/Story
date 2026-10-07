/**
 * ANA Mileage Club — international award chart (as published 2025).
 *
 * ANA international awards are ROUND-TRIP ONLY. ANA-operated flights price by
 * zone with three seasons (Low / Regular / High); partner (Star Alliance and
 * non-alliance) awards are zone-pair fixed. We return the round-trip
 * requirement for one-way inputs and say so in the note.
 *
 * ANA-operated, round trip, Low / Regular / High:
 *   Japan ↔ North America   Y 40/50/55k   W 62/72/77k   J 75/85/90k   F 150/165/180k
 *   Japan ↔ Europe          Y 45/55/60k   W 67/77/82k   J 80/90/95k   F 165/180/195k
 *   Japan ↔ Hawaii          Y 35/40/43k   W 58/63/68k   J 60/65/68k
 *   Japan ↔ Oceania         Y 37.5/45/50k W 55/62/67k   J 65/75/80k
 *   Japan ↔ Asia 2 (SE Asia / India)  Y 30/35/38k  W 45/50/53k  J 55/60/63k
 *   Japan ↔ Asia 1 (China/HK/Taiwan/Philippines) Y 17/20/23k  W 30/33/36k  J 35/40/43k
 *   Japan ↔ Korea           Y 12/15/18k   J 25/30/33k
 * Partner (round trip): North America ↔ Europe Y 55k / J 88k / F 165k, etc.
 */
import type { AwardRegion, Cabin } from "@/lib/types";
import {
  allow,
  canBook,
  carrierSurcharge,
  govTaxes,
  inWindow,
  isGoldenWeek,
  lookupPair,
  macroOf,
  quote,
  row,
  STAR,
  ymd,
  type CabinRow,
  type ChartFn,
  type PriceInput,
  type PriceQuote,
} from "./common";
import { genericEstimate } from "./generic";

const NH_METAL = new Set(["NH"]);
/** Star Alliance + Virgin Atlantic, Etihad, Garuda, Vietnam Airlines, Philippine Airlines. */
const BOOKABLE = allow(STAR, ["VS", "EY", "GA", "VN", "PR"]);

const JAPAN = new Set(["NRT", "HND", "KIX", "ITM", "NGO", "FUK", "CTS", "OKA", "HIJ", "SDJ"]);
const KOREA = new Set(["ICN", "GMP", "PUS", "CJU"]);
const ASIA1 = new Set(["PEK", "PKX", "PVG", "SHA", "CAN", "SZX", "HKG", "TPE", "TSA", "MNL", "CEB", "HGH", "TAO", "DLC", "XIY"]);

type Season = "low" | "regular" | "high";

/** Approximation of ANA's published seasonal calendar for Japan-based travel. */
export function anaSeason(date: string): Season {
  const x = ymd(date);
  if (isGoldenWeek(x) || inWindow(x.md, 718, 831) || inWindow(x.md, 1219, 107)) return "high";
  if (inWindow(x.md, 108, 228) || inWindow(x.md, 401, 426) || inWindow(x.md, 1101, 1218)) return "low";
  return "regular";
}

type SeasonRow = Record<Cabin, [number, number, number] | null>;
const s = (
  e: [number, number, number] | null,
  p: [number, number, number] | null,
  b: [number, number, number] | null,
  f: [number, number, number] | null,
): SeasonRow => ({ economy: e, premium: p, business: b, first: f });

/** ANA-operated: keyed by the non-Japan endpoint's zone. Round-trip values. */
const NH_ZONES: Record<string, { label: string; rowValues: SeasonRow }> = {
  korea: { label: "Japan ↔ Korea", rowValues: s([12_000, 15_000, 18_000], null, [25_000, 30_000, 33_000], null) },
  asia1: { label: "Japan ↔ Asia 1", rowValues: s([17_000, 20_000, 23_000], [30_000, 33_000, 36_000], [35_000, 40_000, 43_000], null) },
  asia2: { label: "Japan ↔ Asia 2 / India", rowValues: s([30_000, 35_000, 38_000], [45_000, 50_000, 53_000], [55_000, 60_000, 63_000], null) },
  hawaii: { label: "Japan ↔ Hawaii", rowValues: s([35_000, 40_000, 43_000], [58_000, 63_000, 68_000], [60_000, 65_000, 68_000], null) },
  na: { label: "Japan ↔ North America", rowValues: s([40_000, 50_000, 55_000], [62_000, 72_000, 77_000], [75_000, 85_000, 90_000], [150_000, 165_000, 180_000]) },
  eu: { label: "Japan ↔ Europe", rowValues: s([45_000, 55_000, 60_000], [67_000, 77_000, 82_000], [80_000, 90_000, 95_000], [165_000, 180_000, 195_000]) },
  oce: { label: "Japan ↔ Oceania", rowValues: s([37_500, 45_000, 50_000], [55_000, 62_000, 67_000], [65_000, 75_000, 80_000], null) },
  me: { label: "Japan ↔ Middle East", rowValues: s([45_000, 55_000, 60_000], [67_000, 77_000, 82_000], [80_000, 90_000, 95_000], null) },
};

function nhZone(iata: string, region: AwardRegion): string | null {
  if (KOREA.has(iata)) return "korea";
  if (ASIA1.has(iata)) return "asia1";
  const m = macroOf(region);
  switch (m) {
    case "nasia":
      return "asia1";
    case "seasia":
    case "sasia":
      return "asia2";
    case "hi":
      return "hawaii";
    case "na":
      return "na";
    case "eu":
      return "eu";
    case "oce":
      return "oce";
    case "me":
      return "me";
    default:
      return null;
  }
}

/** Partner awards, round trip, by zone pair (Zone 1 = Japan kept separate from the rest of Asia). */
type Z = "JP" | "NA" | "HI" | "CC" | "SA" | "EU" | "ME" | "AF" | "ASIA" | "OCE";
function partnerZone(iata: string, region: AwardRegion): Z {
  if (JAPAN.has(iata)) return "JP";
  const m = macroOf(region);
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
    default:
      return "ASIA";
  }
}

const PARTNER_RT: Record<string, CabinRow> = {
  "NA|NA": row(25_000, 35_000, 40_000, 60_000),
  "HI|NA": row(40_000, 55_000, 75_000, null),
  "CC|NA": row(35_000, 45_000, 55_000, null),
  "NA|SA": row(70_000, 90_000, 136_000, null),
  "EU|NA": row(55_000, 70_000, 88_000, 165_000),
  "JP|NA": row(55_000, 73_000, 90_000, 160_000),
  "ASIA|NA": row(65_000, 85_000, 105_000, 180_000),
  "ME|NA": row(70_000, 90_000, 115_000, 180_000),
  "AF|NA": row(75_000, 95_000, 125_000, 190_000),
  "NA|OCE": row(75_000, 95_000, 120_000, 180_000),
  "EU|EU": row(20_000, 28_000, 35_000, 50_000),
  "EU|JP": row(55_000, 73_000, 90_000, 165_000),
  "ASIA|EU": row(65_000, 85_000, 105_000, 180_000),
  "EU|ME": row(40_000, 52_000, 68_000, 100_000),
  "AF|EU": row(50_000, 65_000, 80_000, 120_000),
  "EU|SA": row(80_000, 100_000, 136_000, 200_000),
  "EU|OCE": row(90_000, 115_000, 150_000, 220_000),
  "ASIA|JP": row(33_000, 45_000, 60_000, 90_000),
  "ASIA|ASIA": row(25_000, 35_000, 45_000, 70_000),
  "JP|OCE": row(45_000, 60_000, 75_000, 110_000),
  "ASIA|OCE": row(45_000, 60_000, 75_000, 110_000),
  "JP|ME": row(50_000, 68_000, 90_000, 130_000),
  "ASIA|ME": row(45_000, 60_000, 80_000, 120_000),
  "HI|JP": row(40_000, 55_000, 65_000, null),
  "ASIA|HI": row(50_000, 65_000, 80_000, null),
  "AF|ASIA": row(55_000, 70_000, 95_000, 140_000),
  "AF|JP": row(60_000, 78_000, 100_000, 150_000),
};

const NH_YQ_RT: Record<Cabin, number> = { economy: 100, premium: 140, business: 200, first: 240 };

function priceNH(input: PriceInput): PriceQuote | null {
  const jpOrigin = JAPAN.has(input.origin);
  const jpDest = JAPAN.has(input.destination);
  if (jpOrigin && jpDest) {
    // Domestic Japan: one-way permitted, distance-tiered.
    const miles = input.distanceMiles <= 300 ? 5_000 : input.distanceMiles <= 600 ? 6_000 : 7_500;
    if (input.cabin !== "economy") return null;
    return quote(miles, govTaxes(input), "chart", "ANA: domestic Japan award (one-way, regular season)");
  }
  if (!jpOrigin && !jpDest) return genericEstimate(input, { note: "ANA: estimate (ANA-operated flights all touch Japan)" });
  const other = jpOrigin ? input.destination : input.origin;
  const otherRegion = jpOrigin ? input.destinationRegion : input.originRegion;
  const zoneKey = nhZone(other, otherRegion);
  const zone = zoneKey ? NH_ZONES[zoneKey] : undefined;
  if (!zone) return genericEstimate(input, { factor: 2, note: "ANA: round-trip estimate" });
  const seasons = zone.rowValues[input.cabin];
  if (!seasons) return null;
  const season = anaSeason(input.date);
  const miles = seasons[season === "low" ? 0 : season === "regular" ? 1 : 2];
  const taxes = govTaxes(input) * 2 + NH_YQ_RT[input.cabin];
  return quote(
    miles,
    taxes,
    "chart",
    `ANA: ${zone.label}, ${season} season — ROUND-TRIP award (ANA international awards are round-trip only)`,
    season === "high" ? "peak" : season === "low" ? "off-peak" : "standard",
  );
}

export const anaMileageClub: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  if (NH_METAL.has(carrier)) return priceNH(input);

  const za = partnerZone(input.origin, input.originRegion);
  const zb = partnerZone(input.destination, input.destinationRegion);
  const chartRow = lookupPair(PARTNER_RT, za, zb);
  if (!chartRow) return genericEstimate(input, { factor: 1.9, note: "ANA: partner round-trip estimate" });
  const miles = chartRow[input.cabin];
  if (miles == null) return null;
  // Round-trip taxes: both directions' government fees plus the partner's surcharges (ANA passes YQ).
  const taxes = govTaxes(input) * 2 + carrierSurcharge(carrier, input.cabin, input.distanceMiles) * 2;
  return quote(miles, taxes, "chart", `ANA: ${za} ↔ ${zb} partner award — ROUND-TRIP (one-way not bookable)`);
};
