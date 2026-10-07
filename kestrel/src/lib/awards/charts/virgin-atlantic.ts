/**
 * Virgin Atlantic Flying Club (as published 2025).
 *
 *  • ANA partner chart — ROUND-TRIP ONLY. Japan ↔ US West Coast / Central / East:
 *    Business 45,000 / 47,500 / 50,000; First 72,500 / 85,000 / 85,000 (round trip).
 *    One-way ANA awards are not sold; we return the round-trip requirement and say so.
 *  • Delta partner chart — zone-based one-way (US domestic from 7,500; US–Europe
 *    Delta One 50,000; US–Asia Delta One 60,000).
 *  • Virgin Atlantic metal — 2025 variable pricing anchored on the legacy
 *    off-peak/peak zone chart from London (e.g. Upper Class to the US East Coast
 *    47,500 off-peak / 57,500 peak) with high carrier surcharges ex-UK.
 *  • Other SkyTeam/partner carriers — estimate.
 */
import type { Cabin } from "@/lib/types";
import {
  allow,
  canBook,
  demandOf,
  govTaxes,
  isAsia,
  lookupPair,
  macroOf,
  quote,
  roundTo,
  row,
  SKYTEAM,
  UK_AIRPORTS,
  ukSchoolPeak,
  US_CENTRAL,
  US_WEST_COAST,
  type CabinRow,
  type ChartFn,
  type PriceInput,
  type PriceQuote,
} from "./common";
import { genericEstimate } from "./generic";

/** SkyTeam + ANA, Singapore, Virgin Australia, South African. */
const BOOKABLE = allow(SKYTEAM, ["NH", "SQ", "VA", "SA"]);
const JAPAN = new Set(["NRT", "HND", "KIX", "ITM", "NGO", "FUK", "CTS", "OKA"]);

// ─── ANA (round-trip) ──────────────────────────────────────────

const ANA_RT: Record<"west" | "central" | "east", CabinRow> = {
  west: row(30_000, 37_500, 45_000, 72_500),
  central: row(32_500, 40_000, 47_500, 85_000),
  east: row(35_000, 42_500, 50_000, 85_000),
};

/** ANA ex-Japan to other zones (round trip, approximate Flying Club partner chart). */
const ANA_OTHER_RT: Record<string, CabinRow> = {
  eu: row(30_000, 45_000, 60_000, 90_000),
  nasia: row(15_000, null, 25_000, null),
  seasia: row(20_000, null, 35_000, null),
  sasia: row(25_000, null, 40_000, null),
  oce: row(25_000, null, 45_000, null),
  hi: row(20_000, 30_000, 35_000, null),
};

function priceANA(input: PriceInput): PriceQuote | null {
  const jpOrigin = JAPAN.has(input.origin);
  const jpDest = JAPAN.has(input.destination);
  if (!jpOrigin && !jpDest) return null;
  const other = jpOrigin ? input.destination : input.origin;
  const otherRegion = jpOrigin ? input.destinationRegion : input.originRegion;
  const m = macroOf(otherRegion);
  let chartRow: CabinRow | undefined;
  let zoneLabel: string;
  if (m === "na" || m === "hi") {
    const z = US_WEST_COAST.has(other) ? "west" : US_CENTRAL.has(other) ? "central" : "east";
    chartRow = ANA_RT[z];
    zoneLabel = `Japan ↔ US ${z === "west" ? "West Coast" : z === "central" ? "Central" : "East Coast"}`;
  } else {
    chartRow = ANA_OTHER_RT[m];
    zoneLabel = `Japan ↔ ${m}`;
  }
  if (!chartRow) return null;
  const miles = chartRow[input.cabin];
  if (miles == null) return null;
  // Taxes for the round trip: Japanese departure tax + US fees + ANA's modest surcharge.
  const taxes = govTaxes(input) * 2 + (input.cabin === "economy" ? 40 : 80);
  return quote(
    miles,
    taxes,
    "chart",
    `Virgin Atlantic × ANA: ${zoneLabel} — ROUND-TRIP award (one-way not available); shown value is the round-trip requirement`,
    ukSchoolPeak(input.date) ? "peak" : "off-peak",
  );
}

// ─── Delta (one-way) ───────────────────────────────────────────

const DELTA: Record<string, CabinRow> = {
  "NA|NA": row(7_500, 12_500, 17_500, 27_500), // short-haul; long-haul domestic handled below
  "HI|NA": row(15_000, 20_000, 30_000, null),
  "CC|NA": row(10_000, 15_000, 22_500, null),
  "NA|SA": row(22_500, 30_000, 50_000, null),
  "EU|NA": row(20_000, 30_000, 50_000, null),
  "ASIA|NA": row(30_000, 45_000, 60_000, null),
  "NA|OCE": row(40_000, 55_000, 80_000, null),
  "MEAF|NA": row(35_000, 50_000, 75_000, null),
};

function deltaZone(input: PriceInput, which: "origin" | "destination"): string {
  const m = macroOf(which === "origin" ? input.originRegion : input.destinationRegion);
  if (isAsia(m)) return "ASIA";
  if (m === "me" || m === "af") return "MEAF";
  return m.toUpperCase();
}

