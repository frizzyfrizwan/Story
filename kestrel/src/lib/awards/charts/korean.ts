/**
 * Korean Air SKYPASS — zone chart for Korean-operated flights and the SkyTeam
 * partner chart (as published 2025; KE announced revisions for 2025 — verify
 * before relying on exact values), one-way.
 *
 * Korean-operated from Korea: North America Y 35k / W 52.5k / J 62.5k / F 80k;
 * Europe Y 40k / W 60k / J 80k / F 120k; Oceania Y 35k / J 62.5k; Hawaii Y 30k /
 * J 55k; Southeast Asia Y 20k / J 40k; Japan/China Y 15k / J 25k.
 * Peak-season dates (Korean holidays, late July–mid August, Christmas) cost 50 % more.
 */
import type { AwardRegion } from "@/lib/types";
import {
  allow,
  canBook,
  carrierSurcharge,
  govTaxes,
  inWindow,
  isAsia,
  lookupPair,
  macroOf,
  nearLunarNewYear,
  quote,
  row,
  SKYTEAM,
  ymd,
  type CabinRow,
  type ChartFn,
  type Macro,
  type PriceInput,
  type PriceQuote,
} from "./common";
import { genericEstimate } from "./generic";

const KE_METAL = new Set(["KE", "LJ"]);
/** SkyTeam + Emirates, Etihad, Hawaiian, Alaska, Jin Air. */
const BOOKABLE = allow(SKYTEAM, ["EK", "EY", "HA", "AS", "LJ"]);
const KOREA = new Set(["ICN", "GMP", "PUS", "CJU", "TAE"]);

/** Korean Air peak season (≈ +50 %): Lunar New Year, Chuseok (approx. late Sep/early Oct), summer, year-end. */
export function kePeak(date: string): boolean {
  const x = ymd(date);
  return nearLunarNewYear(x, 4) || inWindow(x.md, 715, 820) || inWindow(x.md, 1220, 103) || inWindow(x.md, 925, 1005);
}

function keZone(region: AwardRegion): { label: string; rowValues: CabinRow } | null {
  switch (macroOf(region)) {
    case "na":
      return { label: "Korea ↔ North America", rowValues: row(35_000, 52_500, 62_500, 80_000) };
    case "hi":
      return { label: "Korea ↔ Hawaii", rowValues: row(30_000, 45_000, 55_000, 70_000) };
    case "eu":
      return { label: "Korea ↔ Europe", rowValues: row(40_000, 60_000, 80_000, 120_000) };
    case "oce":
      return { label: "Korea ↔ Oceania", rowValues: row(35_000, 52_500, 62_500, 80_000) };
    case "seasia":
      return { label: "Korea ↔ Southeast Asia", rowValues: row(20_000, 30_000, 40_000, 55_000) };
    case "nasia":
      return { label: "Korea ↔ Japan / China", rowValues: row(15_000, 22_500, 25_000, 35_000) };
    case "sasia":
      return { label: "Korea ↔ South Asia", rowValues: row(25_000, 37_500, 45_000, 60_000) };
    case "me":
      return { label: "Korea ↔ Middle East", rowValues: row(30_000, 45_000, 55_000, 75_000) };
    default:
      return null;
  }
}

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

const PARTNER: Record<string, CabinRow> = {
  "NA|NA": row(12_500, 20_000, 25_000, 40_000),
  "HI|NA": row(17_500, 25_000, 35_000, null),
  "CC|NA": row(17_500, 25_000, 35_000, null),
  "NA|SA": row(35_000, 50_000, 70_000, null),
  "EU|NA": row(40_000, 60_000, 80_000, 120_000),
  "ASIA|NA": row(40_000, 60_000, 80_000, 120_000),
  "ME|NA": row(45_000, 65_000, 90_000, 130_000),
  "AF|NA": row(50_000, 70_000, 100_000, null),
  "NA|OCE": row(50_000, 70_000, 100_000, null),
  "EU|EU": row(12_500, 18_000, 25_000, null),
  "ASIA|EU": row(45_000, 65_000, 90_000, 130_000),
  "EU|ME": row(25_000, 35_000, 50_000, 75_000),
  "AF|EU": row(30_000, 42_000, 60_000, 90_000),
  "ASIA|ASIA": row(20_000, 30_000, 40_000, 55_000),
  "ASIA|OCE": row(35_000, 50_000, 70_000, null),
  "ASIA|ME": row(30_000, 45_000, 60_000, 90_000),
  "SA|SA": row(12_500, 18_000, 25_000, null),
  "CC|CC": row(12_500, 18_000, 25_000, null),
};

function priceKE(input: PriceInput): PriceQuote | null {
  const krOrigin = KOREA.has(input.origin);
  const krDest = KOREA.has(input.destination);
  if (krOrigin && krDest) {
    if (input.cabin !== "economy" && input.cabin !== "business") return null;
    return quote(input.cabin === "economy" ? 5_000 : 7_500, govTaxes(input), "chart", "SKYPASS: domestic Korea award");
  }
  if (!krOrigin && !krDest) return genericEstimate(input, { note: "SKYPASS: estimate (Korean-operated flights touch Korea)" });
  const zone = keZone(krOrigin ? input.destinationRegion : input.originRegion);
  if (!zone) return genericEstimate(input, { note: "SKYPASS: estimate" });
  const base = zone.rowValues[input.cabin];
  if (base == null) return null;
  const peak = kePeak(input.date);
  const miles = peak ? Math.round(base * 1.5) : base;
  const taxes = govTaxes(input) + carrierSurcharge("KE", input.cabin, input.distanceMiles);
  return quote(miles, taxes, "chart", `SKYPASS: ${zone.label}, ${peak ? "peak season (+50 %)" : "off-peak"}`, peak ? "peak" : "off-peak");
}

export const koreanAirSkypass: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  if (KE_METAL.has(carrier)) return priceKE(input);
  const za = zoneOf(macroOf(input.originRegion));
  const zb = zoneOf(macroOf(input.destinationRegion));
  const chartRow = lookupPair(PARTNER, za, zb);
  if (!chartRow) return genericEstimate(input, { note: "SKYPASS: partner estimate (zone pair not published)" });
  const miles = chartRow[input.cabin];
  if (miles == null) return null;
  const taxes = govTaxes(input) + carrierSurcharge(carrier, input.cabin, input.distanceMiles);
  return quote(miles, taxes, "chart", `SKYPASS: ${za} ↔ ${zb} SkyTeam partner chart`);
};
