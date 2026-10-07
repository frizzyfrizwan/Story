import Link from "next/link";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./tokens";

type Padding = "none" | "sm" | "md" | "lg";

const PAD_X: Record<Padding, string> = { none: "", sm: "px-4", md: "px-5 sm:px-6", lg: "px-6 sm:px-8" };
const PAD_T: Record<Padding, string> = { none: "", sm: "pt-4", md: "pt-5 sm:pt-6", lg: "pt-6 sm:pt-8" };
const PAD_B: Record<Padding, string> = { none: "", sm: "pb-4", md: "pb-5 sm:pb-6", lg: "pb-6 sm:pb-8" };

// ─── Panel ────────────────────────────────────────────────────

export interface PanelProps extends Omit<ComponentProps<"section">, "title"> {
  as?: "section" | "div" | "article" | "aside" | "li" | "form";
  /** Film-grain overlay for a printed feel. */
  grain?: boolean;
  /** Stronger border for emphasis / dialogs. */
  strong?: boolean;
  padding?: Padding;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header slot (buttons, badges). */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Lift on hover — for panels that are also links/buttons. */
  interactive?: boolean;
  /** Play the `rise` entrance on mount. */
  rise?: boolean;
  /** Classes for the body wrapper. */
  bodyClassName?: string;
}

/** Glass panel — the base surface of the flight deck. */
export function Panel({
  as = "section",
  grain,
  strong,
  padding = "md",
  eyebrow,
  title,
  description,
  actions,
  footer,
  interactive,
  rise,
  bodyClassName,
  className,
  children,
  ...props
}: PanelProps) {
  const Comp = as as ElementType;
  const hasHeader = Boolean(eyebrow || title || description || actions);

  return (
    <Comp
      className={cn(
        "panel overflow-hidden",
        strong && "panel-strong",
        grain && "grain",
        interactive &&
          "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-panel-border-strong",
        rise && "animate-rise",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <header className={cn("flex items-start justify-between gap-4", PAD_X[padding], PAD_T[padding])}>
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">{eyebrow}</p>
            )}
            {title && (
              <h3 className="font-display text-lg leading-tight tracking-tight text-fg sm:text-xl balance-text">
                {title}
              </h3>
            )}
            {description && <p className="mt-1 text-sm text-fg-muted pretty-text">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div
        className={cn(
          PAD_X[padding],
          hasHeader ? (padding === "none" ? "" : "pt-4") : PAD_T[padding],
          PAD_B[padding],
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer && (
        <footer
          className={cn(
            "border-t border-panel-border bg-bg-elev-1/40 text-sm text-fg-muted",
            PAD_X[padding],
            padding === "none" ? "" : "py-3",
          )}
        >
          {footer}
        </footer>
      )}
    </Comp>
  );
}

// ─── Card ─────────────────────────────────────────────────────

export interface CardProps extends Omit<ComponentProps<"div">, "title"> {
  /** Renders the card as a Next Link. */
  href?: string;
  padding?: Padding;
  interactive?: boolean;
  grain?: boolean;
  as?: "div" | "article" | "li";
}

const CARD_PAD: Record<Padding, string> = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-8" };

/** Solid elevated card — denser than Panel, no blur. Becomes a link when `href` is set. */
export function Card({
  href,
  padding = "md",
  interactive,
  grain,
  as = "div",
  className,
  children,
  ...props
}: CardProps) {
  const classes = cn(
    "block rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 text-fg shadow-panel",
    CARD_PAD[padding],
    grain && "grain",
    (interactive || href) &&
      "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-panel-border-strong",
    href && focusRing,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  const Comp = as as ElementType;
  return (
    <Comp className={classes} {...props}>
      {children}
    </Comp>
  );
}

// ─── Section ──────────────────────────────────────────────────

export interface SectionProps extends Omit<ComponentProps<"section">, "title"> {
  as?: "section" | "div" | "article";
  /** Small mono label above the title, e.g. "Sweet spots". */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
}

const TITLE_SIZE = {
  sm: "text-xl sm:text-2xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-4xl lg:text-5xl",
} as const;

/** Editorial section header: eyebrow / display title / description / actions, then content. */
export function Section({
  as = "section",
  eyebrow,
  title,
  description,
  actions,
  size = "md",
  align = "left",
  className,
  children,
  ...props
}: SectionProps) {
  const Comp = as as ElementType;
  const hasHeader = Boolean(eyebrow || title || description || actions);
  return (
    <Comp className={cn("w-full", className)} {...props}>
      {hasHeader && (
        <div
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
            align === "center" && "items-center text-center sm:flex-col sm:items-center",
          )}
        >
          <div className={cn("min-w-0 max-w-2xl", align === "center" && "mx-auto")}>
            {eyebrow && <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">{eyebrow}</p>}
            {title && (
              <h2 className={cn("font-display leading-[1.05] tracking-tight text-fg balance-text", TITLE_SIZE[size])}>
                {title}
              </h2>
            )}
            {description && <p className="mt-3 text-[15px] leading-relaxed text-fg-muted pretty-text">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children && <div className={cn(hasHeader && "mt-6 sm:mt-8")}>{children}</div>}
    </Comp>
  );
}
