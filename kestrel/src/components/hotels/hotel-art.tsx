/**
 * Art helpers for the hotel views — thin wrappers over the procedural <CityPostcard>.
 * No hooks, so they render from server and client components alike.
 *
 * The postcard is `role="img"`, which makes its descendants presentational; overlays with
 * controls are therefore rendered as siblings on top of it, never inside.
 */

import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { CityPostcard } from "@/components/art";
import type { HotelProperty } from "@/lib/types";
import { cn } from "@/lib/utils";

type Art = HotelProperty["art"];

export interface HotelArtProps {
  name: string;
  art: Art;
  /** Classes for the frame (set the aspect ratio here, e.g. `aspect-[21/9]`). */
  className?: string;
  /** Darken the lower part so text over the art stays legible. */
  scrim?: boolean;
  /** Overlay content, positioned with absolute utilities. */
  children?: ReactNode;
}

/** A postcard that fills its container, with a legibility scrim and an overlay layer. */
export function HotelArt({ name, art, className, scrim = true, children }: HotelArtProps) {
  return (
    <div className={cn("relative isolate aspect-[16/10] overflow-hidden rounded-[var(--radius)] bg-bg-elev-2", className)}>
      <CityPostcard
        name={name}
        motif={art.motif}
        from={art.from}
        to={art.to}
        showName={false}
        className="absolute inset-0 h-full w-full max-w-none rounded-none"
      />
      {scrim && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,14,0.82)_0%,rgba(5,7,14,0.42)_34%,rgba(5,7,14,0)_62%)]"
        />
      )}
      {children}
    </div>
  );
}

/** Small postcard swatch for lists, chips and the compare table. */
export function CityThumb({ name, art, className }: { name: string; art: Art | null; className?: string }) {
  if (!art) {
    return <span aria-hidden="true" className={cn("block aspect-[16/10] w-14 rounded-[6px] bg-bg-elev-3", className)} />;
  }
  return (
    <CityPostcard
      name={name}
      motif={art.motif}
      from={art.from}
      to={art.to}
      showName={false}
      grain={false}
      className={cn("w-14 shrink-0 rounded-[6px]", className)}
    />
  );
}

/** Gold star row with an accessible count. */
export function Stars({ count, className }: { count: 3 | 4 | 5; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-gold", className)} aria-label={`${count}-star`}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} className="size-3 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

/** Ink colours for text placed over the scrimmed art. */
export const ART_INK = "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]";
export const ART_INK_MUTED = "text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]";
