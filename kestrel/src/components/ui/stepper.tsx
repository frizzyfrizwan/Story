"use client";

import { Minus, Plus } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn, clamp } from "@/lib/utils";
import { focusRing } from "./tokens";

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name for the group, e.g. "Passengers". */
  label: string;
  /** Visible caption next to the number, e.g. "pax". */
  unit?: ReactNode;
  format?: (value: number) => string;
  size?: "sm" | "md";
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** − / + stepper for passengers, nights, stops. Arrow keys work anywhere inside. */
export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 9,
  step = 1,
  label,
  unit,
  format = (v) => String(v),
  size = "md",
  disabled,
  name,
  className,
}: NumberStepperProps) {
  const set = (next: number) => {
    const v = clamp(next, min, max);
    if (v !== value) onChange(v);
  };
  const canDec = !disabled && value - step >= min;
  const canInc = !disabled && value + step <= max;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        e.preventDefault();
        set(value + step);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        e.preventDefault();
        set(value - step);
        break;
      case "Home":
        e.preventDefault();
        set(min);
        break;
      case "End":
        e.preventDefault();
        set(max);
        break;
    }
  };

  const btn = cn(
    "grid shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4",
    size === "sm" ? "size-8" : "size-10",
    focusRing,
  );

  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center rounded-full border border-panel-border bg-bg-elev-1 p-0.5 transition-colors focus-within:border-signal/60 focus-within:ring-[3px] focus-within:ring-signal/20",
        disabled && "opacity-50",
        className,
      )}
    >
      <button type="button" onClick={() => set(value - step)} disabled={!canDec} aria-label={`Fewer — ${label}`} className={btn}>
        <Minus aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        aria-label={label}
        className={cn(
          "inline-flex min-w-[2.5ch] items-baseline justify-center gap-1 px-1 text-center font-mono tnum font-medium text-fg",
          size === "sm" ? "text-[13px]" : "text-sm",
        )}
      >
        {format(value)}
        {unit && <span className="font-sans text-xs font-normal text-fg-subtle">{unit}</span>}
      </output>
      <button type="button" onClick={() => set(value + step)} disabled={!canInc} aria-label={`More — ${label}`} className={btn}>
        <Plus aria-hidden="true" />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
