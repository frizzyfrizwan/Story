"use client";

/**
 * <NumberRoll> — odometer-style digit roll. Each digit is a column of 0–9 that translates to the
 * target; separators and symbols stay put. Columns are keyed from the right so thousands
 * separators keep their place when the number grows. Honors prefers-reduced-motion via the global
 * transition rule.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn, fmtCompact, fmtCpp, fmtInt, fmtUsd } from "@/lib/utils";

export type NumberFormat = "int" | "compact" | "usd" | "cpp" | "raw" | ((n: number) => string);

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function formatValue(n: number, format: NumberFormat): string {
  if (typeof format === "function") return format(n);
  switch (format) {
    case "compact":
      return fmtCompact(n);
    case "usd":
      return fmtUsd(n);
    case "cpp":
      return fmtCpp(n);
    case "raw":
      return String(n);
    default:
      return fmtInt(n);
  }
}

function RollChar({ ch, duration, delay }: { ch: string; duration: number; delay: number }) {
  const digit = DIGITS.indexOf(ch);
  if (digit < 0) {
    return (
      <span className="block h-[1em] overflow-hidden leading-[1em]" aria-hidden>
        {ch}
      </span>
    );
  }
  return (
    <span className="block h-[1em] overflow-hidden leading-[1em]" aria-hidden>
      <span
        className="block will-change-transform"
        style={{ transform: `translateY(-${digit}em)`, transition: `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] leading-[1em]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export interface NumberRollProps {
  value: number;
  format?: NumberFormat;
  /** ms per digit roll (default 700) */
  duration?: number;
  /** Start from zeros and roll up on first paint */
  animateOnMount?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
}

export function NumberRoll({ value, format = "int", duration = 700, animateOnMount = false, prefix, suffix, className }: NumberRollProps) {
  const target = useMemo(() => formatValue(value, format), [value, format]);
  const [shown, setShown] = useState(() => (animateOnMount ? target.replace(/\d/g, "0") : target));

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const chars = shown.split("");
  const n = chars.length;

  return (
    <span className={cn("inline-flex items-end font-mono leading-none tnum", className)}>
      <span className="sr-only">
        {prefix}
        {target}
        {suffix}
      </span>
      {prefix != null && (
        <span className="block h-[1em] leading-[1em]" aria-hidden>
          {prefix}
        </span>
      )}
      {chars.map((ch, i) => (
        <RollChar key={n - 1 - i} ch={ch} duration={duration} delay={(n - 1 - i) * 35} />
      ))}
      {suffix != null && (
        <span className="block h-[1em] leading-[1em]" aria-hidden>
          {suffix}
        </span>
      )}
    </span>
  );
}
