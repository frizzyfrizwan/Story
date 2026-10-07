/**
 * Generic zone/distance estimate — the fallback for programs without a
 * dedicated chart and for region pairs a chart does not publish.
 * Always `basis: "estimate"`.
 */
import type { Cabin } from "@/lib/types";
import { typicalMilesFor } from "../cash";
import { demandOf, govTaxes, jitter, peakFromDemand, quote, roundTo, type PriceInput, type PriceQuote } from "./common";

export interface GenericOptions {
  /** Scale vs. the market-typical price (1 = typical). */
  factor?: number;
  /** Extra carrier surcharge in USD by cabin (YQ). */
  surcharge?: Partial<Record<Cabin, number>>;
  /** How strongly demand moves the price (0 = fixed chart, 0.6 = fully dynamic). */
  dynamic?: number;
  note?: string;
  basis?: PriceQuote["basis"];
}

export function genericEstimate(input: PriceInput, opts: GenericOptions = {}): PriceQuote {
  const factor = opts.factor ?? 1;
  const dyn = opts.dynamic ?? 0.25;
  const d = demandOf(input);
  const typical = typicalMilesFor(input.cabin, input.distanceMiles);
  // Demand swings the price around the typical value: −20 % at d=0, +dyn·100 % at d=1.
  const demandMul = 1 - 0.2 * dyn * 2 + d * dyn * 2.4;
  const miles = roundTo(typical * factor * demandMul * jitter(`${input.programId}:${input.origin}${input.destination}`, 0.03), 100);
  const taxes = govTaxes(input) + (opts.surcharge?.[input.cabin] ?? 0);
  return quote(
    miles,
    taxes,
    opts.basis ?? "estimate",
    opts.note ?? `${input.programId}: zone estimate (no published chart for this pairing)`,
    peakFromDemand(d),
  );
}
