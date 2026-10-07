/**
 * Singapore Airlines KrisFlyer — Saver award chart for SQ-operated flights and
 * the Star Alliance partner chart (as published 2025), one-way.
 *
 * SQ Saver from Singapore (selected): USA Y 44k / W 75k / J 99k (West Coast) –
 * 107k (East Coast) / Suites 150k via Frankfurt or Tokyo; Europe Y 38k / W 58k /
 * J 92k / F 142k; Japan & Korea Y 27k / W 42k / J 61k / F 95k; Australia East
 * Y 27k / W 44k / J 61k; Perth Y 19k / W 31k / J 42k; Middle East Y 24k / J 54k;
 * India Y 15k / W 25k / J 36k; short SE Asia from Y 6.5k / J 14k.
 * Advantage awards (when Saver space is gone) run ≈ 1.6× — modelled when demand is high.
 * SQ levies only a small surcharge on its own awards; LH-group partners carry YQ.
 */
import type { AwardRegion } from "@/lib/types";
import {
  allow,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  isAsia,
  lookupPair,
  macroOf,
  quote,
  roundTo,
  row,
  STAR,
  US_WEST_COAST,
  type CabinRow,
  type ChartFn,
  type Macro,
  type PriceInput,
  type PriceQuote,
} from "./common";
import { genericEstimate } from "./generic";

const SQ_METAL = new Set(["SQ", "MI", "TR"]);
/** Star Alliance + Virgin Atlantic, Virgin Australia, Alaska, Scoot. */
const BOOKABLE = allow(STAR, ["VS", "VA", "AS", "TR"]);

const SIN = "SIN";
const JAPAN_KOREA = new Set(["NRT", "HND", "KIX", "NGO", "FUK", "CTS", "ICN", "GMP", "PUS"]);
const PERTH = new Set(["PER"]);
const US_EAST_GATEWAYS = new Set(["JFK", "EWR", "IAD", "BOS", "ORD", "YYZ"]);

function sqZone(iata: string, region: AwardRegion, distance: number): { label: string; rowValues: CabinRow } {
  const m = macroOf(region);
  if (m === "na") {
    const east = US_EAST_GATEWAYS.has(iata) || !US_WEST_COAST.has(iata);
    return {
      label: east ? "Singapore ↔ USA East" : "Singapore ↔ USA West",
      rowValues: row(44_000, 75_000, east ? 107_000 : 99_000, 150_000),
    };
  }
  if (m === "hi") return { label: "Singapore ↔ Hawaii", rowValues: row(40_000, 65_000, 90_000, null) };
  if (m === "eu") return { label: "Singapore ↔ Europe", rowValues: row(38_000, 58_000, 92_000, 142_000) };
  if (m === "me") return { label: "Singapore ↔ Middle East", rowValues: row(24_000, 40_000, 54_000, 85_000) };
  if (m === "af") return { label: "Singapore ↔ Africa", rowValues: row(30_000, 48_000, 70_000, null) };
  if (m === "oce") {
    if (PERTH.has(iata)) return { label: "Singapore ↔ Perth", rowValues: row(19_000, 31_000, 42_000, null) };
    return { label: "Singapore ↔ Australia / NZ", rowValues: row(27_000, 44_000, 61_000, 95_000) };
  }
  if (m === "sasia") return { label: "Singapore ↔ India / Sri Lanka", rowValues: row(15_000, 25_000, 36_000, null) };
  if (m === "nasia") {
    if (JAPAN_KOREA.has(iata))
      return { label: "Singapore ↔ Japan / Korea", rowValues: row(27_000, 42_000, 61_000, 95_000) };
    return { label: "Singapore ↔ China / Hong Kong / Taiwan", rowValues: row(14_000, 24_000, 36_000, 60_000) };
  }
  // Southeast Asia, distance-tiered.
  if (distance <= 700)
    return { label: "Singapore ↔ Southeast Asia (short)", rowValues: row(6_500, null, 14_000, null) };
  return { label: "Singapore ↔ Southeast Asia", rowValues: row(10_000, 16_000, 22_000, null) };
}

/** SQ fifth-freedom sectors not touching Singapore (FRA–JFK, MAN–IAH, NRT–LAX…). */
const SQ_FIFTH: Record<string, CabinRow> = {
  "EU|NA": row(30_000, 45_000, 75_000, 110_000),
  "ASIA|NA": row(40_000, 60_000, 80_000, 125_000),
  "ASIA|EU": row(38_000, 58_000, 92_000, 142_000),
  "ASIA|ASIA": row(14_000, 24_000, 36_000, 60_000),
};

