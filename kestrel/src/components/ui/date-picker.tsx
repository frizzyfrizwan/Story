"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, daysBetween, parseISODate, toISODate, todayISO } from "@/lib/utils";
import { IconButton } from "./button";
import { useFieldContext } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { SegmentedControl } from "./segmented";
import { fieldSize, fieldSurface, focusRing, type FieldSize } from "./tokens";
import { useIsDesktop } from "./use-media-query";

// ─── Types ────────────────────────────────────────────────────

export type HeatLevel = 0 | 1 | 2 | 3 | 4;
/** ISO date → availability level (0 none … 4 wide open). */
export type HeatMap = Record<string, HeatLevel>;
export interface DateRange {
  from: string | null;
  to: string | null;
}

const HEAT: Record<HeatLevel, string> = {
  0: "bg-avail-0 text-fg-subtle",
  1: "bg-avail-1 text-fg",
  2: "bg-avail-2 text-fg",
  3: "bg-avail-3 text-aurora-fg [[data-theme=light]_&]:text-fg",
  4: "bg-avail-4 text-aurora-fg [[data-theme=light]_&]:text-fg",
};
const HEAT_LABEL: Record<HeatLevel, string> = {
  0: "no availability",
  1: "scarce",
  2: "some seats",
  3: "good availability",
  4: "wide open",
};

const monthKey = (d: Date) => toISODate(startOfMonth(d));

// ─── Calendar ─────────────────────────────────────────────────

export interface CalendarProps {
  /** A single ISO date, or a range. */
  selected?: string | null | DateRange;
  onSelect?: (iso: string) => void;
  /** ISO of the first visible month (controlled). */
  month?: string;
  defaultMonth?: string;
  onMonthChange?: (isoMonthStart: string) => void;
  min?: string;
  max?: string;
  disabled?: (iso: string) => boolean;
  heat?: HeatMap;
  numberOfMonths?: 1 | 2;
  weekStartsOn?: 0 | 1;
  /** Provisional range end while hovering (range pickers). */
  hoverDate?: string | null;
  onHoverDate?: (iso: string | null) => void;
  showHeatLegend?: boolean;
  className?: string;
}

/**
 * Keyboard-navigable month grid (arrows, Home/End, PageUp/PageDown, Shift+Page for years).
 * Days can be tinted with an availability heat map.
 */
