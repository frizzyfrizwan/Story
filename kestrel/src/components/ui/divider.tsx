import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DividerProps extends Omit<ComponentProps<"div">, "children"> {
  orientation?: "horizontal" | "vertical";
  /** `line` is a plain hairline, `hairline` fades at both ends, `tear` is a perforated boarding-pass tear. */
  variant?: "line" | "hairline" | "tear";
  /** Centered label, e.g. "or". */
  label?: ReactNode;
}

export function Divider({ orientation = "horizontal", variant = "line", label, className, ...props }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn("self-stretch", variant === "tear" ? "tear-line" : "w-px bg-panel-border", className)}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div role="separator" className={cn("flex items-center gap-3 text-xs text-fg-subtle", className)} {...props}>
        <span className="hairline flex-1" />
        <span className="shrink-0 font-mono uppercase tracking-[0.16em]">{label}</span>
        <span className="hairline flex-1" />
      </div>
    );
  }

  if (variant === "tear") {
    return (
      <div role="separator" className={cn("relative -mx-5 my-1 flex items-center", className)} {...props}>
        <span
          aria-hidden="true"
          className="size-5 shrink-0 -translate-x-1/2 rounded-full border border-panel-border bg-bg"
        />
        <span className="h-px flex-1 border-t border-dashed border-panel-border-strong" />
        <span
          aria-hidden="true"
          className="size-5 shrink-0 translate-x-1/2 rounded-full border border-panel-border bg-bg"
        />
      </div>
    );
  }

  return (
    <div
      role="separator"
      className={cn(variant === "hairline" ? "hairline" : "h-px w-full bg-panel-border", className)}
      {...props}
    />
  );
}
