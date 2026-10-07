import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CABIN_LABEL, CABIN_SHORT, type Cabin, type DataSource } from "@/lib/types";

export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-transparent bg-fg/8 text-fg-muted",
        signal: "border-signal/25 bg-signal-soft text-signal",
        aurora: "border-aurora/25 bg-aurora-soft text-aurora",
        rose: "border-rose/25 bg-rose-soft text-rose",
        violet: "border-violet/25 bg-violet-soft text-violet",
        gold: "border-gold/25 bg-gold-soft text-gold",
        sky: "border-sky/25 bg-sky-soft text-sky",
        outline: "border-panel-border-strong bg-transparent text-fg-muted",
      },
      size: {
        sm: "h-5 px-2 text-[10px] tracking-[0.04em]",
        md: "h-6 px-2.5 text-[11px] tracking-[0.03em]",
        lg: "h-7 px-3 text-xs tracking-[0.02em]",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  /** Leading status dot in the badge colour. */
  dot?: boolean;
  /** Animate the dot with a radar ping (use for live data only). */
  pulse?: boolean;
  /** Uppercase + letterspacing — for labels like LIVE, DEMO DATA. */
  caps?: boolean;
  icon?: ReactNode;
}

export function Badge({ className, variant, size, dot, pulse, caps, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), caps && "uppercase", className)} {...props}>
      {dot && (
        <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
          {pulse && <span className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-radar" />}
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      )}
      {icon}
      {children}
    </span>
  );
}

// ─── CabinBadge ───────────────────────────────────────────────

const CABIN_STYLES: Record<Cabin, string> = {
  economy: "border-cabin-economy/30 bg-cabin-economy/12 text-cabin-economy",
  premium: "border-cabin-premium/30 bg-cabin-premium/12 text-cabin-premium",
  business: "border-cabin-business/30 bg-cabin-business/12 text-cabin-business",
  first: "border-cabin-first/30 bg-cabin-first/12 text-cabin-first",
};

export interface CabinBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  cabin: Cabin;
  /** Letter only (Y/W/J/F). */
  short?: boolean;
}

/** Cabin tag with the cabin's colour accent and its booking-class letter in mono. */
export function CabinBadge({ cabin, short, className, size, ...props }: CabinBadgeProps) {
  return (
    <Badge variant="outline" size={size} className={cn(CABIN_STYLES[cabin], className)} title={CABIN_LABEL[cabin]} {...props}>
      <span className="font-mono font-semibold">{CABIN_SHORT[cabin]}</span>
      {short ? <span className="sr-only">{CABIN_LABEL[cabin]}</span> : <span>{CABIN_LABEL[cabin]}</span>}
    </Badge>
  );
}

// ─── SourceBadge ──────────────────────────────────────────────

const SOURCE: Record<DataSource, { variant: BadgeProps["variant"]; label: string; title: string; pulse?: boolean }> = {
  live: { variant: "aurora", label: "Live", title: "Live availability from the provider", pulse: true },
  cached: { variant: "sky", label: "Cached", title: "Cached result — may be a few minutes old" },
  simulated: { variant: "gold", label: "Demo data", title: "Simulated by the built-in demo engine. Add API keys to go live." },
};

export interface SourceBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  source: DataSource;
}

/** Provenance tag: pulsing aurora dot for live, sky for cached, gold DEMO DATA for simulated. */
export function SourceBadge({ source, size = "sm", className, ...props }: SourceBadgeProps) {
  const s = SOURCE[source];
  return (
    <Badge variant={s.variant} size={size} dot pulse={s.pulse} caps title={s.title} className={className} {...props}>
      {s.label}
    </Badge>
  );
}

// ─── ProgramChip ──────────────────────────────────────────────

export interface ProgramChipProps extends ComponentProps<"span"> {
  /** Canonical program id (data attribute only). */
  id: string;
  name: string;
  /** Brand colour from the program record. */
  color: string;
  /** Swatch + initials only. */
  compact?: boolean;
  size?: "sm" | "md";
  active?: boolean;
}

function initials(name: string) {
  const words = name.split(/[\s-]+/).filter(Boolean);
  const raw = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return raw.toUpperCase();
}

/** Loyalty-program chip: brand swatch + name. `compact` collapses to a lettered coin. */
export function ProgramChip({ id, name, color, compact, size = "md", active, className, style, ...props }: ProgramChipProps) {
  if (compact) {
    return (
      <span
        data-program={id}
        title={name}
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-full font-mono font-semibold text-fg",
          size === "sm" ? "size-6 text-[9px]" : "size-7 text-[10px]",
          className,
        )}
        style={{
          background: `color-mix(in oklab, ${color} 20%, transparent)`,
          boxShadow: `inset 0 0 0 1.5px ${color}`,
          ...style,
        }}
        {...props}
      >
        {initials(name)}
        <span className="sr-only">{name}</span>
      </span>
    );
  }

  return (
    <span
      data-program={id}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border bg-bg-elev-2 font-medium text-fg transition-colors",
        size === "sm" ? "h-6 pl-1.5 pr-2 text-[11px]" : "h-7 pl-2 pr-2.5 text-xs",
        active ? "border-panel-border-strong" : "border-panel-border",
        className,
      )}
      style={style}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("shrink-0 rounded-full", size === "sm" ? "size-2" : "size-2.5")}
        style={{ background: color, boxShadow: `0 0 0 2px color-mix(in oklab, ${color} 25%, transparent)` }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
