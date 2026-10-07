import type { TransferBonus, TransferLink } from "@/lib/types";
import { daysBetween, fmtDate, fmtInt, todayISO } from "@/lib/utils";

/**
 * Pure helpers shared by the transfer matrix, program pages and the wallet.
 * No React, no data imports — callers pass links in.
 */

export const BANK_ORDER = ["amex-mr", "chase-ur", "citi-ty", "capital-one", "bilt", "wells-fargo"] as const;
export type BankId = (typeof BANK_ORDER)[number];

/** Short labels for column headers and chips. */
export const BANK_LABEL: Record<string, string> = {
  "amex-mr": "Amex",
  "chase-ur": "Chase",
  "citi-ty": "Citi",
  "capital-one": "Capital One",
  bilt: "Bilt",
  "wells-fargo": "Wells Fargo",
};

export const bankLabel = (id: string) => BANK_LABEL[id] ?? id;

export type TransferTime = TransferLink["transferTime"];
export type TransferTimeKind = "instant" | "hours" | "days";

export const TRANSFER_TIME_META: Record<TransferTime, { label: string; short: string; kind: TransferTimeKind }> = {
  instant: { label: "Instant", short: "now", kind: "instant" },
  hours: { label: "Within hours", short: "hrs", kind: "hours" },
  "1-2 days": { label: "1–2 days", short: "1–2 d", kind: "days" },
  "3-7 days": { label: "3–7 days", short: "3–7 d", kind: "days" },
  "1-2 weeks": { label: "1–2 weeks", short: "1–2 wk", kind: "days" },
};

export type BonusState = "active" | "upcoming" | "expired" | "none";

export function bonusState(bonus: TransferBonus | undefined, asOf = todayISO()): BonusState {
  if (!bonus) return "none";
  if (bonus.startsAt > asOf) return "upcoming";
  if (bonus.endsAt < asOf) return "expired";
  return "active";
}

export const isBonusActive = (link: TransferLink, asOf?: string) => bonusState(link.bonus, asOf) === "active";
export const isBonusLive = (link: TransferLink, asOf?: string) => {
  const s = bonusState(link.bonus, asOf);
  return s === "active" || s === "upcoming";
};

/** Destination points per source point including an active bonus. */
export function linkRatio(link: TransferLink, asOf?: string): number {
  const base = link.ratio[1] / link.ratio[0];
  return isBonusActive(link, asOf) ? base * (1 + (link.bonus?.percent ?? 0) / 100) : base;
}

/** "1:1", "5:4", "1:2" */
export function fmtRatio(ratio: [number, number]): string {
  return `${ratio[0]}:${ratio[1]}`;
}

/** Effective ratio as "1:1.3" (trimmed). */
export function fmtEffectiveRatio(link: TransferLink, asOf?: string): string {
  const r = linkRatio(link, asOf);
  const dest = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `1:${dest}`;
}

/** "Oct 31" */
export const fmtShortDate = (iso: string) => fmtDate(iso, { weekday: undefined });

/** "+30% to Oct 31" / "+50% on Nov 1" */
export function bonusLabel(bonus: TransferBonus): string {
  if (bonus.startsAt === bonus.endsAt) return `+${bonus.percent}% on ${fmtShortDate(bonus.endsAt)}`;
  return `+${bonus.percent}% to ${fmtShortDate(bonus.endsAt)}`;
}

export function bonusDaysLeft(bonus: TransferBonus, asOf = todayISO()): number {
  return Math.max(0, daysBetween(asOf, bonus.endsAt));
}

export function bonusDaysUntil(bonus: TransferBonus, asOf = todayISO()): number {
  return Math.max(0, daysBetween(asOf, bonus.startsAt));
}

/** Fraction of the bonus window that has elapsed (0 before it starts, 1 after). */
export function bonusElapsed(bonus: TransferBonus, asOf = todayISO()): number {
  const total = Math.max(1, daysBetween(bonus.startsAt, bonus.endsAt) + 1);
  const done = daysBetween(bonus.startsAt, asOf) + 1;
  return Math.min(1, Math.max(0, done / total));
}

/** "60,000 Amex → 78,000 Virgin" style example. */
export function exampleMath(link: TransferLink, source = 60_000, asOf?: string): { source: number; dest: number } {
  const src = Math.max(source, link.minimum);
  return { source: src, dest: Math.floor(src * linkRatio(link, asOf)) };
}

export function fmtPoints(n: number): string {
  return fmtInt(n);
}

/** Destinations reachable from only one bank. */
export function uniquePartners(links: TransferLink[]): Map<string, string[]> {
  const sources = new Map<string, Set<string>>();
  for (const l of links) (sources.get(l.to) ?? sources.set(l.to, new Set()).get(l.to)!).add(l.from);
  const out = new Map<string, string[]>();
  for (const [dest, banks] of sources) {
    if (banks.size === 1) {
      const bank = [...banks][0];
      out.set(bank, [...(out.get(bank) ?? []), dest]);
    }
  }
  return out;
}

/** Sort key for a destination list: airlines first (by alliance order), then hotels, then name. */
export const ALLIANCE_RANK: Record<string, number> = { star: 0, oneworld: 1, skyteam: 2, none: 3 };
