/**
 * Avios programs — British Airways Club, Iberia Plus, Qatar Airways Privilege
 * Club, Finnair Plus and Aer Lingus AerClub (as published 2025).
 *
 * The common currency is priced per segment by great-circle distance. The
 * British Airways distance table (nine bands, off-peak / peak) is the reference
 * for partner-operated flights across all five programs; off-peak pricing applies
 * only to BA/Iberia/Aer Lingus metal — partner awards are always charged at peak.
 *
 *  BA table, one-way per segment (Avios):
 *   Band        Y off/peak      W off/peak       J off/peak         F off/peak
 *   1–650       4,000/4,500     —                7,750/9,000        —
 *   651–1,151   6,500/7,500     —                12,750/15,000      —
 *   1,152–2,000 8,500/10,000    17,000/20,000    17,000/20,000      25,500/30,000
 *   2,001–3,000 10,000/12,500   20,000/25,000    31,250/37,500      42,500/50,000
 *   3,001–4,000 13,000/20,000   26,000/40,000    50,000/60,000      68,000/80,000
 *   4,001–5,500 16,250/25,000   32,500/50,000    62,500/75,000      85,000/100,000
 *   5,501–6,500 19,500/30,000   39,000/60,000    75,000/90,000      102,000/120,000
 *   6,501–7,000 22,750/35,000   45,500/70,000    87,500/105,000     119,000/140,000
 *   7,001+      32,500/50,000   65,000/100,000   125,000/150,000    170,000/200,000
 *
 * Qatar prices its own metal off a separate (higher, no off-peak) distance table —
 * e.g. DOH–LHR (3,253 mi) Qsuite 70,000. Iberia and Aer Lingus price their own
 * long-haul off zone charts from Madrid / Dublin.
 */
import type { Cabin } from "@/lib/types";
import {
  allow,
  bandIndex,
  bandLabel,
  canBook,
  genericPeak,
  govTaxes,
  macroOf,
  ONEWORLD,
  quote,
  row,
  UK_AIRPORTS,
  ukSchoolPeak,
  US_WEST_COAST,
  type CabinRow,
  type ChartFn,
  type PriceInput,
  type PriceQuote,
} from "./common";

export const AVIOS_BANDS: readonly number[] = [650, 1151, 2000, 3000, 4000, 5500, 6500, 7000];

export const BA_OFF_PEAK: readonly CabinRow[] = [
  row(4_000, null, 7_750, null),
  row(6_500, null, 12_750, null),
  row(8_500, 17_000, 17_000, 25_500),
  row(10_000, 20_000, 31_250, 42_500),
  row(13_000, 26_000, 50_000, 68_000),
  row(16_250, 32_500, 62_500, 85_000),
  row(19_500, 39_000, 75_000, 102_000),
  row(22_750, 45_500, 87_500, 119_000),
  row(32_500, 65_000, 125_000, 170_000),
];

export const BA_PEAK: readonly CabinRow[] = [
  row(4_500, null, 9_000, null),
  row(7_500, null, 15_000, null),
  row(10_000, 20_000, 20_000, 30_000),
  row(12_500, 25_000, 37_500, 50_000),
  row(20_000, 40_000, 60_000, 80_000),
  row(25_000, 50_000, 75_000, 100_000),
  row(30_000, 60_000, 90_000, 120_000),
  row(35_000, 70_000, 105_000, 140_000),
  row(50_000, 100_000, 150_000, 200_000),
];

/** Qatar Airways-operated, Privilege Club Avios table (no off-peak; Qatar sells no premium economy). */
const QATAR_OWN: readonly CabinRow[] = [
  row(5_500, null, 15_750, null),
  row(8_500, null, 20_000, null),
  row(11_000, null, 27_000, 40_000),
  row(16_000, null, 42_000, 60_000),
  row(25_000, null, 70_000, 95_000),
  row(32_500, null, 85_000, 120_000),
  row(40_000, null, 100_000, 140_000),
  row(50_000, null, 115_000, 160_000),
  row(60_000, null, 130_000, 180_000),
];

