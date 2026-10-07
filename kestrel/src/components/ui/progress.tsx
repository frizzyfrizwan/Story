import type { ComponentProps, ReactNode } from "react";
import { cn, clamp } from "@/lib/utils";

export type ProgressTone = "signal" | "aurora" | "rose" | "violet" | "gold" | "sky";

const FILL: Record<ProgressTone, string> = {
  signal: "bg-signal",
  aurora: "bg-aurora",
  rose: "bg-rose",
  violet: "bg-violet",
  gold: "bg-gold",
  sky: "bg-sky",
};
// The unfilled track is a lighter step of the same hue so state reads across the whole bar.
const TRACK: Record<ProgressTone, string> = {
  signal: "bg-signal-soft",
  aurora: "bg-aurora-soft",
  rose: "bg-rose-soft",
  violet: "bg-violet-soft",
  gold: "bg-gold-soft",
  sky: "bg-sky-soft",
};
const STROKE: Record<ProgressTone, string> = {
  signal: "stroke-signal",
  aurora: "stroke-aurora",
  rose: "stroke-rose",
  violet: "stroke-violet",
  gold: "stroke-gold",
  sky: "stroke-sky",
};
const TRACK_STROKE: Record<ProgressTone, string> = {
  signal: "stroke-signal-soft",
  aurora: "stroke-aurora-soft",
  rose: "stroke-rose-soft",
  violet: "stroke-violet-soft",
  gold: "stroke-gold-soft",
  sky: "stroke-sky-soft",
};

export interface ProgressProps extends Omit<ComponentProps<"div">, "children"> {
  /** 0–max. `null` renders an indeterminate shimmer. */
  value: number | null;
  max?: number;
  tone?: ProgressTone;
  size?: "sm" | "md" | "lg";
  label?: ReactNode;
  /** Show the percentage (or `formatValue(value)`) at the right of the label row. */
  showValue?: boolean;
  formatValue?: (value: number, max: number) => string;
}

const BAR_H = { sm: "h-1", md: "h-2", lg: "h-3" } as const;

/** Linear progress bar. Pass `value={null}` while the total is unknown. */
export function Progress({
  value,
  max = 100,
  tone = "signal",
  size = "md",
  label,
  showValue,
  formatValue = (v, m) => `${Math.round((v / m) * 100)}%`,
  className,
  ...props
}: ProgressProps) {
  const pct = value == null ? null : clamp((value / max) * 100, 0, 100);
  return (
    <div className={cn("w-full", className)} {...props}>
      {(label || showValue) && (
        <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-fg-muted">{label}</span>
          {showValue && value != null && <span className="font-mono tnum text-fg">{formatValue(value, max)}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value == null ? "Working…" : formatValue(value, max)}
        aria-label={typeof label === "string" ? label : undefined}
        className={cn("w-full overflow-hidden rounded-full", BAR_H[size], pct == null ? "skeleton" : TRACK[tone])}
      >
        {pct != null && (
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 ease-out", FILL[tone])}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export interface ProgressRingProps extends Omit<ComponentProps<"div">, "children"> {
  value: number;
  max?: number;
  /** Outer diameter in px. */
  size?: number;
  strokeWidth?: number;
  tone?: ProgressTone;
  label?: string;
  /** Center content; defaults to the percentage in mono. */
  children?: ReactNode;
  formatValue?: (value: number, max: number) => string;
}

/** Circular progress — a gauge for value scores, transfer progress, trip completion. */
export function ProgressRing({
  value,
  max = 100,
  size = 64,
  strokeWidth = 6,
  tone = "signal",
  label,
  children,
  formatValue = (v, m) => `${Math.round((v / m) * 100)}%`,
  className,
  ...props
}: ProgressRingProps) {
  const pct = clamp(value / max, 0, 1);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={formatValue(value, max)}
      aria-label={label}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className={TRACK_STROKE[tone]}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", STROKE[tone])}
        />
      </svg>
      <div
        className="absolute inset-0 grid place-items-center font-mono tnum font-medium text-fg"
        style={{ fontSize: Math.max(10, size * 0.22) }}
      >
        {children ?? formatValue(value, max)}
      </div>
    </div>
  );
}
