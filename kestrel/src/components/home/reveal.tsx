"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds before the rise starts once the element is in view. */
  delay?: number;
  as?: "div" | "section" | "article" | "li";
}

/**
 * Rises content into place the first time it scrolls into view — the scroll-triggered cousin of
 * `animate-rise`. Renders plain static markup when the viewer prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const reduce = useReducedMotion();
  const Comp =
    as === "section" ? motion.section : as === "article" ? motion.article : as === "li" ? motion.li : motion.div;

  // Same markup on server and client (no hydration drift); reduced motion just snaps instead of rising.
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.55, ease: [0.2, 0.8, 0.2, 1], delay }}
    >
      {children}
    </Comp>
  );
}
