import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KESTREL_DOT, KESTREL_PATH } from "@/components/brand/logo";

export interface EmptyStateProps extends Omit<ComponentProps<"div">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Primary action — usually a <Button>. */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Replace the radar illustration with a plain icon. */
  icon?: ReactNode;
  illustration?: "radar" | "none";
  compact?: boolean;
}

/** Illustrated empty state: the kestrel hovering over a radar sweep. */
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon,
  illustration = "radar",
  compact,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-full flex-col items-center justify-center px-6 text-center animate-rise",
        compact ? "py-8" : "py-14",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-5 grid size-14 place-items-center rounded-full border border-panel-border bg-bg-elev-2 text-fg-muted [&_svg]:size-6">
          {icon}
        </div>
      ) : illustration === "radar" ? (
        <RadarKestrel className={cn("mb-2", compact ? "w-44" : "w-60")} />
      ) : null}
      <h3 className="font-display text-xl tracking-tight text-fg sm:text-2xl balance-text">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted pretty-text">{description}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** Dotted radar with sweeping beam, concentric rings and the kestrel mark. Decorative. */
export function RadarKestrel({ className }: { className?: string }) {
  const cx = 120;
  const cy = 76;
  return (
    <svg viewBox="0 0 240 150" className={cn("block", className)} aria-hidden="true">
      <defs>
        <pattern id="kestrel-radar-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="0.9" fill="var(--fg-faint)" />
        </pattern>
        <radialGradient id="kestrel-radar-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="kestrel-radar-mask">
          <rect width="240" height="150" fill="url(#kestrel-radar-fade)" />
        </mask>
        <linearGradient id="kestrel-radar-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--aurora)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--aurora)" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <g mask="url(#kestrel-radar-mask)">
        <rect width="240" height="150" fill="url(#kestrel-radar-dots)" />
        {[26, 50, 72].map((r, i) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--panel-border-strong)"
            strokeWidth="1"
            strokeDasharray={i === 2 ? "3 5" : undefined}
          />
        ))}
        <line x1={cx - 72} y1={cy} x2={cx + 72} y2={cy} stroke="var(--panel-border)" />
        <line x1={cx} y1={cy - 72} x2={cx} y2={cy + 72} stroke="var(--panel-border)" />
        {/* Sweeping beam */}
        <g className="motion-safe:animate-[spin_7s_linear_infinite]" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path
            d={`M${cx} ${cy} L${cx + 72} ${cy} A72 72 0 0 0 ${Math.round((cx + 72 * Math.cos(-Math.PI / 3)) * 1000) / 1000} ${Math.round((cy + 72 * Math.sin(-Math.PI / 3)) * 1000) / 1000} Z`}
            fill="url(#kestrel-radar-sweep)"
          />
          <line x1={cx} y1={cy} x2={cx + 72} y2={cy} stroke="var(--aurora)" strokeOpacity="0.7" strokeWidth="1.2" />
        </g>
      </g>

      {/* The kestrel + the seat it spotted */}
      <g transform={`translate(${cx - 16} ${cy - 20})`}>
        <path d={KESTREL_PATH} fill="var(--fg)" />
        <circle
          cx={KESTREL_DOT.cx}
          cy={KESTREL_DOT.cy}
          r={6}
          fill="none"
          stroke="var(--signal)"
          strokeWidth="1.2"
          className="motion-safe:animate-radar"
          style={{ transformOrigin: `${KESTREL_DOT.cx}px ${KESTREL_DOT.cy}px` }}
        />
        <circle cx={KESTREL_DOT.cx} cy={KESTREL_DOT.cy} r={KESTREL_DOT.r} fill="var(--signal)" />
      </g>
    </svg>
  );
}
