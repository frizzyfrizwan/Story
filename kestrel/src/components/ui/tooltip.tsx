"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";
import { popIn } from "./tokens";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element — the tooltip is attached with `asChild`. */
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Keyboard chord shown after the label, e.g. ["mod", "K"]. */
  shortcut?: string[];
  delayDuration?: number;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** Hover/focus tooltip. Renders the child alone when `disabled` or `content` is empty. */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  shortcut,
  delayDuration,
  disabled,
  open,
  onOpenChange,
  className,
}: TooltipProps) {
  if (disabled || content == null || content === false) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration} open={open} onOpenChange={onOpenChange}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          className={cn(
            "z-50 flex max-w-xs items-center gap-2 rounded-[8px] border border-panel-border-strong bg-bg-elev-3 px-2.5 py-1.5 text-xs leading-snug text-fg shadow-panel",
            popIn,
            className,
          )}
        >
          <span>{content}</span>
          {shortcut && <Kbd keys={shortcut} />}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
