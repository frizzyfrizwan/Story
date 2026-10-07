"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import { SplitFlap, type SplitFlapProps } from "@/components/viz";

/** A SplitFlap that stays blank until it scrolls into view, then flips to its text. */
export function FlapOnView({ text, className, ...props }: SplitFlapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const blank = text
    .split("\n")
    .map((line) => " ".repeat(line.length))
    .join("\n");
  return (
    <div ref={ref} className="inline-flex">
      <SplitFlap text={inView ? text : blank} label={text} className={className} {...props} />
    </div>
  );
}
