/**
 * Hand-drawn SVG glyphs for the landing page. Stroke follows `currentColor` so the parent sets the
 * tone; the single signal-orange dot in the alert glyph is "the seat that just opened".
 * Pure SVG, no hooks — safe in server components.
 */

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type GlyphProps = Omit<ComponentProps<"svg">, "children">;

function Glyph({ className, children, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-10 shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Radar sweep over a field of programs. */
export function ScanGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx={24} cy={24} r={18} strokeDasharray="2.5 4.5" opacity={0.55} />
      <circle cx={24} cy={24} r={10.5} />
      <path d="M24 24 L24 6 A18 18 0 0 1 37.6 12.2 Z" fill="currentColor" stroke="none" opacity={0.16} />
      <path d="M24 24 L37.6 12.2" />
      <circle cx={13.5} cy={30} r={2} fill="currentColor" stroke="none" />
      <circle cx={31} cy={34} r={2} fill="currentColor" stroke="none" />
      <circle cx={16.5} cy={14.5} r={2} fill="currentColor" stroke="none" />
      <circle cx={24} cy={24} r={2.2} fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A stack of points moving across to a bonus. */
export function TransferGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <ellipse cx={13} cy={17} rx={7} ry={3} />
      <path d="M6 17v12c0 1.7 3.1 3 7 3s7-1.3 7-3V17" />
      <path d="M6 23c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      <path d="M23.5 24h8.5" />
      <path d="M29 20.5 32.5 24 29 27.5" />
      <circle cx={39} cy={24} r={5.5} />
      <path d="M39 21.4v5.2M36.4 24h5.2" />
    </Glyph>
  );
}

/** A bell inside a radar ring; the orange dot is the seat that opened. */
export function AlertGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M15.5 30.5V22.5a8.5 8.5 0 0 1 17 0v8l2.5 3.5h-22l2.5-3.5Z" />
      <path d="M21 36.5a3 3 0 0 0 6 0" />
      <path d="M24 10.5v3.5" />
      <path d="M35.5 11.5a14 14 0 0 1 4 8.5" opacity={0.55} />
      <path d="M12.5 11.5a14 14 0 0 0-4 8.5" opacity={0.55} />
      <circle cx={33.5} cy={21.5} r={2.6} fill="var(--signal)" stroke="var(--bg-elev-1)" strokeWidth={1.5} />
    </Glyph>
  );
}

/** Small check for feature lists. */
export function CheckGlyph({ className, ...props }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

/** Top-down airliner silhouette in a 24×24 box, nose pointing up. */
export const PLANE_GLYPH =
  "M12 1.5c.7 0 1.2.9 1.3 2.2l.3 5.3 8.2 4.6v1.9l-8.1-2.4-.4 5.4 2.6 1.8v1.4L12 20.9l-3.9.8v-1.4l2.6-1.8-.4-5.4-8.1 2.4v-1.9l8.2-4.6.3-5.3C10.8 2.4 11.3 1.5 12 1.5Z";
