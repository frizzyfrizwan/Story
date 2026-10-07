"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { cn, clamp } from "@/lib/utils";

export interface NumberTickerProps extends Omit<ComponentProps<"span">, "children"> {
  value: number;
  /** Starting number for the first animation. */
  from?: number;
  /** Milliseconds. */
  duration?: number;
  delay?: number;
  decimals?: number;
  format?: (n: number) => string;
  /** Wait until the element scrolls into view before counting. */
  startOnView?: boolean;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Animated count-up in Geist Mono. Re-animates from the current figure when `value` changes. */
export function NumberTicker({
  value,
  from = 0,
  duration = 1100,
  delay = 0,
  decimals = 0,
  format,
  startOnView = true,
  className,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(from);
  const latest = useRef(from);

  const fmt =
    format ??
    ((n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));

  useEffect(() => {
    if (startOnView && !inView) return;
    if (reduce) {
      latest.current = value;
      setDisplay(value);
      return;
    }
    const startValue = latest.current;
    const startAt = performance.now() + delay;
    let raf = 0;
    const tick = (now: number) => {
      const t = clamp((now - startAt) / duration, 0, 1);
      const next = t >= 1 ? value : startValue + (value - startValue) * easeOutExpo(t);
      latest.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, inView, reduce, duration, delay, startOnView]);

  return (
    <span ref={ref} className={cn("font-mono tnum", className)} {...props}>
      <span aria-hidden="true">{fmt(display)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  );
}
