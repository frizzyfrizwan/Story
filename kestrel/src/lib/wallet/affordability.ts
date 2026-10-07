import type { AwardFare, Balance, TransferLink, LoyaltyProgram } from "@/lib/types";

/**
 * Wallet-aware math: what a user can actually book with the points they hold,
 * including transfers from bank currencies (with ratios and running bonuses).
 * Pure functions — callers pass data in.
 */

export interface PaymentPlan {
  programId: string;
  milesNeeded: number;
  /** Miles already held in the program */
  direct: number;
  /** Transfers required to cover the gap, in order of preference */
  transfers: { from: string; sourcePoints: number; destPoints: number; ratio: [number, number]; bonusPercent?: number; transferTime: TransferLink["transferTime"] }[];
  /** Points remaining short after using every option */
  shortfall: number;
  affordable: boolean;
  /** Approximate total value spent in cents (direct + transferred) using valuations */
  costCents?: number;
}

const today = () => new Date().toISOString().slice(0, 10);

function activeBonus(link: TransferLink, asOf = today()): number {
  const b = link.bonus;
  if (!b) return 0;
  return b.startsAt <= asOf && b.endsAt >= asOf ? b.percent : 0;
}

/** Destination points per 1 source point for a link, including an active bonus. */
export function effectiveRatio(link: TransferLink, asOf?: string): number {
  return (link.ratio[1] / link.ratio[0]) * (1 + activeBonus(link, asOf) / 100);
}

/**
 * Build a payment plan for `milesNeeded` in `programId`.
 * Preference: direct balance → bank transfers ordered by lowest valuation cost per destination point.
 */
export function planPayment(
  programId: string,
  milesNeeded: number,
  balances: Balance[],
  links: TransferLink[],
  programs: Record<string, LoyaltyProgram>,
  asOf?: string,
): PaymentPlan {
  const held = new Map(balances.map((b) => [b.programId, b.amount]));
  const direct = Math.min(held.get(programId) ?? 0, milesNeeded);
  let remaining = milesNeeded - direct;
  const transfers: PaymentPlan["transfers"] = [];

  const candidates = links
    .filter((l) => l.to === programId && (held.get(l.from) ?? 0) >= l.minimum)
    .map((l) => {
      const ratio = effectiveRatio(l, asOf);
      const srcVal = programs[l.from]?.valuationCpp ?? 1.5;
      return { link: l, ratio, costPerDest: srcVal / ratio };
    })
    .sort((a, b) => a.costPerDest - b.costPerDest);

  for (const c of candidates) {
    if (remaining <= 0) break;
    const available = held.get(c.link.from) ?? 0;
    const maxDest = Math.floor(available * c.ratio);
    const destPoints = Math.min(maxDest, remaining);
    if (destPoints <= 0) continue;
    // Most programs transfer in blocks of 1,000 source points.
    const rawSource = destPoints / c.ratio;
    const sourcePoints = Math.min(available, Math.ceil(rawSource / 1000) * 1000);
    transfers.push({
      from: c.link.from,
      sourcePoints,
      destPoints: Math.floor(sourcePoints * c.ratio),
      ratio: c.link.ratio,
      bonusPercent: activeBonus(c.link, asOf) || undefined,
      transferTime: c.link.transferTime,
    });
    held.set(c.link.from, available - sourcePoints);
    remaining -= Math.floor(sourcePoints * c.ratio);
  }

  const shortfall = Math.max(0, remaining);
  const costCents =
    direct * (programs[programId]?.valuationCpp ?? 1.5) +
    transfers.reduce((sum, t) => sum + t.sourcePoints * (programs[t.from]?.valuationCpp ?? 1.5), 0);

  return { programId, milesNeeded, direct, transfers, shortfall, affordable: shortfall === 0, costCents };
}

/** Effective reach per program: direct balance plus everything transferable in. */
export function reachByProgram(
  balances: Balance[],
  links: TransferLink[],
  asOf?: string,
): Record<string, { direct: number; viaTransfer: number; total: number; sources: string[] }> {
  const held = new Map(balances.map((b) => [b.programId, b.amount]));
  const out: Record<string, { direct: number; viaTransfer: number; total: number; sources: string[] }> = {};
  const destinations = new Set<string>([...held.keys(), ...links.map((l) => l.to)]);
  for (const dest of destinations) {
    const direct = held.get(dest) ?? 0;
    let via = 0;
    const sources: string[] = [];
    for (const l of links) {
      if (l.to !== dest) continue;
      const src = held.get(l.from) ?? 0;
      if (src < l.minimum) continue;
      via += Math.floor(src * effectiveRatio(l, asOf));
      sources.push(l.from);
    }
    if (direct || via) out[dest] = { direct, viaTransfer: via, total: direct + via, sources };
  }
  return out;
}

/** Pick the cheapest affordable fare (by valuation cost), or the one with the smallest shortfall. */
export function bestAffordableFare(
  fares: AwardFare[],
  balances: Balance[],
  links: TransferLink[],
  programs: Record<string, LoyaltyProgram>,
  passengers = 1,
): { fare: AwardFare; plan: PaymentPlan } | null {
  let best: { fare: AwardFare; plan: PaymentPlan } | null = null;
  for (const fare of fares) {
    const plan = planPayment(fare.programId, fare.miles * passengers, balances, links, programs);
    if (!best) {
      best = { fare, plan };
      continue;
    }
    if (plan.affordable && !best.plan.affordable) best = { fare, plan };
    else if (plan.affordable === best.plan.affordable) {
      const a = plan.affordable ? (plan.costCents ?? Infinity) : plan.shortfall;
      const b = best.plan.affordable ? (best.plan.costCents ?? Infinity) : best.plan.shortfall;
      if (a < b) best = { fare, plan };
    }
  }
  return best;
}

/** Total wallet value in USD using editorial valuations. */
export function walletValueUsd(balances: Balance[], programs: Record<string, LoyaltyProgram>): number {
  return balances.reduce((sum, b) => sum + (b.amount * (programs[b.programId]?.valuationCpp ?? 1)) / 100, 0);
}
