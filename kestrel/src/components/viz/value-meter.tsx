"use client";

/**
 * <ValueMeter> — semicircular gauge for an award's value: needle over a rose→gold→aurora arc,
 * cpp in the middle, verdict label ("Good deal" / "Fair" / "Poor") and the benchmark.
 * <CppBar> — the compact inline version for result rows.
 */

import { useEffect, useId, useState } from "react";
import { clamp, cn, fmtCpp } from "@/lib/utils";

export type ValueVerdict = "Good deal" | "Fair" | "Poor";

export function valueVerdict(score: number): { label: ValueVerdict; textClass: string; colorVar: string } {
  if (score >= 70) return { label: "Good deal", textClass: "text-aurora", colorVar: "var(--aurora)" };
  if (score >= 40) return { label: "Fair", textClass: "text-gold", colorVar: "var(--gold)" };
  return { label: "Poor", textClass: "text-rose", colorVar: "var(--rose)" };
}

/** 0–100 from cpp vs benchmark when no engine score is available: benchmark → 50, 2× → 100. */
export function scoreFromCpp(cpp: number, benchmark: number): number {
  if (!benchmark || benchmark <= 0) return 50;
  return clamp(Math.round((cpp / benchmark) * 50), 0, 100);
}

export interface ValueMeterProps {
  /** 0–100 Kestrel value score. Derived from cpp/benchmark when omitted. */
  score?: number;
  /** Cents per point achieved */
  cpp: number;
  /** Editorial valuation to compare against */
  benchmark: number;
  /** Width in px (default 180) */
  size?: number;
  /** Caption under the verdict; default "vs {benchmark} typical" */
  caption?: string;
  className?: string;
}

export function ValueMeter({ score, cpp, benchmark, size = 180, caption, className }: ValueMeterProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const s = clamp(score ?? scoreFromCpp(cpp, benchmark), 0, 100);
  const verdict = valueVerdict(s);
  const [angle, setAngle] = useState(-90);
  useEffect(() => {
    const t = window.setTimeout(() => setAngle(-90 + s * 1.8), 30);
    return () => window.clearTimeout(t);
  }, [s]);

  const height = size * 0.66;
  const ticks = Array.from({ length: 11 }, (_, i) => i);

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      style={{ width: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={s}
      aria-valuetext={`${verdict.label}: ${fmtCpp(cpp)} per point vs ${fmtCpp(benchmark)} typical`}
    >
      <svg viewBox="0 0 200 118" width={size} height={height} aria-hidden className="block overflow-visible">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--rose)" />
            <stop offset="50%" stopColor="var(--gold)" />
            <stop offset="100%" stopColor="var(--aurora)" />
          </linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--bg-elev-3)" strokeWidth={14} strokeLinecap="round" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={`url(#${id}-g)`} strokeWidth={10} strokeLinecap="round" opacity={0.95} />
        {ticks.map((i) => {
          const major = i % 5 === 0;
          return (
            <line
              key={i}
              x1={100}
              y1={major ? 10 : 13}
              x2={100}
              y2={18}
              stroke="var(--fg-subtle)"
              strokeWidth={major ? 1.5 : 1}
              opacity={major ? 0.9 : 0.5}
              transform={`rotate(${-90 + i * 18} 100 100)`}
            />
          );
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px", transition: "transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          <path d="M97.5 100 L100 30 L102.5 100 Z" fill="var(--fg)" />
          <circle cx={100} cy={30} r={3} fill={verdict.colorVar} />
        </g>
        <circle cx={100} cy={100} r={6} fill="var(--bg-elev-3)" stroke="var(--fg)" strokeWidth={1.5} />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center" style={{ paddingBottom: size * 0.02 }}>
        <div className="font-mono text-2xl font-semibold leading-none tnum" style={{ fontSize: size * 0.15 }}>
          {fmtCpp(cpp)}
        </div>
      </div>
      <div className="mt-1 flex flex-col items-center">
        <div className={cn("font-mono text-[11px] font-semibold uppercase tracking-[0.2em]", verdict.textClass)}>{verdict.label}</div>
        <div className="text-[11px] text-fg-subtle">{caption ?? `vs ${fmtCpp(benchmark)} typical`}</div>
      </div>
    </div>
  );
}

export interface CppBarProps {
  cpp: number;
  benchmark: number;
  /** Full-width value (default 2 × benchmark) */
  max?: number;
  showLabel?: boolean;
  className?: string;
}

export function CppBar({ cpp, benchmark, max, showLabel = true, className }: CppBarProps) {
  const top = max ?? benchmark * 2;
  const pct = clamp(cpp / top, 0, 1) * 100;
  const benchPct = clamp(benchmark / top, 0, 1) * 100;
  const verdict = valueVerdict(scoreFromCpp(cpp, benchmark));
  return (
    <div
      className={cn("flex items-center gap-2.5", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={top}
      aria-valuenow={cpp}
      aria-valuetext={`${fmtCpp(cpp)} per point, ${verdict.label.toLowerCase()} vs ${fmtCpp(benchmark)} typical`}
    >
      {showLabel && <span className="font-mono text-sm font-semibold leading-none tnum">{fmtCpp(cpp)}</span>}
      <span className="relative h-1.5 min-w-[4rem] flex-1 rounded-full bg-bg-elev-3">
        <span
          className="absolute inset-0 rounded-full transition-[clip-path] duration-700 ease-out"
          style={{
            background: "linear-gradient(90deg, var(--rose), var(--gold) 50%, var(--aurora))",
            clipPath: `inset(0 ${100 - pct}% 0 0 round 9999px)`,
          }}
        />
        <span
          className="absolute -top-[3px] h-3 w-[2px] rounded-full bg-fg-subtle"
          style={{ left: `calc(${benchPct}% - 1px)` }}
          title={`Typical: ${fmtCpp(benchmark)}`}
        />
      </span>
      {showLabel && (
        <span className={cn("font-mono text-[10px] font-semibold uppercase tracking-[0.16em]", verdict.textClass)}>{verdict.label}</span>
      )}
    </div>
  );
}
