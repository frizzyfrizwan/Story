"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./tokens";
import { useControllableState } from "./use-controllable";

export interface SliderProps extends Omit<
  ComponentProps<typeof SliderPrimitive.Root>,
  "value" | "defaultValue" | "onValueChange"
> {
  /** One number for a single thumb, two for a range. */
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  label?: ReactNode;
  /** Formats the readout and the thumb bubble, e.g. fmtCompact for miles. */
  formatValue?: (value: number) => string;
  /** Show the current value(s) at the right of the label row. */
  showValue?: boolean;
  /** Tick marks at these values. */
  marks?: number[];
  tone?: "signal" | "aurora";
}

/** Single or range slider with a value bubble on hover/drag. 44px tall hit area. */
export function Slider({
  value: valueProp,
  defaultValue = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  formatValue = (v) => String(v),
  showValue = true,
  marks,
  tone = "signal",
  className,
  disabled,
  ...props
}: SliderProps) {
  const [value, setValue] = useControllableState<number[]>({ value: valueProp, defaultValue, onChange: onValueChange });
  const isRange = value.length > 1;
  const readout = isRange
    ? `${formatValue(value[0])} – ${formatValue(value[value.length - 1])}`
    : formatValue(value[0]);

  return (
    <div className={cn("w-full", disabled && "opacity-50", className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-medium text-fg-muted">{label}</span>
          {showValue && <span className="font-mono tnum text-fg">{readout}</span>}
        </div>
      )}
      <SliderPrimitive.Root
        value={value}
        onValueChange={setValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="group relative flex h-11 w-full touch-none select-none items-center"
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-visible rounded-full bg-bg-elev-3">
          <SliderPrimitive.Range
            className={cn(
              "absolute h-full rounded-full",
              tone === "aurora"
                ? "bg-[linear-gradient(90deg,var(--aurora),var(--avail-3))]"
                : "bg-[linear-gradient(90deg,var(--signal),var(--signal-strong))]",
            )}
          />
          {marks?.map((m) => {
            const pct = ((m - min) / (max - min)) * 100;
            return (
              <span
                key={m}
                aria-hidden="true"
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-faint"
                style={{ left: `${pct}%` }}
              />
            );
          })}
        </SliderPrimitive.Track>
        {value.map((v, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={
              typeof label === "string" ? (isRange ? `${label} ${i === 0 ? "minimum" : "maximum"}` : label) : undefined
            }
            aria-valuetext={formatValue(v)}
            className={cn(
              "group/thumb relative block size-5 cursor-grab rounded-full border-2 border-bg bg-fg shadow-panel transition-[transform,box-shadow] duration-150",
              "hover:scale-110 active:cursor-grabbing active:scale-110 data-[disabled]:cursor-not-allowed",
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-panel-border-strong bg-bg-elev-3 px-1.5 py-0.5 font-mono text-[11px] tnum text-fg opacity-0 shadow-panel transition-opacity duration-150 group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100 group-active/thumb:opacity-100"
            >
              {formatValue(v)}
            </span>
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Root>
    </div>
  );
}
