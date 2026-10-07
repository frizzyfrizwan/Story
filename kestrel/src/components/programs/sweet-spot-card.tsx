import { Quote } from "lucide-react";
import type { SweetSpot } from "@/lib/types";
import { cn, fmtInt } from "@/lib/utils";
import { Badge, CabinBadge } from "@/components/ui/badge";

export function SweetSpotCard({ spot, index, className }: { spot: SweetSpot; index?: number; className?: string }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5 shadow-panel",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {index != null && (
            <span className="font-mono text-[10.5px] tnum tracking-[0.18em] text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
          )}
          {spot.cabin && <CabinBadge cabin={spot.cabin} />}
        </div>
        {spot.miles != null && (
          <div className="text-right">
            <div className="font-mono tnum text-lg font-medium leading-none text-fg">{fmtInt(spot.miles)}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">from · one-way</div>
          </div>
        )}
      </div>
      <h3 className="font-display text-lg leading-snug tracking-tight text-fg balance-text">{spot.title}</h3>
      <p className="text-sm leading-relaxed text-fg-muted pretty-text">{spot.description}</p>
      {spot.example && (
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-2 px-3 py-2 font-mono text-xs text-fg">
          <Quote className="mt-0.5 size-3 shrink-0 text-signal" aria-hidden="true" />
          <span>{spot.example}</span>
        </p>
      )}
      {spot.tags && spot.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {spot.tags.map((t) => (
            <Badge key={t} variant="outline" size="sm" className="font-mono lowercase tracking-normal">
              #{t}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );
}