type Z = "NA" | "HI" | "CC" | "SA" | "EU" | "ME" | "AF" | "ASIA" | "OCE";
function zoneOf(m: Macro): Z {
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

/** Star Alliance partner chart (one-way). */
const PARTNER: Record<string, CabinRow> = {
  "NA|NA": row(12_500, 20_000, 32_500, 50_000),
  "HI|NA": row(22_500, 32_500, 42_500, null),
  "CC|NA": row(17_500, 25_000, 40_000, null),
  "NA|SA": row(35_000, 50_000, 75_000, 110_000),
  "EU|NA": row(38_000, 55_000, 82_500, 130_000),
  "ME|NA": row(45_000, 65_000, 95_000, 140_000),
  "AF|NA": row(50_000, 70_000, 105_000, 150_000),
  "ASIA|NA": row(47_500, 70_000, 105_000, 160_000),
  "NA|OCE": row(60_000, 85_000, 125_000, 180_000),
  "EU|EU": row(12_000, 18_000, 25_000, null),
  "ASIA|EU": row(40_000, 60_000, 90_000, 140_000),
  "EU|ME": row(22_000, 32_000, 45_000, 70_000),
  "AF|EU": row(28_000, 40_000, 55_000, 85_000),
  "EU|SA": row(45_000, 65_000, 95_000, null),
  "EU|OCE": row(65_000, 90_000, 135_000, null),
  "ASIA|ASIA": row(15_000, 22_000, 30_000, 45_000),
  "ASIA|OCE": row(30_000, 45_000, 60_000, 90_000),
  "ASIA|ME": row(30_000, 45_000, 60_000, 90_000),
  "AF|ASIA": row(35_000, 50_000, 70_000, 100_000),
  "ME|OCE": row(45_000, 65_000, 90_000, null),
  "AF|ME": row(22_000, 32_000, 45_000, 70_000),
  "SA|SA": row(10_000, 15_000, 20_000, null),
  "CC|CC": row(10_000, 15_000, 20_000, null),
};

function priceSQ(input: PriceInput): PriceQuote | null {
  const sinOrigin = input.origin === SIN;
  const sinDest = input.destination === SIN;
  let label: string;
  let rowValues: CabinRow | undefined;
  if (sinOrigin || sinDest) {
    const other = sinOrigin ? input.destination : input.origin;
    const otherRegion = sinOrigin ? input.destinationRegion : input.originRegion;
    ({ label, rowValues } = sqZone(other, otherRegion, input.distanceMiles));
  } else {
    const za = zoneOf(macroOf(input.originRegion));
    const zb = zoneOf(macroOf(input.destinationRegion));
    rowValues = lookupPair(SQ_FIFTH, za, zb);
    label = `${za} ↔ ${zb} (fifth-freedom sector)`;
    if (!rowValues) return genericEstimate(input, { note: "KrisFlyer: estimate (SQ sector not modelled)" });
  }
  const saver = rowValues[input.cabin];
  if (saver == null) return null;
  const d = demandOf(input);
  const advantage = d > 0.78;
  const miles = advantage ? roundTo(saver * 1.6, 500) : saver;
  const taxes = govTaxes(input) + carrierSurcharge("SQ", input.cabin, input.distanceMiles);
  return quote(
    miles,
    taxes,
    advantage ? "dynamic" : "chart",
    `KrisFlyer: ${label}, ${advantage ? "Advantage (Saver sold out)" : "Saver"}`,
    advantage ? "peak" : "standard",
  );
}

export const singaporeKrisFlyer: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  if (SQ_METAL.has(carrier)) return priceSQ(input);
  const za = zoneOf(macroOf(input.originRegion));
  const zb = zoneOf(macroOf(input.destinationRegion));
  const chartRow = lookupPair(PARTNER, za, zb);
  if (!chartRow) return genericEstimate(input, { note: "KrisFlyer: partner estimate (zone pair not published)" });
  const miles = chartRow[input.cabin];
  if (miles == null) return null;
  const taxes = govTaxes(input) + carrierSurcharge(carrier, input.cabin, input.distanceMiles);
  return quote(miles, taxes, "chart", `KrisFlyer: ${za} ↔ ${zb} Star Alliance partner chart`);
};
