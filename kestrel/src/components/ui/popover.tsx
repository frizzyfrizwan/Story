"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { floating, popIn } from "./tokens";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps extends ComponentProps<typeof PopoverPrimitive.Content> {
  /** Match the trigger's width (handy for comboboxes). */
  matchTrigger?: boolean;
}

/** Glass popover surface. Pads 16px by default; pass `p-0` for custom layouts. */
export function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  collisionPadding = 12,
  matchTrigger,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          floating,
          "w-72 rounded-[var(--radius)] p-4 text-fg outline-none",
          "max-h-[var(--radix-popover-content-available-height)]",
          matchTrigger && "w-[var(--radix-popover-trigger-width)]",
          popIn,
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
