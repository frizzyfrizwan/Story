import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { focusRing } from "./tokens";

export const buttonVariants = cva(
  [
    "group/btn relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.005em]",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity,filter] duration-200 ease-out",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:shrink-0",
    focusRing,
  ],
  {
    variants: {
      variant: {
        /** Signal gradient with glow — one per view. */
        primary:
          "bg-[linear-gradient(135deg,var(--signal)_0%,var(--signal-strong)_100%)] text-signal-fg shadow-glow-signal hover:brightness-110 hover:-translate-y-px",
        /** Elevated panel — the workhorse. */
        secondary:
          "border border-panel-border bg-bg-elev-2 text-fg shadow-panel hover:border-panel-border-strong hover:bg-bg-elev-3",
        ghost: "text-fg-muted hover:bg-fg/6 hover:text-fg",
        outline: "border border-panel-border-strong bg-transparent text-fg hover:bg-fg/5",
        danger: "bg-rose text-bg hover:brightness-110",
        link: "h-auto rounded-none px-0 text-signal underline-offset-4 hover:underline active:scale-100",
        /** Aurora — for "available / book" affirmatives. */
        aurora: "bg-aurora text-aurora-fg shadow-glow-aurora hover:brightness-110 hover:-translate-y-px",
      },
      size: {
        sm: "h-9 gap-1.5 px-3.5 text-[13px] [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-[15px] [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-5",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

interface BaseProps extends Variants {
  /** Shows a spinner, keeps the width and disables interaction. */
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type ButtonAsButton = BaseProps & Omit<ComponentProps<"button">, "children" | "className"> & { href?: undefined };
type ButtonAsLink = BaseProps &
  Omit<ComponentProps<typeof Link>, "children" | "className"> & { href: ComponentProps<typeof Link>["href"] };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Button. Renders a Next `Link` when `href` is given, otherwise a `<button>`.
 * Works as a Radix `asChild` target because it forwards every prop and the ref.
 */
export function Button(props: ButtonProps) {
  const { variant, size, loading = false, leading, trailing, className, children, ...rest } = props;
  const classes = cn(buttonVariants({ variant, size }), loading && "cursor-progress", className);

  const content = (
    <>
      {loading && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <Spinner size="sm" label="" />
        </span>
      )}
      <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>
        {leading}
        {children}
        {trailing}
      </span>
    </>
  );

  if (rest.href !== undefined) {
    const { href, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={loading || undefined}
        aria-busy={loading || undefined}
        {...linkRest}
      >
        {content}
      </Link>
    );
  }

  const { type = "button", disabled, ...buttonRest } = rest as ButtonAsButton;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {content}
    </button>
  );
}

/** `Omit` that distributes over unions (so `disabled`/`onClick` survive on the button branch). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type IconButtonProps = DistributiveOmit<ButtonProps, "size" | "leading" | "trailing" | "children"> & {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  size?: "sm" | "md";
  children: ReactNode;
};

/** Square button for a single icon; `label` becomes the accessible name + tooltip title. */
export function IconButton({ label, size = "md", variant = "ghost", children, ...props }: IconButtonProps) {
  return (
    <Button
      {...(props as ButtonProps)}
      variant={variant}
      size={size === "sm" ? "icon-sm" : "icon"}
      aria-label={label}
      title={props.title ?? label}
    >
      {children}
    </Button>
  );
}
