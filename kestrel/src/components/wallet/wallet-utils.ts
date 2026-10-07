import type { Balance, CreditCard, LoyaltyProgram, SpendCategory, TransferLink } from "@/lib/types";
import { daysBetween, fmtCompact, todayISO } from "@/lib/utils";
import { effectiveRatio, type PaymentPlan } from "@/lib/wallet/affordability";
import { isBonusActive } from "@/components/transfers/transfer-utils";

/** Pure, client-safe helpers for the wallet surfaces. */

export const EXPIRY_SOON_DAYS = 90;

export function daysToExpiry(b: Balance, asOf = todayISO()): number | null {
  return b.expiresAt ? daysBetween(asOf, b.expiresAt) : null;
}

export function isExpiringSoon(b: Balance, asOf = todayISO()): boolean {
  const d = daysToExpiry(b, asOf);
  return d != null && d <= EXPIRY_SOON_DAYS;
}

/** Group balances bank → airline → hotel, largest first within each group. */
export function groupBalances(balances: Balance[], programs: Record<string, LoyaltyProgram>) {
  const groups: { kind: LoyaltyProgram["kind"]; items: Balance[] }[] = [
    { kind: "bank", items: [] },
    { kind: "airline", items: [] },
    { kind: "hotel", items: [] },
  ];
  const unknown: Balance[] = [];
  for (const b of balances) {
    const p = programs[b.programId];
    if (!p) {
      unknown.push(b);
      continue;
    }
    groups.find((g) => g.kind === p.kind)!.items.push(b);
  }
  for (const g of groups) g.items.sort((a, b) => b.amount - a.amount);
  return { groups: groups.filter((g) => g.items.length), unknown };
}

// ─── CSV import preview (mirrors src/lib/repo/wallet.ts parseBalanceCsv) ──

export interface CsvPreviewRow {
  line: number;
  program: string;
  amount: number;
  status?: string;
  expiresAt?: string;
  resolved?: LoyaltyProgram;
}

export function resolveProgram(name: string, programs: LoyaltyProgram[]): LoyaltyProgram | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return programs.find((p) => p.id === n || p.name.toLowerCase() === n || p.shortName.toLowerCase() === n);
}

export function parseCsvPreview(csv: string, programs: LoyaltyProgram[]): CsvPreviewRow[] {
  return csv
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter(({ raw }) => raw && !/^program/i.test(raw))
    .map(({ raw, line }) => {
      const [program = "", amount, status, expiresAt] = raw.split(",").map((s) => s.trim());
      const n = Number(String(amount ?? "").replace(/[^0-9.-]/g, ""));
      return {
        line,
        program,
        amount: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0,
        status: status || undefined,
        expiresAt: expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ? expiresAt : undefined,
        resolved: resolveProgram(program, programs),
      };
    })
    .filter((r) => r.program);
}

export const CSV_EXAMPLE = `program,amount,status,expires
amex-mr,185400
chase-ur,92150
Aeroplan,45200,25K
United,12400,,2027-03-01
world-of-hyatt,38000,Explorist`;

// ─── Payment plan summary ─────────────────────────────────────

