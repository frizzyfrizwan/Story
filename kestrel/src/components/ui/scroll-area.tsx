"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps extends ComponentProps<typeof ScrollAreaPrimitive.Root> {
  orientation?: "vertical" | "horizontal" | "both";
  viewportClassName?: string;
}

/** Scroll container with a thin, token-coloured scrollbar that appears on hover. */
export function ScrollArea({
  className,
  viewportClassName,
  children,
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root type={type} className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className={cn("size-full rounded-[inherit] [&>div]:block!", viewportClassName)}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none p-0.5 transition-colors",
        orientation === "vertical" ? "h-full w-2.5 border-l border-l-transparent" : "h-2.5 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-fg-faint transition-colors hover:bg-fg-subtle" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}