function priceDelta(input: PriceInput): PriceQuote | null {
  const za = deltaZone(input, "origin");
  const zb = deltaZone(input, "destination");
  const chartRow = lookupPair(DELTA, za, zb);
  if (!chartRow)
    return genericEstimate(input, { factor: 0.9, note: "Virgin Atlantic × Delta: estimate (zone pair not published)" });
  let miles = chartRow[input.cabin];
  if (miles == null) return null;
  if (za === "NA" && zb === "NA" && input.distanceMiles > 1500)
    miles =
      input.cabin === "economy"
        ? 12_500
        : input.cabin === "premium"
          ? 17_500
          : input.cabin === "business"
            ? 27_500
            : 40_000;
  return quote(miles, govTaxes(input), "chart", `Virgin Atlantic × Delta: ${za} ↔ ${zb} partner chart (no surcharges)`);
}

// ─── Virgin Atlantic metal ─────────────────────────────────────

interface VsZone {
  label: string;
  airports?: Set<string>;
  off: CabinRow;
  peak: CabinRow;
}

const VS_ZONES: VsZone[] = [
  {
    label: "UK ↔ US East Coast / Canada",
    airports: new Set(["JFK", "EWR", "BOS", "IAD", "ATL", "MIA", "MCO", "TPA", "YYZ", "YVR"]),
    off: row(10_000, 17_500, 47_500, null),
    peak: row(20_000, 27_500, 57_500, null),
  },
  {
    label: "UK ↔ US West Coast",
    airports: new Set(["LAX", "SFO", "LAS", "SEA", "SAN", "AUS"]),
    off: row(15_000, 25_000, 57_500, null),
    peak: row(25_000, 35_000, 67_500, null),
  },
  {
    label: "UK ↔ Caribbean",
    airports: new Set(["MBJ", "BGI", "ANU", "UVF", "GND", "HAV", "KIN", "PLS", "NAS"]),
    off: row(10_000, 17_500, 47_500, null),
    peak: row(20_000, 27_500, 57_500, null),
  },
  {
    label: "UK ↔ India",
    airports: new Set(["DEL", "BOM", "BLR"]),
    off: row(10_000, 17_500, 47_500, null),
    peak: row(20_000, 27_500, 57_500, null),
  },
  {
    label: "UK ↔ Africa / Middle East",
    airports: new Set(["JNB", "CPT", "LOS", "ACC", "DXB", "RUH", "TLV"]),
    off: row(12_500, 22_500, 57_500, null),
    peak: row(22_500, 32_500, 67_500, null),
  },
  {
    label: "UK ↔ Asia / Indian Ocean",
    airports: new Set(["PVG", "HKG", "MLE", "ICN", "NRT"]),
    off: row(12_500, 22_500, 57_500, null),
    peak: row(22_500, 32_500, 67_500, null),
  },
];

const VS_YQ_EX_UK: Record<Cabin, number> = { economy: 110, premium: 230, business: 450, first: 450 };
const VS_YQ_TO_UK: Record<Cabin, number> = { economy: 60, premium: 120, business: 200, first: 200 };

function priceVirgin(input: PriceInput): PriceQuote | null {
  const ukOrigin = UK_AIRPORTS.has(input.origin);
  const ukDest = UK_AIRPORTS.has(input.destination);
  if (!ukOrigin && !ukDest)
    return genericEstimate(input, {
      factor: 1.1,
      surcharge: { economy: 80, premium: 150, business: 250, first: 250 },
      note: "Virgin Atlantic: estimate (non-UK routing)",
    });
  const other = ukOrigin ? input.destination : input.origin;
  const zone = VS_ZONES.find((z) => z.airports?.has(other));
  const peak = ukSchoolPeak(input.date);
  const d = demandOf(input);
  let base: number | null;
  let label: string;
  if (zone) {
    base = (peak ? zone.peak : zone.off)[input.cabin];
    label = zone.label;
  } else {
    // Unlisted long-haul destination: use the East Coast row as the anchor.
    base = (peak ? VS_ZONES[0].peak : VS_ZONES[0].off)[input.cabin];
    label = "UK ↔ long-haul";
  }
  if (base == null) return null;
  // 2025 variable pricing: the legacy level is the floor; busy dates run ≈ 1.5×.
  const miles = roundTo(base * (1 + Math.max(0, d - 0.4) * 0.85), 500);
  const taxes = govTaxes(input) + (ukOrigin ? VS_YQ_EX_UK : VS_YQ_TO_UK)[input.cabin];
  return quote(
    miles,
    taxes,
    "dynamic",
    `Virgin Atlantic: ${label}, ${peak ? "peak" : "off-peak"} floor ${base.toLocaleString("en-US")} (variable)`,
    peak ? "peak" : "off-peak",
  );
}

// ─── Dispatcher ────────────────────────────────────────────────

const PARTNER_YQ: Record<string, Partial<Record<Cabin, number>>> = {
  AF: { economy: 100, premium: 140, business: 180, first: 180 },
  KL: { economy: 100, premium: 140, business: 180, first: 180 },
  KE: { economy: 40, premium: 60, business: 100, first: 140 },
  SA: { economy: 80, premium: 100, business: 150, first: 150 },
};

export const virginAtlanticFlyingClub: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  switch (carrier) {
    case "NH":
      return priceANA(input);
    case "DL":
      return priceDelta(input);
    case "VS":
      return priceVirgin(input);
    default:
      return genericEstimate(input, {
        factor: 1.05,
        surcharge: PARTNER_YQ[carrier],
        note: `Virgin Atlantic × ${carrier}: partner estimate`,
      });
  }
};
