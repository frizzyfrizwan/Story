import type { ComponentProps, ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberTicker, resolveNumberFormat, type NumberFormat } from "./number-ticker";
import { Skeleton } from "./skeleton";

export type StatTone = "signal" | "aurora" | "violet" | "gold" | "sky" | "rose";

const DOT: Record<StatTone, string> = {
  signal: "bg-signal",
  aurora: "bg-aurora",
  violet: "bg-violet",
  gold: "bg-gold",
  sky: "bg-sky",
  rose: "bg-rose",
};
const AREA: Record<StatTone, string> = {
  signal: "fill-signal/10",
  aurora: "fill-aurora/10",
  violet: "fill-violet/10",
  gold: "fill-gold/10",
  sky: "fill-sky/10",
  rose: "fill-rose/10",
};

export interface StatTileProps extends Omit<ComponentProps<"div">, "title"> {
  label: ReactNode;
  /** Number → mono tnum (animated when `animate`); ReactNode → rendered as is. */
  value: number | ReactNode;
  /** Format key ("int" | "compact" | "usd" | "cpp" | "percent") — required form when `animate` is used from a server component — or a function. */
  format?: NumberFormat;
  /** Count up on mount (numbers only). */
  animate?: boolean;
  /** Signed change, e.g. +12 for +12%. */
  delta?: number;
  deltaFormat?: (n: number) => string;
  /** "vs last week" — names the comparison period. */
  deltaLabel?: ReactNode;
  /** Decides whether a positive delta is good (green) or bad (rose). */
  upIsGood?: boolean;
  /** Up to ~12 points; latest period highlighted. */
  trend?: number[];
  tone?: StatTone;
  icon?: ReactNode;
  hint?: ReactNode;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const VALUE_SIZE = { sm: "text-xl", md: "text-[1.75rem]", lg: "text-4xl" } as const;

/** KPI tile: label / big mono value / delta with direction icon / optional sparkline. */
export function StatTile({
  label,
  value,
  format,
  animate,
  delta,
  deltaFormat = (n) =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
  deltaLabel,
  upIsGood = true,
  trend,
  tone = "signal",
  icon,
  hint,
  size = "md",
  loading,
  className,
  ...props
}: StatTileProps) {
  const fmt = resolveNumberFormat(format);
  const direction = delta == null || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const good = direction === "flat" ? null : (direction === "up") === upIsGood;
  const DeltaIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5 shadow-panel",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOT[tone])} />
          {label}
        </div>
        {icon && <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>}
      </div>

      {loading ? (
        <Skeleton className={cn("w-2/3", size === "lg" ? "h-10" : size === "sm" ? "h-6" : "h-8")} />
      ) : (
        <div className={cn("font-mono tnum font-medium leading-none tracking-tight text-fg", VALUE_SIZE[size])}>
          {typeof value === "number" ? animate ? <NumberTicker value={value} format={format} /> : fmt(value) : value}
        </div>
      )}

      {(delta != null || hint) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                good == null ? "text-fg-subtle" : good ? "text-aurora" : "text-rose",
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden="true" />
              <span className="font-mono tnum">{deltaFormat(delta)}</span>
            </span>
          )}
          {deltaLabel && <span className="text-fg-subtle">{deltaLabel}</span>}
          {hint && <span className="text-fg-subtle">{hint}</span>}
        </div>
      )}

      {trend && trend.length > 1 && <Sparkline data={trend} tone={tone} />}
    </div>
  );
}

export interface SparklineProps {
  data: number[];
  tone?: StatTone;
  className?: string;
  height?: number;
}

/** Tiny single-series trend: 2px de-emphasised line, area tint, latest point in the accent. */
export function Sparkline({ data, tone = "signal", className, height = 36 }: SparklineProps) {
  const n = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 8;
  const pts = data.map((v, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: pad + (1 - (v - min) / span) * (100 - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L100 100 L0 100 Z`;
  const last = pts[n - 1];
  const latest = data[n - 1];

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <path d={area} className={AREA[tone]} />
        <path
          d={line}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-fg-subtle"
        />
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg-elev-1",
          DOT[tone],
        )}
        style={{ left: `${last.x}%`, top: `${last.y}%` }}
      />
      <span className="sr-only">
        Trend over {n} periods, latest {latest.toLocaleString("en-US")}, range {min.toLocaleString("en-US")} to{" "}
        {max.toLocaleString("en-US")}.
      </span>
    </div>
  );
}
