import { cn } from "@/lib/utils";

const SIZES = { xs: 12, sm: 16, md: 20, lg: 28, xl: 40 } as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES | number;
  className?: string;
  /** Screen-reader text. Pass an empty string when a parent already announces busy state. */
  label?: string;
  /** `arc` (default) is a runway-light sweep; `radar` is a ping used for live data. */
  variant?: "arc" | "radar";
}

/** Loading indicator. Inherits `currentColor`, so tint it with a text-* class. */
export function Spinner({ size = "md", className, label = "Loading", variant = "arc" }: SpinnerProps) {
  const px = typeof size === "number" ? size : SIZES[size];

  if (variant === "radar") {
    return (
      <span
        role="status"
        aria-label={label || undefined}
        className={cn("relative inline-grid shrink-0 place-items-center", className)}
        style={{ width: px, height: px }}
      >
        <span className="absolute inset-0 rounded-full bg-current opacity-30 animate-radar" />
        <span className="absolute inset-0 rounded-full bg-current opacity-30 animate-radar [animation-delay:900ms]" />
        <span className="relative size-1/3 rounded-full bg-current" />
        {label && <span className="sr-only">{label}</span>}
      </span>
    );
  }

  return (
    <svg
      role="status"
      aria-label={label || undefined}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0 animate-spin motion-reduce:animate-[spin_2s_linear_infinite]", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.18" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {label && <title>{label}</title>}
    </svg>
  );
}