/** Iberia Plus zone chart from Spain (Iberia-operated), off-peak / peak. */
const IBERIA_ZONES: { label: string; test: (iata: string, m: string) => boolean; off: CabinRow; peak: CabinRow }[] = [
  {
    label: "Spain ↔ US East / Canada",
    test: (iata, m) => m === "na" && !US_WEST_COAST.has(iata),
    off: row(17_000, 25_500, 34_000, null),
    peak: row(25_500, 34_000, 50_000, null),
  },
  {
    label: "Spain ↔ US West / Mexico",
    test: (iata, m) => m === "na" && US_WEST_COAST.has(iata),
    off: row(21_250, 32_000, 42_500, null),
    peak: row(32_000, 42_500, 62_500, null),
  },
  { label: "Spain ↔ Caribbean / Central America", test: (_, m) => m === "cc", off: row(21_250, 32_000, 42_500, null), peak: row(32_000, 42_500, 62_500, null) },
  { label: "Spain ↔ South America", test: (_, m) => m === "sa", off: row(21_250, 32_000, 42_500, null), peak: row(32_000, 42_500, 62_500, null) },
  { label: "Spain ↔ Middle East / Asia", test: (_, m) => m === "me" || m === "sasia" || m === "nasia" || m === "seasia", off: row(25_500, 38_000, 51_000, null), peak: row(38_000, 51_000, 75_000, null) },
  { label: "Spain ↔ Africa", test: (_, m) => m === "af", off: row(12_000, 18_000, 25_500, null), peak: row(18_000, 25_500, 38_000, null) },
];

/** Aer Lingus zone chart from Ireland (Aer Lingus-operated), off-peak / peak. */
const AER_LINGUS_ZONES: { label: string; test: (iata: string, m: string) => boolean; off: CabinRow; peak: CabinRow }[] = [
  { label: "Ireland ↔ US East / Canada", test: (iata, m) => m === "na" && !US_WEST_COAST.has(iata), off: row(13_000, null, 50_000, null), peak: row(20_000, null, 60_000, null) },
  { label: "Ireland ↔ US West", test: (iata, m) => m === "na" && US_WEST_COAST.has(iata), off: row(16_250, null, 62_500, null), peak: row(25_000, null, 75_000, null) },
];

const SPAIN = new Set(["MAD", "BCN", "AGP", "PMI", "VLC", "SVQ", "BIO", "ALC"]);
const IRELAND = new Set(["DUB", "SNN", "ORK"]);

/** Carrier-imposed surcharges by operating carrier, USD one-way: [short-haul, long-haul] per cabin. */
const YQ: Record<string, { short: Record<Cabin, number>; long: Record<Cabin, number> }> = {
  BA: { short: { economy: 25, premium: 25, business: 45, first: 45 }, long: { economy: 180, premium: 300, business: 420, first: 480 } },
  IB: { short: { economy: 10, premium: 10, business: 20, first: 20 }, long: { economy: 30, premium: 50, business: 70, first: 70 } },
  QR: { short: { economy: 20, premium: 20, business: 40, first: 40 }, long: { economy: 60, premium: 60, business: 90, first: 120 } },
  AY: { short: { economy: 15, premium: 15, business: 25, first: 25 }, long: { economy: 60, premium: 90, business: 130, first: 130 } },
  EI: { short: { economy: 10, premium: 10, business: 20, first: 20 }, long: { economy: 25, premium: 40, business: 100, first: 100 } },
  CX: { short: { economy: 15, premium: 15, business: 25, first: 25 }, long: { economy: 50, premium: 70, business: 110, first: 130 } },
  JL: { short: { economy: 15, premium: 15, business: 25, first: 25 }, long: { economy: 60, premium: 90, business: 140, first: 160 } },
  QF: { short: { economy: 20, premium: 20, business: 30, first: 30 }, long: { economy: 80, premium: 120, business: 180, first: 220 } },
  MH: { short: { economy: 15, premium: 15, business: 25, first: 25 }, long: { economy: 50, premium: 70, business: 110, first: 110 } },
};

function surcharge(carrier: string, input: PriceInput): number {
  const y = YQ[carrier];
  if (!y) return 0;
  return (input.distanceMiles > 2000 ? y.long : y.short)[input.cabin];
}

function programLabel(programId: string): string {
  switch (programId) {
    case "british-airways-club":
      return "British Airways Club";
    case "iberia-plus":
      return "Iberia Plus";
    case "qatar-privilege-club":
      return "Qatar Privilege Club";
    case "finnair-plus":
      return "Finnair Plus";
    case "aer-lingus-aerclub":
      return "Aer Lingus AerClub";
    default:
      return "Avios";
  }
}

/** Price off the BA distance table. `offPeakEligible` → off-peak dates use the lower column. */
function baTable(input: PriceInput, offPeakEligible: boolean, carrierLabel: string): PriceQuote | null {
  const bi = bandIndex(input.distanceMiles, AVIOS_BANDS);
  const peak = offPeakEligible ? ukSchoolPeak(input.date) : true;
  const table = peak ? BA_PEAK : BA_OFF_PEAK;
  const miles = table[bi][input.cabin];
  if (miles == null) return null;
  const taxes = govTaxes(input) + surcharge(input.carrier.toUpperCase(), input);
  const note = `${programLabel(input.programId)}: ${carrierLabel}, ${bandLabel(bi, AVIOS_BANDS)}, ${offPeakEligible ? (peak ? "peak" : "off-peak") : "partner (peak pricing)"}`;
  return quote(miles, taxes, "chart", note, offPeakEligible ? (peak ? "peak" : "off-peak") : "standard");
}

