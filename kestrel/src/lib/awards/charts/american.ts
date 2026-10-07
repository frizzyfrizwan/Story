/**
 * American AAdvantage — partner award chart (MileSAAver, as published 2025) for
 * partner-operated flights; American-operated flights price dynamically
 * ("web special" floors up to AAnytime levels).
 *
 * AA passes British Airways' carrier-imposed surcharges (and a smaller amount on
 * Iberia); other partners carry government taxes only.
 */
import type { Cabin } from "@/lib/types";
import {
  allow,
  canBook,
  demandOf,
  govTaxes,
  lerp,
  lookupPair,
  macroOf,
  ONEWORLD,
  peakFromDemand,
  quote,
  roundTo,
  row,
  type CabinRow,
  type ChartFn,
  type Macro,
} from "./common";
import { genericEstimate } from "./generic";

const AA_METAL = new Set(["AA"]);
/** oneworld + Etihad, GOL, China Southern, Air Tahiti Nui, Cape Air, IndiGo codeshares (2025). */
const BOOKABLE = allow(ONEWORLD, ["EY", "G3", "CZ", "TN", "9K", "6E"]);

/** AA "South America Region 1" (Colombia, Ecuador, Peru, Venezuela, Guyana…). */
const SA_REGION_1 = new Set(["BOG", "MDE", "CLO", "CTG", "BAQ", "LIM", "CUZ", "UIO", "GYE", "CCS", "GEO", "PBM"]);
/** AA "Asia Region 1" = Japan & Korea; the rest of Asia is Region 2. */
const ASIA_1_AIRPORTS = new Set(["NRT", "HND", "KIX", "ITM", "NGO", "FUK", "CTS", "OKA", "ICN", "GMP", "PUS"]);

type Zone = "NA" | "HI" | "CC" | "SA1" | "SA2" | "EU" | "ME" | "AF" | "ASIA1" | "ASIA2" | "OCE";

function zoneOf(m: Macro, iata: string): Zone {
  switch (m) {
    case "na":
      return "NA";
    case "hi":
      return "HI";
    case "cc":
      return "CC";
    case "sa":
      return SA_REGION_1.has(iata) ? "SA1" : "SA2";
    case "eu":
      return "EU";
    case "me":
    case "sasia":
      return "ME"; // "Middle East / Indian Subcontinent"
    case "af":
      return "AF";
    case "nasia":
      return ASIA_1_AIRPORTS.has(iata) ? "ASIA1" : "ASIA2";
    case "seasia":
      return "ASIA2";
    case "oce":
      return "OCE";
  }
}

/** Partner MileSAAver, one-way. */
const CHART: Record<string, CabinRow> = {
  "NA|NA": row(12_500, 20_000, 25_000, 50_000),
  "HI|NA": row(22_500, 30_000, 40_000, 40_000),
  "CC|NA": row(15_000, 22_500, 30_000, 30_000),
  "NA|SA1": row(20_000, 25_000, 30_000, 30_000),
  "NA|SA2": row(30_000, 40_000, 57_500, 85_000),
  "EU|NA": row(30_000, 40_000, 57_500, 85_000),
  "ME|NA": row(40_000, 50_000, 70_000, 115_000),
  "AF|NA": row(40_000, 50_000, 75_000, 120_000),
  "ASIA1|NA": row(35_000, 45_000, 60_000, 80_000),
  "ASIA2|NA": row(35_000, 45_000, 70_000, 110_000),
  "NA|OCE": row(40_000, 50_000, 80_000, 110_000),
  "EU|EU": row(10_000, null, 20_000, null),
  "EU|ME": row(20_000, 30_000, 42_500, 62_500),
  "AF|EU": row(22_500, 30_000, 50_000, 75_000),
  "ASIA1|EU": row(35_000, 45_000, 70_000, 100_000),
  "ASIA2|EU": row(35_000, 45_000, 70_000, 100_000),
  "EU|OCE": row(45_000, 60_000, 90_000, 125_000),
  "ASIA1|ASIA1": row(10_000, null, 20_000, null),
  "ASIA1|ASIA2": row(15_000, 20_000, 25_000, 40_000),
  "ASIA2|ASIA2": row(15_000, 20_000, 25_000, 40_000),
  "ASIA2|ME": row(25_000, 35_000, 50_000, 75_000),
  "ASIA1|ME": row(30_000, 40_000, 60_000, 90_000),
  "ASIA2|OCE": row(25_000, 35_000, 50_000, 75_000),
  "ASIA1|OCE": row(30_000, 40_000, 60_000, 90_000),
  "ME|ME": row(10_000, null, 20_000, 30_000),
  "AF|ME": row(20_000, 30_000, 40_000, 60_000),
  "AF|AF": row(12_500, null, 25_000, null),
  "ME|OCE": row(40_000, 50_000, 75_000, 110_000),
  "CC|CC": row(10_000, null, 20_000, null),
  "CC|SA1": row(15_000, null, 25_000, null),
  "CC|SA2": row(25_000, 30_000, 45_000, null),
  "SA1|SA1": row(10_000, null, 20_000, null),
  "SA1|SA2": row(15_000, 20_000, 30_000, null),
  "SA2|SA2": row(12_500, 20_000, 25_000, null),
  "HI|ASIA1": row(30_000, 40_000, 55_000, 75_000),
  "HI|ASIA2": row(30_000, 40_000, 60_000, 90_000),
  "HI|OCE": row(35_000, 45_000, 60_000, null),
};

/** Carrier-imposed surcharges AA passes through, USD one-way by cabin. */
const YQ: Record<string, Partial<Record<Cabin, number>>> = {
  BA: { economy: 200, premium: 330, business: 450, first: 550 },
  IB: { economy: 40, premium: 60, business: 90, first: 90 },
};

export const americanAAdvantage: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const za = zoneOf(macroOf(input.originRegion), input.origin);
  const zb = zoneOf(macroOf(input.destinationRegion), input.destination);
  const chart = lookupPair(CHART, za, zb);
  if (!chart) return genericEstimate(input, { note: "AAdvantage: estimate (region pair not published)" });
  const saver = chart[input.cabin];
  if (saver == null) return null;

  const taxes = govTaxes(input) + (YQ[carrier]?.[input.cabin] ?? 0);

  if (AA_METAL.has(carrier)) {
    // AA metal: web-special floors (~0.6× saver) at low demand up to AAnytime levels (~3× saver).
    const d = demandOf(input);
    const miles = roundTo(lerp(saver * 0.6, saver * 3, d), 500);
    return quote(miles, taxes, "dynamic", `AAdvantage: ${za} ↔ ${zb}, American-operated dynamic (saver ${saver.toLocaleString("en-US")})`, peakFromDemand(d));
  }
  return quote(saver, taxes, "chart", `AAdvantage: ${za} ↔ ${zb} partner MileSAAver${carrier === "BA" ? " (BA surcharges apply)" : ""}`);
};