export function Calendar({
  selected,
  onSelect,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  min,
  max,
  disabled,
  heat,
  numberOfMonths = 1,
  weekStartsOn = 0,
  hoverDate,
  onHoverDate,
  showHeatLegend,
  className,
}: CalendarProps) {
  const id = useId();
  const range = selected != null && typeof selected === "object" ? selected : null;
  const single = typeof selected === "string" ? selected : null;
  const anchorIso = single ?? range?.from ?? todayISO();

  const [monthState, setMonthState] = useState(() => monthKey(parseISODate(defaultMonth ?? anchorIso)));
  const month = monthProp ? monthKey(parseISODate(monthProp)) : monthState;
  const monthStart = parseISODate(month);
  const setMonth = (d: Date) => {
    const key = monthKey(d);
    if (!monthProp) setMonthState(key);
    onMonthChange?.(key);
  };

  const [focusIso, setFocusIso] = useState(anchorIso);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(`${id}-${pendingFocus.current}`)?.focus();
    pendingFocus.current = null;
  });

  const lastVisible = endOfMonth(addMonths(monthStart, numberOfMonths - 1));
  const isVisible = (iso: string) => iso >= month && iso <= toISODate(lastVisible);
  const focusTarget = isVisible(focusIso) ? focusIso : month;

  const isDisabled = (iso: string) => Boolean((min && iso < min) || (max && iso > max) || disabled?.(iso));

  const moveFocus = (next: Date) => {
    const iso = toISODate(next);
    setFocusIso(iso);
    pendingFocus.current = iso;
    // Backwards: the target month becomes the first visible one. Forwards: it becomes the last.
    if (!isVisible(iso)) setMonth(iso < month ? startOfMonth(next) : addMonths(startOfMonth(next), 1 - numberOfMonths));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = parseISODate(focusTarget);
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cur, -1),
      ArrowRight: () => addDays(cur, 1),
      ArrowUp: () => addDays(cur, -7),
      ArrowDown: () => addDays(cur, 7),
      Home: () => startOfWeek(cur, { weekStartsOn }),
      End: () => endOfWeek(cur, { weekStartsOn }),
      PageUp: () => addMonths(cur, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cur, e.shiftKey ? 12 : 1),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    moveFocus(fn());
  };

  // Provisional range end for hover previews.
  const previewTo = range && range.from && !range.to && hoverDate && hoverDate > range.from ? hoverDate : null;

  const months = Array.from({ length: numberOfMonths }, (_, i) => addMonths(monthStart, i));
  const weekdays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn }),
    end: endOfWeek(monthStart, { weekStartsOn }),
  }).map((d) => format(d, "EEEEE"));
  const weekdayLong = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn }),
    end: endOfWeek(monthStart, { weekStartsOn }),
  }).map((d) => format(d, "EEEE"));

  const prevDisabled = Boolean(min && toISODate(endOfMonth(addMonths(monthStart, -1))) < min);
  const nextDisabled = Boolean(max && toISODate(addMonths(monthStart, numberOfMonths)) > max);

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <IconButton label="Previous month" size="sm" disabled={prevDisabled} onClick={() => setMonth(addMonths(monthStart, -1))}>
          <ChevronLeft />
        </IconButton>
        <div className="flex flex-1 justify-around" aria-live="polite">
          {months.map((m) => (
            <span key={monthKey(m)} id={`${id}-label-${monthKey(m)}`} className="font-display text-base tracking-tight text-fg">
              {format(m, "MMMM yyyy")}
            </span>
          ))}
        </div>
        <IconButton label="Next month" size="sm" disabled={nextDisabled} onClick={() => setMonth(addMonths(monthStart, 1))}>
          <ChevronRight />
        </IconButton>
      </div>

      <div className="mt-3 flex flex-col gap-6 sm:flex-row" onKeyDown={onKeyDown}>
        {months.map((m) => {
          const days = eachDayOfInterval({
            start: startOfWeek(startOfMonth(m), { weekStartsOn }),
            end: endOfWeek(endOfMonth(m), { weekStartsOn }),
          });
          const weeks: Date[][] = [];
          for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
          return (
            <div key={monthKey(m)} role="grid" aria-labelledby={`${id}-label-${monthKey(m)}`} className="w-[280px] sm:w-[266px]">
              <div role="row" className="grid grid-cols-7">
                {weekdays.map((w, i) => (
                  <div
                    key={i}
                    role="columnheader"
                    aria-label={weekdayLong[i]}
                    className="pb-2 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle"
                  >
                    {w}
                  </div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} role="row" className="grid grid-cols-7 gap-y-1">
                  {week.map((d) => {
                    const iso = toISODate(d);
                    if (!isSameMonth(d, m)) return <div key={iso} role="gridcell" aria-hidden="true" />;
                    const off = isDisabled(iso);
                    const level = heat?.[iso];
                    const isStart = range ? range.from === iso : single === iso;
                    const isEnd = range ? (range.to ?? previewTo) === iso : false;
                    const inRange =
                      range && range.from && (range.to ?? previewTo)
                        ? iso > range.from && iso < (range.to ?? previewTo ?? "")
                        : false;
                    const isSelected = isStart || isEnd;
                    const isToday = iso === todayISO();
                    const labelParts = [format(d, "EEEE, MMMM d, yyyy")];
                    if (level != null) labelParts.push(HEAT_LABEL[level]);
                    if (isSelected) labelParts.push("selected");
                    return (
                      <div
                        key={iso}
                        role="gridcell"
                        aria-selected={isSelected || inRange || undefined}
                        className={cn(
                          "p-0",
                          (inRange || (isStart && (range?.to ?? previewTo))) && "bg-signal-soft",
                          isStart && (range?.to ?? previewTo) && "rounded-l-[10px]",
                          isEnd && "rounded-r-[10px] bg-signal-soft",
                          previewTo && (inRange || isEnd) && !range?.to && "opacity-70",
                        )}
                      >
                        <button
                          type="button"
                          id={`${id}-${iso}`}
                          tabIndex={iso === focusTarget ? 0 : -1}
                          disabled={off}
                          aria-label={labelParts.join(", ")}
                          aria-current={isToday ? "date" : undefined}
                          data-heat={level}
                          onFocus={() => setFocusIso(iso)}
                          onClick={() => onSelect?.(iso)}
                          onMouseEnter={() => onHoverDate?.(iso)}
                          onMouseLeave={() => onHoverDate?.(null)}
                          className={cn(
                            "relative grid aspect-square w-full place-items-center rounded-[10px] font-mono text-[13px] tnum font-medium transition-[background-color,color,transform] duration-100",
                            focusRing,
                            off
                              ? "cursor-not-allowed text-fg-faint"
                              : level != null
                                ? cn(HEAT[level], "hover:brightness-110")
                                : "text-fg hover:bg-fg/8",
                            isSelected && "bg-signal text-signal-fg shadow-glow-signal hover:bg-signal hover:brightness-100 [[data-theme=light]_&]:text-signal-fg",
                            isToday && !isSelected && "after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-signal",
                          )}
                        >
                          {d.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {showHeatLegend && heat && (
        <div className="mt-4 flex items-center justify-end gap-2 px-1 text-[10.5px] text-fg-subtle">
          <span>None</span>
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
            <span key={l} aria-hidden="true" className={cn("size-3 rounded-[3px]", HEAT[l].split(" ")[0])} />
          ))}
          <span>Wide open</span>
        </div>
      )}
    </div>
  );
}

// ─── Trigger (shared) ─────────────────────────────────────────

interface TriggerProps {
  id?: string;
  size: FieldSize;
  disabled?: boolean;
  placeholder: string;
  children?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  hasValue: boolean;
}

function FieldTrigger({ id, size, disabled, placeholder, children, trailing, className, hasValue }: TriggerProps) {
  const field = useFieldContext();
  return (
    <PopoverTrigger
      id={id ?? field?.id}
      disabled={disabled}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        fieldSurface,
        fieldSize[size],
        "flex items-center gap-2.5 text-left outline-none focus-visible:border-signal/60 focus-visible:ring-[3px] focus-visible:ring-signal/20 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-signal/60",
        className,
      )}
    >
      <CalendarIcon className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      <span className={cn("flex min-w-0 flex-1 items-center gap-2 truncate", !hasValue && "text-fg-subtle")}>
        {hasValue ? children : placeholder}
      </span>
      {trailing}
    </PopoverTrigger>
  );
}

const fmtShort = (iso: string) => format(parseISODate(iso), "EEE, MMM d");

// ─── DatePicker ───────────────────────────────────────────────

export interface DatePickerProps {
  value: string | null;
  onChange: (iso: string | null) => void;
  /** ±days flexibility. Pass `onFlexChange` to show the flex chips. */
  flex?: number;
  onFlexChange?: (days: number) => void;
  flexOptions?: number[];
  min?: string;
  max?: string;
  /** Allow dates before today (default: today is the minimum). */
  allowPast?: boolean;
  heat?: HeatMap;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  size?: FieldSize;
  clearable?: boolean;
  weekStartsOn?: 0 | 1;
  className?: string;
}

/** Single date with optional ±flex chips (0 / ±1 / ±3 / ±7). */
export function DatePicker({
  value,
  onChange,
  flex = 0,
  onFlexChange,
  flexOptions = [0, 1, 3, 7],
  min,
  max,
  allowPast,
  heat,
  disabled,
  placeholder = "Pick a date",
  id,
  name,
  size = "md",
  clearable = true,
  weekStartsOn,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const minIso = min ?? (allowPast ? undefined : todayISO());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FieldTrigger id={id} size={size} disabled={disabled} placeholder={placeholder} className={className} hasValue={Boolean(value)}>
        {value && (
          <>
            <span className="truncate text-fg">{fmtShort(value)}</span>
            {onFlexChange && flex > 0 && (
              <span className="shrink-0 rounded-full bg-signal-soft px-1.5 py-0.5 font-mono text-[10.5px] tnum text-signal">±{flex}d</span>
            )}
          </>
        )}
      </FieldTrigger>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <PopoverContent align="start" className="w-auto p-3 sm:p-4">
        <Calendar
          selected={value}
          onSelect={(iso) => {
            onChange(iso);
            if (!onFlexChange) setOpen(false);
          }}
          min={minIso}
          max={max}
          heat={heat}
          weekStartsOn={weekStartsOn}
          showHeatLegend={Boolean(heat)}
        />
        {onFlexChange && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-panel-border pt-3">
            <span className="text-xs text-fg-subtle">Flexible</span>
            <SegmentedControl
              size="sm"
              value={String(flex)}
              onChange={(v) => onFlexChange(Number(v))}
              aria-label="Date flexibility"
              options={flexOptions.map((d) => ({ value: String(d), label: d === 0 ? "Exact" : `±${d}` }))}
            />
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-panel-border pt-3">
          <button
            type="button"
            onClick={() => {
              onChange(todayISO());
              if (!onFlexChange) setOpen(false);
            }}
            className={cn("rounded-full px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg", focusRing)}
          >
            Today
          </button>
          <div className="flex gap-1">
            {clearable && value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg", focusRing)}
              >
                Clear
              </button>
            )}
            {onFlexChange && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn("rounded-full bg-fg/8 px-3 py-1 text-xs font-medium text-fg transition-colors hover:bg-fg/12", focusRing)}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── DateRangePicker ──────────────────────────────────────────

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min?: string;
  max?: string;
  allowPast?: boolean;
  heat?: HeatMap;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  /** Show "· N nights" after the dates. */
  showNights?: boolean;
  numberOfMonths?: 1 | 2;
  size?: FieldSize;
  weekStartsOn?: 0 | 1;
  className?: string;
}

/** Check-in → check-out (or outbound → return). Two months on desktop, one on phones. */
export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  allowPast,
  heat,
  disabled,
  placeholder = "Pick dates",
  id,
  showNights,
  numberOfMonths = 2,
  size = "md",
  weekStartsOn,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const desktop = useIsDesktop();
  const minIso = min ?? (allowPast ? undefined : todayISO());
  const nights = value.from && value.to ? daysBetween(value.from, value.to) : null;

  const pick = (iso: string) => {
    if (!value.from || value.to) {
      onChange({ from: iso, to: null });
      return;
    }
    if (iso < value.from) {
      onChange({ from: iso, to: null });
      return;
    }
    onChange({ from: value.from, to: iso });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setHover(null);
      }}
    >
      <FieldTrigger id={id} size={size} disabled={disabled} placeholder={placeholder} className={className} hasValue={Boolean(value.from)}>
        {value.from && (
          <>
            <span className="truncate text-fg">{fmtShort(value.from)}</span>
            <span className="text-fg-subtle" aria-hidden="true">
              →
            </span>
            <span className={cn("truncate", value.to ? "text-fg" : "text-fg-subtle")}>{value.to ? fmtShort(value.to) : "…"}</span>
            {showNights && nights != null && nights > 0 && (
              <span className="hidden shrink-0 font-mono text-[11px] tnum text-fg-subtle sm:inline">
                · {nights} {nights === 1 ? "night" : "nights"}
              </span>
            )}
          </>
        )}
      </FieldTrigger>
      <PopoverContent align="start" className="w-auto p-3 sm:p-4">
        <Calendar
          selected={value}
          onSelect={pick}
          numberOfMonths={desktop ? numberOfMonths : 1}
          min={minIso}
          max={max}
          heat={heat}
          weekStartsOn={weekStartsOn}
          hoverDate={hover}
          onHoverDate={setHover}
          showHeatLegend={Boolean(heat)}
        />
        <div className="mt-3 flex items-center justify-between border-t border-panel-border pt-3 text-xs">
          <span className="text-fg-subtle" aria-live="polite">
            {!value.from ? "Pick a start date" : !value.to ? "Now pick an end date" : nights != null ? `${nights} ${nights === 1 ? "night" : "nights"}` : ""}
          </span>
          {value.from && (
            <button
              type="button"
              onClick={() => onChange({ from: null, to: null })}
              className={cn("rounded-full px-2.5 py-1 font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg", focusRing)}
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
