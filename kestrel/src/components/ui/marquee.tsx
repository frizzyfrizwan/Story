"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface MarqueeProps extends ComponentProps<"div"> {
  /** Pixels per second. */
  speed?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  /** Gap between items and between the two copies, in px. */
  gap?: number;
  /** Fade the edges. */
  fade?: boolean;
}

/**
 * Continuous ticker for deals, program logos, "live finds". Renders the
 * children twice and loops seamlessly; pauses on hover/focus; static when the
 * viewer prefers reduced motion.
 */
export function Marquee({
  children,
  speed = 40,
  direction = "left",
  pauseOnHover = true,
  gap = 32,
  fade = true,
  className,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const paused = useRef(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    if (reduce || paused.current || !width) return;
    const distance = width + gap;
    const step = speed * (delta / 1000);
    let next = x.get() + (direction === "left" ? -step : step);
    if (direction === "left" && next <= -distance) next += distance;
    if (direction === "right" && next >= 0) next -= distance;
    x.set(next);
  });

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        fade && "[mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]",
        className,
      )}
      onMouseEnter={(e) => {
        if (pauseOnHover) paused.current = true;
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        paused.current = false;
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        paused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        paused.current = false;
        onBlur?.(e);
      }}
      {...props}
    >
      <motion.div className="flex w-max" style={{ x, gap }}>
        <div ref={trackRef} className="flex shrink-0 items-center" style={{ gap }}>
          {children}
        </div>
        <div aria-hidden="true" className="flex shrink-0 items-center" style={{ gap }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}
