import type { AwardFare, Cabin, AwardRegion, TransferOption, TransferLink } from "@/lib/types";

/**
 * STUB — replaced by the award-engine agent. Keep these signatures.
 */

export interface PriceInput {
  programId: string;
  carrier: string;
  origin: string;
  destination: string;
  originRegion: AwardRegion;
  destinationRegion: AwardRegion;
  distanceMiles: number;
  cabin: Cabin;
  /** YYYY-MM-DD, used for peak/off-peak and dynamic pricing */
  date: string;
  /** 0–1 demand signal from the simulator (optional) */
  demand?: number;
}

export interface PriceQuote {
  miles: number;
  taxesUsd: number;
  basis: "chart" | "dynamic" | "estimate";
  /** Human-readable chart note, e.g. "Aeroplan: North America ↔ Atlantic, 4001–6000 mi" */
  note?: string;
  peak?: "off-peak" | "standard" | "peak";
}

/** Price an award for a program; null when the program cannot book this carrier. */
export function priceAward(_input: PriceInput): PriceQuote | null {
  return null;
}

/** Cents per point = (cash − taxes) / miles × 100. */
export function cpp(miles: number, taxesUsd: number, cashUsd: number): number {
  if (miles <= 0) return 0;
  return Math.max(0, ((cashUsd - taxesUsd) / miles) * 100);
}

/** Estimated cash fare for a route/cabin when no live fare is available. */
export function estimateCashFare(distanceMiles: number, cabin: Cabin, date?: string): number {
  const base: Record<Cabin, number> = { economy: 0.12, premium: 0.22, business: 0.48, first: 0.9 };
  void date;
  return Math.round(150 + distanceMiles * base[cabin]);
}

export interface ScoreInput {
  programId: string;
  cabin: Cabin;
  miles: number;
  taxesUsd: number;
  cashUsd: number;
  distanceMiles: number;
  seats: number | null;
  stops: number;
}

/** 0–100 score plus badges like "Sweet spot", "Low taxes", "Wide open". */
export function scoreFare(_input: ScoreInput): { valueScore: number; badges: string[]; cpp: number } {
  return { valueScore: 50, badges: [], cpp: 0 };
}

/** Compute how many bank points are needed via each transfer partner link. */
export function buildTransferOptions(miles: number, links: TransferLink[]): TransferOption[] {
  return links.map((l) => {
    const bonus = l.bonus?.percent ?? 0;
    const effective = (l.ratio[1] / l.ratio[0]) * (1 + bonus / 100);
    return {
      bankProgramId: l.from,
      ratio: l.ratio,
      bankPointsNeeded: Math.ceil(miles / effective / 1000) * 1000,
      bonusPercent: bonus || undefined,
      transferTime: l.transferTime,
    };
  });
}

export type { AwardFare };
