import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Kestrel mark — a hovering kestrel ("windhover") seen from below: wide pointed
 * wings, fanned tail, head down. The signal dot beneath is the seat it spotted.
 * 32×32 viewBox. Shared by the favicon, the PWA icons and the empty-state radar.
 */
export const KESTREL_PATH =
  "M16 4C17.6 4 18.6 5.2 18.6 6.8C18.6 7.4 18.5 8 18.3 8.5C22.5 5.4 26.8 4.2 30.8 4.8C27.4 7.6 23.6 10.8 20.2 14.6L18.6 16.6C19.6 19 20.3 21.6 20.4 24.2C18.9 25 17.4 25.4 16 25.4C14.6 25.4 13.1 25 11.6 24.2C11.7 21.6 12.4 19 13.4 16.6L11.8 14.6C8.4 10.8 4.6 7.6 1.2 4.8C5.2 4.2 9.5 5.4 13.7 8.5C13.5 8 13.4 7.4 13.4 6.8C13.4 5.2 14.4 4 16 4Z";

export const KESTREL_DOT = { cx: 16, cy: 29.2, r: 2.1 } as const;

export type MarkTone = "ink" | "signal" | "aurora" | "gradient" | "mono";

export interface KestrelMarkProps {
  size?: number;
  className?: string;
  /** `ink` follows currentColor (default). `mono` also paints the dot in currentColor. */
  tone?: MarkTone;
  /** Hide the signal dot (e.g. when the mark is tiny). */
  dot?: boolean;
  /** Accessible name; omitted = decorative. */
  title?: string;
}

export function KestrelMark({ size = 28, className, tone = "ink", dot = true, title }: KestrelMarkProps) {
  const gradientId = useId();
  const fill =
    tone === "signal"
      ? "var(--signal)"
      : tone === "aurora"
        ? "var(--aurora)"
        : tone === "gradient"
          ? `url(#${gradientId})`
          : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {title && <title>{title}</title>}
      {tone === "gradient" && (
        <defs>
          <linearGradient id={gradientId} x1="2" y1="4" x2="30" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--signal)" />
            <stop offset="0.55" stopColor="var(--gold)" />
            <stop offset="1" stopColor="var(--aurora)" />
          </linearGradient>
        </defs>
      )}
      <path d={KESTREL_PATH} fill={fill} />
      {dot && (
        <circle
          cx={KESTREL_DOT.cx}
          cy={KESTREL_DOT.cy}
          r={KESTREL_DOT.r}
          fill={tone === "mono" ? "currentColor" : "var(--signal)"}
        />
      )}
    </svg>
  );
}

const WORD_SIZE = {
  sm: { mark: 22, text: "text-[1.1rem]" },
  md: { mark: 28, text: "text-[1.35rem]" },
  lg: { mark: 40, text: "text-[2rem]" },
} as const;

export interface KestrelWordmarkProps {
  className?: string;
  /** Mark only. */
  compact?: boolean;
  size?: keyof typeof WORD_SIZE;
  tone?: MarkTone;
}

/** Mark + "Kestrel" in Fraunces. Inherits text colour. */
export function KestrelWordmark({ className, compact = false, size = "md", tone = "ink" }: KestrelWordmarkProps) {
  const s = WORD_SIZE[size];
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)}>
      <KestrelMark size={s.mark} tone={tone} />
      {!compact && (
        <span
          className={cn("font-display leading-none tracking-tight", s.text)}
          style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1, "opsz" 36' }}
        >
          Kestrel
        </span>
      )}
    </span>
  );
}

export interface KestrelBadgeProps {
  /** Pixel size of the tile. */
  size?: number;
  className?: string;
  title?: string;
}

/**
 * App-icon tile: the mark on a dark rounded square — identical art to
 * public/icon.svg. The tile is always dark (it is the product icon, not a UI
 * surface), so these are fixed brand colours rather than theme tokens.
 */
export function KestrelBadge({ size = 40, className, title = "Kestrel" }: KestrelBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <rect width="64" height="64" rx="16" fill="#0c1018" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="#eef2ff" strokeOpacity="0.1" />
      <g transform="translate(11.2 9) scale(1.3)">
        <path d={KESTREL_PATH} fill="#eef2ff" />
        <circle cx={KESTREL_DOT.cx} cy={KESTREL_DOT.cy} r={KESTREL_DOT.r} fill="#ff8a3d" />
      </g>
    </svg>
  );
}

export interface KestrelLockupProps {
  className?: string;
  tagline?: string;
  size?: "md" | "lg";
}

/** Vertical lockup for the footer, 404 and auth pages: mark, wordmark, mono tagline. */
export function KestrelLockup({ className, tagline = "The award travel engine", size = "md" }: KestrelLockupProps) {
  return (
    <div className={cn("inline-flex flex-col items-start gap-2", className)}>
      <KestrelWordmark size={size === "lg" ? "lg" : "md"} />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-fg-subtle">{tagline}</span>
    </div>
  );
}
