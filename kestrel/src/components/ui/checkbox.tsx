"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./tokens";

export interface CheckboxProps extends ComponentProps<typeof CheckboxPrimitive.Root> {
  label?: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md";
}

/** Checkbox with signal fill. Supports `checked="indeterminate"`. With `label`, the whole row is clickable. */
export function Checkbox({ label, description, size = "md", className, id: idProp, ...props }: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = description ? `${id}-desc` : undefined;

  const control = (
    <CheckboxPrimitive.Root
      id={id}
      aria-describedby={descId}
      className={cn(
        "group relative inline-grid shrink-0 cursor-pointer place-items-center rounded-[6px] border border-panel-border-strong bg-bg-elev-1 text-signal-fg transition-[background-color,border-color] duration-150",
        "hover:border-fg-subtle",
        "data-[state=checked]:border-signal data-[state=checked]:bg-signal data-[state=indeterminate]:border-signal data-[state=indeterminate]:bg-signal",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "after:absolute after:-inset-3 after:content-['']",
        size === "sm" ? "size-4" : "size-5",
        focusRing,
        !label && className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center animate-[rise_150ms_ease-out_both]">
        {props.checked === "indeterminate" ? (
          <Minus className={cn("stroke-[3]", size === "sm" ? "size-3" : "size-3.5")} aria-hidden="true" />
        ) : (
          <Check className={cn("stroke-[3]", size === "sm" ? "size-3" : "size-3.5")} aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return control;

  return (
    <div className={cn("flex min-h-11 items-start gap-3 py-2", props.disabled && "opacity-60", className)}>
      <span className="flex h-5 items-center">{control}</span>
      <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col">
        <span className="text-sm font-medium leading-5 text-fg">{label}</span>
        {description && (
          <span id={descId} className="text-[13px] text-fg-muted">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}
