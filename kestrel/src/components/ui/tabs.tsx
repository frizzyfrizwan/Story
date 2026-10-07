"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./tokens";

type TabsVariant = "underline" | "pills";
const VariantContext = createContext<TabsVariant>("underline");

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex w-full flex-col", className)} {...props} />;
}

export interface TabsListProps extends ComponentProps<typeof TabsPrimitive.List> {
  /** `underline` is editorial (default); `pills` is a segmented track. */
  variant?: TabsVariant;
}

export function TabsList({ variant = "underline", className, ...props }: TabsListProps) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.List
        className={cn(
          variant === "underline"
            ? "relative flex gap-1 overflow-x-auto border-b border-panel-border scrollbar-none"
            : "inline-flex w-max max-w-full items-center gap-1 overflow-x-auto rounded-full border border-panel-border bg-bg-elev-1 p-1 scrollbar-none",
          className,
        )}
        {...props}
      />
    </VariantContext.Provider>
  );
}

export interface TabsTriggerProps extends ComponentProps<typeof TabsPrimitive.Trigger> {
  icon?: ReactNode;
  /** Small mono count bubble. */
  count?: number | string;
}

export function TabsTrigger({ icon, count, className, children, ...props }: TabsTriggerProps) {
  const variant = useContext(VariantContext);
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "group inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-medium text-fg-muted transition-colors duration-150 hover:text-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        focusRing,
        variant === "underline"
          ? "relative h-11 rounded-[8px] px-3 text-sm data-[state=active]:text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-signal after:transition-transform after:duration-200 after:ease-out data-[state=active]:after:scale-x-100"
          : "h-9 rounded-full px-3.5 text-sm data-[state=active]:bg-bg-elev-3 data-[state=active]:text-fg data-[state=active]:shadow-panel",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count != null && (
        <span className="rounded-full bg-fg/8 px-1.5 py-0.5 font-mono text-[10.5px] tnum leading-none text-fg-subtle transition-colors group-data-[state=active]:bg-signal-soft group-data-[state=active]:text-signal">
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "mt-4 outline-none data-[state=active]:animate-[rise_280ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}
