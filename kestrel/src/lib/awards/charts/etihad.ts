/**
 * Etihad Guest — dynamic pricing on Etihad-operated flights since 2023 (no
 * published chart). Ranges below are typical 2025 one-way levels from Abu Dhabi.
 * Partner awards (American, Air Canada, Air Serbia, Malaysia, Korean, SAS, Air
 * France-KLM, Virgin Australia, Royal Air Maroc, Garuda, Philippine, Gulf Air…)
 * are zone-priced; modelled as an estimate.
 */
import type { Cabin } from "@/lib/types";
import {
  allow,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  isAsia,
  lerp,
  macroOf,
  peakFromDemand,
  quote,
  roundTo,
  type ChartFn,
} from "./common";
import { genericEstimate } from "./generic";

const EY_METAL = new Set(["EY"]);
const BOOKABLE = allow(["EY", "AA", "AC", "JU", "HM", "AT", "GA", "KE", "MH", "SK", "AF", "KL", "PR", "WY", "VA", "SN", "PG", "GF", "HU", "VN", "AI", "B6"]);
const ABU_DHABI = new Set(["AUH"]);

type Range = [number, number];
type RangeRow = Record<Cabin, Range | null>;
const r = (e: Range, p: Range | null, b: Range, f: Range | null): RangeRow => ({ economy: e, premium: p, business: b, first: f });

const FROM_AUH: Record<string, RangeRow> = {
  eu: r([22_000, 45_000], [35_000, 60_000], [55_000, 100_000], [100_000, 180_000]),
  na: r([40_000, 80_000], [60_000, 110_000], [90_000, 180_000], [150_000, 250_000]),
  asia: r([15_000, 40_000], [25_000, 55_000], [40_000, 90_000], [70_000, 140_000]),
  oce: r([40_000, 80_000], [60_000, 110_000], [90_000, 170_000], [150_000, 240_000]),
  af: r([20_000, 45_000], null, [50_000, 100_000], null),
  me: r([8_000, 20_000], null, [20_000, 45_000], null),
};

export const etihadGuest: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, BOOKABLE)) return null;
  if (!EY_METAL.has(carrier)) {
    return genericEstimate(input, { factor: 1.1, surcharge: { economy: 30, premium: 40, business: 60, first: 80 }, note: `Etihad Guest: ${carrier} partner estimate` });
  }
  const auhOrigin = ABU_DHABI.has(input.origin);
  const auhDest = ABU_DHABI.has(input.destination);
  if (!auhOrigin && !auhDest) return genericEstimate(input, { dynamic: 0.5, note: "Etihad Guest: dynamic estimate" });
  const m = macroOf(auhOrigin ? input.destinationRegion : input.originRegion);
  const key = isAsia(m) ? "asia" : m === "hi" || m === "cc" || m === "sa" ? "na" : m;
  const ranges = FROM_AUH[key];
  const range = ranges?.[input.cabin];
  if (!ranges) return genericEstimate(input, { dynamic: 0.5, note: "Etihad Guest: dynamic estimate" });
  if (!range) return null;
  const d = demandOf(input);
  const miles = roundTo(lerp(range[0], range[1], d), 500);
  const taxes = govTaxes(input) + carrierSurcharge("EY", input.cabin, input.distanceMiles);
  return quote(miles, taxes, "dynamic", `Etihad Guest: Abu Dhabi ↔ ${key} dynamic (typical ${range[0].toLocaleString("en-US")}–${range[1].toLocaleString("en-US")})`, peakFromDemand(d));
};
