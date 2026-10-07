/**
 * Qantas Frequent Flyer — Classic Flight Rewards, distance-based (as published
 * 2025), one-way per segment. Ten zones. Qantas-operated examples:
 *   SYD–MEL (zone 1) Y 8,000 / J 18,400 · SYD–SIN (zone 5) J 57,000 ·
 *   SYD–LAX (zone 8) Y 41,900 / W 81,800 / J 108,400 / F 162,800 ·
 *   SYD–LHR (zone 10) Y 55,200 / J 144,600 / F 216,900.
 * Partner Classic Rewards (oneworld + Emirates, Air France, KLM, China Eastern,
 * Jetstar, Fiji, Vietnam, LATAM, WestJet, Air Tahiti Nui, Bangkok Airways, El Al)
 * use the same table with ≈ 10 % higher premium-cabin levels. Qantas passes
 * carrier charges (moderate on QF, high on Emirates).
 */
import {
  allow,
  bandIndex,
  bandLabel,
  canBook,
  carrierSurcharge,
  govTaxes,
  ONEWORLD,
  quote,
  roundTo,
  row,
  type CabinRow,
  type ChartFn,
} from "./common";

const QF_METAL = new Set(["QF", "JQ"]);
const BOOKABLE = allow(ONEWORLD, ["EK", "AF", "KL", "MU", "JQ", "FJ", "VN", "LA", "WS", "TN", "PG", "LY"]);

const BANDS: readonly number[] = [600, 1200, 2400, 3600, 4800, 5800, 7000, 8400, 9600];
const CLASSIC: readonly CabinRow[] = [
  row(8_000, 12_000, 18_400, 27_600),
  row(12_000, 18_000, 27_600, 41_400),
  row(18_000, 27_000, 41_500, 62_200),
  row(20_300, 30_500, 45_200, 68_400),
  row(25_200, 41_300, 57_000, 85_500),
  row(31_800, 51_300, 68_400, 102_600),
  row(37_700, 61_000, 82_000, 123_000),
  row(41_900, 81_800, 108_400, 162_800),
  row(45_000, 90_000, 112_500, 169_000),
  row(55_200, 101_000, 144_600, 216_900),
];

export const qantasFrequentFlyer: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  const bi = bandIndex(input.distanceMiles, BANDS);
  const base = CLASSIC[bi][input.cabin];
  if (base == null) return null;
  const own = QF_METAL.has(carrier);
  const premiumCabin = input.cabin === "business" || input.cabin === "first";
  const miles = own || !premiumCabin ? base : roundTo(base * 1.1, 100);
  const taxes = govTaxes(input) + carrierSurcharge(carrier, input.cabin, input.distanceMiles);
  return quote(miles, taxes, "chart", `Qantas: Classic Reward zone ${bi + 1} (${bandLabel(bi, BANDS)}), ${own ? "Qantas-operated" : `${carrier} partner`}`, "standard");
};
