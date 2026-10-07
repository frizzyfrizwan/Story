import type { Alliance, ChartType, LoyaltyProgram, ProgramKind, TransferLink } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { BANK_ORDER } from "@/components/transfers/transfer-utils";

/**
 * Shared vocabulary for program surfaces: alliance / chart / surcharge labels and tones,
 * small badge components (server-safe, no hooks) and the slim `ProgramSummary` the index
 * page sends to the client.
 */

// ─── Alliances ────────────────────────────────────────────────

export const ALLIANCE_META: Record<Alliance, { label: string; short: string; variant: BadgeProps["variant"] }> = {
  star: { label: "Star Alliance", short: "Star", variant: "gold" },
  oneworld: { label: "oneworld", short: "oneworld", variant: "sky" },
  skyteam: { label: "SkyTeam", short: "SkyTeam", variant: "violet" },
  none: { label: "Independent", short: "Indep.", variant: "outline" },
};

export const ALLIANCE_ORDER: Alliance[] = ["star", "oneworld", "skyteam", "none"];

export function AllianceBadge({
  alliance,
  size = "sm",
  short,
  className,
}: {
  alliance?: Alliance;
  size?: BadgeProps["size"];
  short?: boolean;
  className?: string;
}) {
  if (!alliance) return null;
  const m = ALLIANCE_META[alliance];
  return (
    <Badge variant={m.variant} size={size} className={className} title={m.label}>
      {short ? m.short : m.label}
    </Badge>
  );
}

// ─── Chart types ──────────────────────────────────────────────

export const CHART_META: Record<ChartType, { label: string; hint: string }> = {
  distance: { label: "Distance chart", hint: "Priced by miles flown per segment" },
  zone: { label: "Zone chart", hint: "Fixed prices between regions" },
  dynamic: { label: "Dynamic", hint: "Prices float with demand and cash fares" },
  fixed: { label: "Fixed value", hint: "Each point is worth a set amount" },
  hybrid: { label: "Hybrid", hint: "Fixed chart on partners, dynamic on own metal" },
};

export function ChartBadge({ chartType, size = "sm", className }: { chartType: ChartType; size?: BadgeProps["size"]; className?: string }) {
  const m = CHART_META[chartType];
  return (
    <Badge variant="neutral" size={size} className={className} title={m.hint}>
      {m.label}
    </Badge>
  );
}

// ─── Surcharges ───────────────────────────────────────────────

export type SurchargeLevel = LoyaltyProgram["surcharges"];

export const SURCHARGE_META: Record<SurchargeLevel, { label: string; level: number; text: string; dot: string }> = {
  none: { label: "No surcharges", level: 0, text: "text-aurora", dot: "bg-aurora" },
  low: { label: "Low surcharges", level: 1, text: "text-sky", dot: "bg-sky" },
  medium: { label: "Medium surcharges", level: 2, text: "text-gold", dot: "bg-gold" },
  high: { label: "High surcharges", level: 3, text: "text-rose", dot: "bg-rose" },
};

/** Four-step scale: a filled dot per level, in the level's colour, with a text label. */
export function SurchargeIndicator({
  level,
  showLabel = true,
  className,
}: {
  level: SurchargeLevel;
  showLabel?: boolean;
  className?: string;
}) {
  const m = SURCHARGE_META[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={m.label}>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("size-1.5 rounded-full", i <= m.level ? m.dot : "bg-fg-faint")}
          />
        ))}
      </span>
      {showLabel && <span className={cn("text-[11px] font-medium", m.text)}>{m.label.replace(" surcharges", " YQ")}</span>}
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

// ─── Kind ─────────────────────────────────────────────────────

export const KIND_META: Record<ProgramKind, { label: string; plural: string; eyebrow: string }> = {
  bank: { label: "Bank currency", plural: "Bank currencies", eyebrow: "Transferable" },
  airline: { label: "Airline program", plural: "Airline programs", eyebrow: "Miles" },
  hotel: { label: "Hotel program", plural: "Hotel programs", eyebrow: "Nights" },
};

export const KIND_ORDER: ProgramKind[] = ["bank", "airline", "hotel"];

// ─── Summary for the index page ───────────────────────────────

export interface ProgramSummary {
  id: string;
  name: string;
  shortName: string;
  kind: ProgramKind;
  alliance?: Alliance;
  currency: string;
  valuationCpp: number;
  chartType: ChartType;
  surcharges: SurchargeLevel;
  color: string;
  sweetSpots: number;
  /** Bank ids that transfer into this program, in canonical bank order. */
  banks: string[];
  /** Bank ids with a bonus running right now. */
  bonusBanks: string[];
  /** Number of carriers bookable with this currency (airline programs). */
  carriers: number;
}

export function toProgramSummary(p: LoyaltyProgram, links: TransferLink[], activeBonus: (l: TransferLink) => boolean): ProgramSummary {
  const incoming = links.filter((l) => l.to === p.id);
  const order = new Map<string, number>(BANK_ORDER.map((b, i) => [b, i]));
  const banks = incoming.map((l) => l.from).sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  return {
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    kind: p.kind,
    alliance: p.alliance,
    currency: p.currency,
    valuationCpp: p.valuationCpp,
    chartType: p.chartType,
    surcharges: p.surcharges,
    color: p.color,
    sweetSpots: p.sweetSpots.length,
    banks,
    bonusBanks: incoming.filter(activeBonus).map((l) => l.from),
    carriers: p.bookableCarriers.length,
  };
}
