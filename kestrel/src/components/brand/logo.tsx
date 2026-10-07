import { cn } from "@/lib/utils";

/**
 * Kestrel mark: a hovering bird reduced to three strokes + a dot (the seat it spotted).
 * Pure SVG, inherits currentColor so it works on any surface.
 */
export function KestrelMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M3 13c4.5-1.6 8.4-1.2 12 1.2 3.6-2.4 7.5-2.8 12-1.2-2.2 1.4-3.9 3.3-5.2 5.6-1.5 2.7-3.8 4.6-6.8 5.4-3-.8-5.3-2.7-6.8-5.4C6.9 16.3 5.2 14.4 3 13z"
        fill="currentColor"
        opacity="0.95"
      />
      <path d="M15 14.2v6.2" stroke="var(--bg, #07090f)" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="15" cy="27" r="2" fill="var(--signal, #ff8a3d)" />
    </svg>
  );
}

export function KestrelWordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <KestrelMark className="text-fg" />
      {!compact && (
        <span className="font-display text-[1.35rem] leading-none tracking-tight" style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1' }}>
          Kestrel
        </span>
      )}
    </span>
  );
}
