"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CABINS, type Cabin } from "@/lib/types";
import { focusRing } from "./tokens";

export type SegmentAccent = "signal" | "aurora" | "rose" | "violet" | "gold" | "sky" | Cabin;

/** Active-pill treatment per accent. Cabin accents use the cabin tokens. */
const ACCENT: Record<SegmentAccent, { pill: string; text: string; dot: string }> = {
  signal: { pill: "border-signal/30 bg-signal/12", text: "text-signal", dot: "bg-signal" },
  aurora: { pill: "border-aurora/30 bg-aurora/12", text: "text-aurora", dot: "bg-aurora" },
  rose: { pill: "border-rose/30 bg-rose/12", text: "text-rose", dot: "bg-rose" },
  violet: { pill: "border-violet/30 bg-violet/12", text: "text-violet", dot: "bg-violet" },
  gold: { pill: "border-gold/30 bg-gold/12", text: "text-gold", dot: "bg-gold" },
  sky: { pill: "border-sky/30 bg-sky/12", text: "text-sky", dot: "bg-sky" },
  economy: { pill: "border-cabin-economy/30 bg-cabin-economy/12", text: "text-cabin-economy", dot: "bg-cabin-economy" },
  premium: { pill: "border-cabin-premium/30 bg-cabin-premium/12", text: "text-cabin-premium", dot: "bg-cabin-premium" },
  business: { pill: "border-cabin-business/30 bg-cabin-business/12", text: "text-cabin-business", dot: "bg-cabin-business" },
  first: { pill: "border-cabin-first/30 bg-cabin-first/12", text: "text-cabin-first", dot: "bg-cabin-first" },
};

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown below `sm` when `responsive` is on (e.g. "J" for Business). */
  shortLabel?: ReactNode;
  icon?: ReactNode;
  accent?: SegmentAccent;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md" | "lg";
  /** Stretch to the container and share width equally. */
  fullWidth?: boolean;
  /** Use `shortLabel` on small screens. */
  responsive?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const ITEM_H = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-10 px-4 text-sm" } as const;

/** Single-choice pill track with a sliding active indicator. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  fullWidth,
  responsive,
  disabled,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-panel-border bg-bg-elev-1 p-1 scrollbar-none",
        fullWidth && "flex w-full",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const accent = o.accent ? ACCENT[o.accent] : null;
        return (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-150",
              ITEM_H[size],
              fullWidth && "flex-1",
              active ? (accent ? accent.text : "text-fg") : "text-fg-muted hover:text-fg",
              "disabled:pointer-events-none disabled:opacity-40",
              focusRing,
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 rounded-full border shadow-panel",
                  accent ? accent.pill : "border-panel-border-strong bg-bg-elev-3",
                )}
                transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2 [&_svg]:size-4">
              {accent && <span aria-hidden="true" className={cn("size-1.5 rounded-full", accent.dot, !active && "opacity-60")} />}
              {o.icon}
              {responsive && o.shortLabel ? (
                <>
                  <span className="sm:hidden">{o.shortLabel}</span>
                  <span className="hidden sm:inline">{o.label}</span>
                </>
              ) : (
                o.label
              )}
            </span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}

const CABIN_OPTIONS: SegmentedOption<Cabin>[] = [
  { value: "economy", label: "Economy", shortLabel: "Y", accent: "economy" },
  { value: "premium", label: "Premium", shortLabel: "W", accent: "premium" },
  { value: "business", label: "Business", shortLabel: "J", accent: "business" },
  { value: "first", label: "First", shortLabel: "F", accent: "first" },
];

export interface CabinPickerProps extends Omit<SegmentedControlProps<Cabin>, "options"> {
  /** Restrict to a subset, e.g. a route that sells no First. */
  cabins?: readonly Cabin[];
}

/** Cabin selector with per-cabin colour accents. Collapses to Y/W/J/F on phones. */
export function CabinPicker({ cabins = CABINS, responsive = true, ...props }: CabinPickerProps) {
  const options = CABIN_OPTIONS.filter((o) => cabins.includes(o.value));
  return <SegmentedControl options={options} responsive={responsive} aria-label="Cabin" {...props} />;
}