function zoneChart(
  input: PriceInput,
  zones: typeof IBERIA_ZONES,
  home: Set<string>,
  carrier: string,
): PriceQuote | null | undefined {
  const homeOrigin = home.has(input.origin);
  const homeDest = home.has(input.destination);
  if (!homeOrigin && !homeDest) return undefined; // not a home-market long-haul: caller falls back to the distance table
  const other = homeOrigin ? input.destination : input.origin;
  const m = macroOf(homeOrigin ? input.destinationRegion : input.originRegion);
  const zone = zones.find((z) => z.test(other, m));
  if (!zone) return undefined;
  const peak = genericPeak(input.date) === "peak";
  const miles = (peak ? zone.peak : zone.off)[input.cabin];
  if (miles == null) return null;
  const taxes = govTaxes(input) + surcharge(carrier, input);
  return quote(miles, taxes, "chart", `${programLabel(input.programId)}: ${zone.label}, ${peak ? "peak" : "off-peak"}`, peak ? "peak" : "off-peak");
}

// ─── British Airways Club ──────────────────────────────────────

/** oneworld + Aer Lingus, Vueling, LEVEL, China Southern, LATAM (legacy partner). */
const BA_BOOKABLE = allow(ONEWORLD, ["EI", "VY", "LV", "CZ", "LA"]);
const OFF_PEAK_METAL = new Set(["BA", "IB", "EI", "VY", "LV"]);

export const britishAirwaysClub: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BA_BOOKABLE)) return null;
  const own = OFF_PEAK_METAL.has(carrier);
  const q = baTable(input, own, own ? `${carrier}-operated` : `${carrier} partner`);
  if (q && carrier === "BA" && (UK_AIRPORTS.has(input.origin) || UK_AIRPORTS.has(input.destination)) && input.distanceMiles > 2000) {
    q.note = `${q.note} — high BA surcharges`;
  }
  return q;
};

// ─── Iberia Plus ───────────────────────────────────────────────

const IB_BOOKABLE = allow(ONEWORLD, ["EI", "VY", "LV", "AV", "I2"]);

export const iberiaPlus: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, IB_BOOKABLE)) return null;
  if (carrier === "IB" || carrier === "I2" || carrier === "LV") {
    const z = zoneChart(input, IBERIA_ZONES, SPAIN, carrier);
    if (z !== undefined) return z;
    return baTable(input, true, "Iberia-operated short/medium-haul");
  }
  return baTable(input, OFF_PEAK_METAL.has(carrier), `${carrier} partner`);
};

// ─── Qatar Airways Privilege Club ──────────────────────────────

const QR_BOOKABLE = allow(ONEWORLD, ["ME", "WB", "VA", "6E", "JU"]);

export const qatarPrivilegeClub: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, QR_BOOKABLE)) return null;
  if (carrier === "QR") {
    const bi = bandIndex(input.distanceMiles, AVIOS_BANDS);
    const miles = QATAR_OWN[bi][input.cabin];
    if (miles == null) return null;
    return quote(miles, govTaxes(input) + surcharge("QR", input), "chart", `Qatar Privilege Club: Qatar-operated, ${bandLabel(bi, AVIOS_BANDS)}`, "standard");
  }
  return baTable(input, false, `${carrier} partner`);
};

// ─── Finnair Plus ──────────────────────────────────────────────

const AY_BOOKABLE = allow(ONEWORLD, ["EI", "HO"]);

export const finnairPlus: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, AY_BOOKABLE)) return null;
  // Finnair prices its own metal off the Avios distance table with Finnish holiday peaks.
  return baTable(input, carrier === "AY", carrier === "AY" ? "Finnair-operated" : `${carrier} partner`);
};

// ─── Aer Lingus AerClub ────────────────────────────────────────

const EI_BOOKABLE = allow(ONEWORLD, ["EI", "VY", "LV"]);

export const aerLingusAerClub: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, EI_BOOKABLE)) return null;
  if (carrier === "EI") {
    const z = zoneChart(input, AER_LINGUS_ZONES, IRELAND, "EI");
    if (z !== undefined) return z;
    return baTable(input, true, "Aer Lingus-operated short-haul");
  }
  return baTable(input, OFF_PEAK_METAL.has(carrier), `${carrier} partner`);
};
