"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./tokens";

export interface SwitchProps extends ComponentProps<typeof SwitchPrimitive.Root> {
  label?: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md";
  /** Put the control before the text instead of after. */
  controlFirst?: boolean;
}

/** Toggle. Aurora when on. With `label` it renders a full-width labelled row with a 44px hit area. */
export function Switch({
  label,
  description,
  size = "md",
  controlFirst,
  className,
  id: idProp,
  ...props
}: SwitchProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = description ? `${id}-desc` : undefined;

  const control = (
    <SwitchPrimitive.Root
      id={id}
      aria-describedby={descId}
      className={cn(
        "group relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-panel-border bg-bg-elev-3 transition-colors duration-200",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-aurora",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Expand the hit area without changing the visual size.
        "after:absolute after:-inset-2 after:content-['']",
        size === "sm" ? "h-5 w-9" : "h-7 w-12",
        focusRing,
        !label && className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-fg shadow-[0_1px_2px_var(--bg)] transition-transform duration-200 ease-out",
          "group-data-[state=checked]:bg-bg-elev-1",
          size === "sm"
            ? "size-3.5 translate-x-[3px] data-[state=checked]:translate-x-[19px]"
            : "size-5 translate-x-[3px] data-[state=checked]:translate-x-[25px]",
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;

  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-4",
        controlFirst && "flex-row-reverse justify-end",
        props.disabled && "opacity-60",
        className,
      )}
    >
      <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col">
        <span className="text-sm font-medium text-fg">{label}</span>
        {description && (
          <span id={descId} className="text-[13px] text-fg-muted">
            {description}
          </span>
        )}
      </label>
      {control}
    </div>
  );
}