/** "Use 45k Aeroplan + transfer 15k from Chase (25% bonus)" */
export function summarizePlan(plan: PaymentPlan, programs: Record<string, LoyaltyProgram>): string {
  const dest = programs[plan.programId]?.shortName ?? plan.programId;
  const parts: string[] = [];
  if (plan.direct > 0) parts.push(`use ${fmtCompact(plan.direct)} ${dest}`);
  for (const t of plan.transfers) {
    const from = programs[t.from]?.shortName ?? t.from;
    parts.push(`transfer ${fmtCompact(t.sourcePoints)} from ${from}${t.bonusPercent ? ` (${t.bonusPercent}% bonus)` : ""}`);
  }
  if (!parts.length) return plan.affordable ? `Covered by ${dest}` : `Short ${fmtCompact(plan.shortfall)} ${dest}`;
  const s = parts.join(" + ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Reach sentence ───────────────────────────────────────────

/** "Your 185k Amex can become 185k Aeroplan or 240k Virgin with the 30% bonus." */
export function reachSentence(
  balances: Balance[],
  links: TransferLink[],
  programs: Record<string, LoyaltyProgram>,
  asOf = todayISO(),
): string | null {
  const bank = balances
    .filter((b) => programs[b.programId]?.kind === "bank" && b.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0];
  if (!bank) return null;
  const from = links.filter((l) => l.from === bank.programId && programs[l.to]);
  if (!from.length) return null;
  // Prefer an airline bonus for the headline; hotels usually have inflated ratios (Hilton 1:2).
  const airlineFirst = (l: TransferLink) => (programs[l.to].kind === "airline" ? 0 : 1);
  const bonus = from
    .filter((l) => isBonusActive(l, asOf))
    .sort((a, b) => airlineFirst(a) - airlineFirst(b) || effectiveRatio(b, asOf) - effectiveRatio(a, asOf))[0];
  const par =
    from.find((l) => l.to === "aeroplan" && l !== bonus) ??
    from.find((l) => l.ratio[0] === l.ratio[1] && l !== bonus && programs[l.to].kind === "airline") ??
    from.find((l) => l !== bonus) ??
    from[0];
  const name = (id: string) => programs[id]?.shortName ?? id;
  const pts = (n: number) => fmtCompact(Math.floor(n));
  let s = `Your ${pts(bank.amount)} ${name(bank.programId)} can become ${pts(bank.amount * effectiveRatio(par, asOf))} ${name(par.to)}`;
  if (bonus && bonus !== par && bonus.bonus) {
    s += ` or ${pts(bank.amount * effectiveRatio(bonus, asOf))} ${name(bonus.to)} with the ${bonus.bonus.percent}% bonus`;
  }
  return `${s}.`;
}

// ─── Card optimizer ───────────────────────────────────────────

export const SPEND_CATEGORIES: { value: SpendCategory; label: string }[] = [
  { value: "dining", label: "Dining" },
  { value: "groceries", label: "Groceries" },
  { value: "travel", label: "Travel (other)" },
  { value: "flights", label: "Flights" },
  { value: "hotels", label: "Hotels" },
  { value: "gas", label: "Gas & EV" },
  { value: "transit", label: "Transit & rideshare" },
  { value: "streaming", label: "Streaming" },
  { value: "online", label: "Online shopping" },
  { value: "rent", label: "Rent" },
  { value: "business", label: "Business spend" },
  { value: "everything", label: "Everything else" },
];

export interface EarnMatch {
  multiplier: number;
  note?: string;
  /** Which earn category produced the match (may be a fallback like "everything"). */
  via: SpendCategory;
}

/** Best published multiplier for a category; flights/hotels fall back to "travel", everything else to the base rate. */
export function earnRate(card: CreditCard, category: SpendCategory): EarnMatch {
  const pick = (cat: SpendCategory) =>
    card.earn.filter((e) => e.category === cat).sort((a, b) => b.multiplier - a.multiplier)[0];
  const exact = pick(category);
  if (exact) return { multiplier: exact.multiplier, note: exact.note, via: category };
  if (category === "flights" || category === "hotels") {
    const travel = pick("travel");
    if (travel) return { multiplier: travel.multiplier, note: travel.note, via: "travel" };
  }
  const base = pick("everything");
  return base ? { multiplier: base.multiplier, note: base.note, via: "everything" } : { multiplier: 1, via: "everything" };
}

export interface RankedCard {
  card: CreditCard;
  earn: EarnMatch;
  /** Editorial value of the currency earned, cents per point. */
  cpp: number;
  /** Cents of value per dollar spent. */
  centsPerDollar: number;
  monthlyValueUsd: number;
  /** The wallet already holds this currency. */
  held: boolean;
}

export function rankCards(
  cards: CreditCard[],
  category: SpendCategory,
  monthlyUsd: number,
  programs: Record<string, LoyaltyProgram>,
  heldCurrencies: Set<string>,
): RankedCard[] {
  return cards
    .map((card) => {
      const earn = earnRate(card, category);
      const cpp = programs[card.currency]?.valuationCpp ?? 1;
      const centsPerDollar = earn.multiplier * cpp;
      return { card, earn, cpp, centsPerDollar, monthlyValueUsd: (monthlyUsd * centsPerDollar) / 100, held: heldCurrencies.has(card.currency) };
    })
    .sort((a, b) => b.centsPerDollar - a.centsPerDollar || Number(b.held) - Number(a.held) || a.card.annualFeeUsd - b.card.annualFeeUsd);
}
