"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Pencil, Search, Users } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ProgramLogo } from "@/components/art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker, type DateRange } from "@/components/ui/date-picker";
import { Field, Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { NumberStepper } from "@/components/ui/stepper";
import { focusRing, menuItem, menuLabel } from "@/components/ui/tokens";
import { HOTEL_PROGRAMS } from "@/data/hotel-programs";
import { apiGet } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { CityThumb } from "./hotel-art";
import {
  countryName,
  flagEmoji,
  fmtNights,
  nightsOf,
  programShort,
  stayLabel,
  toggleIn,
  type CitySuggestion,
  type HotelSearchParams,
} from "./model";

// ─── City combobox ────────────────────────────────────────────

interface CityComboboxProps {
  value: string;
  onChange: (city: string) => void;
  /** Suggestions while the box is empty. */
  popular: CitySuggestion[];
  id?: string;
}

/**
 * Popover + Input combobox over /api/hotels/cities. Keyboard: ↑↓ move, Enter picks (or submits
 * the form when nothing is highlighted), Esc closes. Popular cities show while the box is empty.
 */
function CityCombobox({ value, onChange, popular, id }: CityComboboxProps) {
  const listId = `${useId()}-cities`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);

  const q = useDeferredValue(value.trim());
  const { data: fetched, isFetching } = useQuery({
    queryKey: ["hotel-cities", q.toLowerCase()],
    queryFn: () => apiGet<CitySuggestion[]>("/api/hotels/cities", { q }),
    enabled: open && q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });

  const options = q.length > 0 ? (fetched ?? []) : popular;
  const exact = options.find((c) => c.name.toLowerCase() === q.toLowerCase());
  const showList = open && (options.length > 0 || q.length > 0);
  const highlighted = open ? options[active] : undefined;

  const select = (c: CitySuggestion) => {
    onChange(c.name);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((a) => Math.min(a + 1, Math.max(0, options.length - 1)));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Enter":
        if (open && highlighted && !exact) {
          e.preventDefault();
          select(highlighted);
        } else if (open) {
          setOpen(false);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef}>
          <Input
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showList && highlighted ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="City, airport or country"
            leading={<MapPin aria-hidden="true" />}
            trailing={isFetching ? <Spinner size="sm" label="" /> : undefined}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        matchTrigger
        className="min-w-[320px] max-w-[calc(100vw-24px)] overflow-hidden p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div className={menuLabel} aria-hidden="true">
          {q ? "Cities" : "Popular destinations"}
        </div>
        {options.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-fg-subtle">
            {isFetching ? "Searching…" : `No city called “${q}” yet — search anyway and we'll suggest the nearest.`}
          </p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Cities" className="max-h-[min(360px,60vh)] overflow-y-auto scrollbar-thin">
            {options.map((c, i) => (
              <li
                key={c.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(c)}
                className={cn(menuItem, "cursor-pointer")}
              >
                <CityThumb name={c.name} art={c.art} className="w-12" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="font-medium text-fg">{c.name}</span>
                    <span aria-hidden="true" className="text-xs">
                      {flagEmoji(c.countryCode)}
                    </span>
                  </span>
                  <span className="truncate text-xs text-fg-subtle">
                    {countryName(c.countryCode)} · <span className="font-mono tracking-wide">{c.airport}</span> ·{" "}
                    {c.hotelCount} {c.hotelCount === 1 ? "hotel" : "hotels"}
                  </span>
                </span>
                {c.resort && (
                  <Badge variant="gold" size="sm" caps>
                    Resort
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Program chips ────────────────────────────────────────────

function ProgramChips({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const chip = (selected: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-[13px] font-medium transition-colors",
      selected
        ? "border-signal/40 bg-signal-soft text-fg"
        : "border-panel-border bg-bg-elev-1 text-fg-muted hover:border-panel-border-strong hover:text-fg",
      focusRing,
    );
  return (
    <div role="group" aria-label="Programs" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={value.length === 0}
        onClick={() => onChange([])}
        className={cn(chip(value.length === 0), "pl-3")}
      >
        All programs
      </button>
      {HOTEL_PROGRAMS.map((p) => {
        const selected = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(toggleIn(value, p.id))}
            className={chip(selected)}
          >
            <ProgramLogo id={p.id} name={p.name} color={p.color} size={22} />
            {programShort(p)}
          </button>
        );
      })}
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────

export interface HotelsSearchFormProps {
  value: HotelSearchParams;
  onChange: (next: HotelSearchParams) => void;
  onSubmit: (value: HotelSearchParams) => void;
  loading?: boolean;
  popular: CitySuggestion[];
  /** Id of the date trigger so other views can open it ("Try other dates"). */
  dateFieldId?: string;
  className?: string;
}

/** City · dates · guests · programs, in one glass panel. */
export function HotelsSearchForm({
  value,
  onChange,
  onSubmit,
  loading,
  popular,
  dateFieldId,
  className,
}: HotelsSearchFormProps) {
  const cityId = useId();
  const [range, setRange] = useState<DateRange>({ from: value.checkIn, to: value.checkOut });
  const [error, setError] = useState<string | null>(null);

  // Keep the picker in step when the committed query changes from outside (back/forward, chips).
  useEffect(() => {
    setRange({ from: value.checkIn, to: value.checkOut });
  }, [value.checkIn, value.checkOut]);

  const nights = range.from && range.to ? nightsOf({ checkIn: range.from, checkOut: range.to, guests: 1 }) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.city.trim().length < 2) {
      setError("Where are you headed?");
      document.getElementById(cityId)?.focus();
      return;
    }
    if (!range.from || !range.to) {
      setError("Pick check-in and check-out dates.");
      document.getElementById(dateFieldId ?? "")?.focus();
      return;
    }
    setError(null);
    onSubmit({ ...value, city: value.city.trim(), checkIn: range.from, checkOut: range.to });
  };

  return (
    <Panel as="form" strong grain padding="md" className={cn("overflow-visible", className)} onSubmit={submit} aria-label="Hotel award search">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.35fr)_auto_auto] lg:items-end">
        <Field label="Where" id={cityId} error={error && error.startsWith("Where") ? error : undefined}>
          <CityCombobox
            id={cityId}
            value={value.city}
            onChange={(city) => {
              setError(null);
              onChange({ ...value, city });
            }}
            popular={popular}
          />
        </Field>
        <Field
          label="Dates"
          hint={nights ? fmtNights(nights) : undefined}
          error={error && error.startsWith("Pick") ? error : undefined}
        >
          <DateRangePicker
            id={dateFieldId}
            value={range}
            showNights
            placeholder="Check-in → check-out"
            onChange={(r) => {
              setRange(r);
              setError(null);
              if (r.from && r.to) onChange({ ...value, checkIn: r.from, checkOut: r.to });
            }}
          />
        </Field>
        <Field label="Guests">
          <NumberStepper
            label="Guests"
            value={value.guests}
            onChange={(guests) => onChange({ ...value, guests })}
            min={1}
            max={6}
            unit={value.guests === 1 ? "guest" : "guests"}
          />
        </Field>
        <Button type="submit" size="md" leading={<Search />} loading={loading} className="w-full lg:w-auto">
          Search
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-panel-border pt-4 sm:flex-row sm:items-center sm:gap-4">
        <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">Price in</span>
        <ProgramChips value={value.programs} onChange={(programs) => onChange({ ...value, programs })} />
      </div>
    </Panel>
  );
}

// ─── Sticky summary ───────────────────────────────────────────

export interface HotelsSearchSummaryProps {
  query: HotelSearchParams;
  visible: boolean;
  onEdit: () => void;
}

/** Compact bar that takes over once the form has scrolled away. Occupies no layout space. */
export function HotelsSearchSummary({ query, visible, onEdit }: HotelsSearchSummaryProps) {
  const nights = nightsOf(query);
  return (
    <div className="sticky top-[4.25rem] z-30 h-0" aria-hidden={!visible}>
      <div
        className={cn(
          "panel panel-strong mx-auto flex h-12 max-w-3xl items-center gap-2 pl-4 pr-1.5 text-sm transition-[opacity,transform] duration-200",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <MapPin className="size-4 shrink-0 text-signal" aria-hidden="true" />
        <span className="truncate font-medium text-fg">{query.city}</span>
        <span className="hidden text-fg-faint sm:inline" aria-hidden="true">
          ·
        </span>
        <Calendar className="hidden size-4 shrink-0 text-fg-subtle sm:block" aria-hidden="true" />
        <span className="hidden truncate font-mono text-[13px] tnum text-fg-muted sm:inline">
          {stayLabel(query, { short: true })}
        </span>
        <span className="hidden text-fg-subtle md:inline">· {fmtNights(nights)}</span>
        <span className="hidden text-fg-faint md:inline" aria-hidden="true">
          ·
        </span>
        <Users className="hidden size-4 shrink-0 text-fg-subtle md:block" aria-hidden="true" />
        <span className="hidden font-mono text-[13px] tnum text-fg-muted md:inline">{query.guests}</span>
        <Button size="sm" variant="secondary" leading={<Pencil />} onClick={onEdit} className="ml-auto" tabIndex={visible ? 0 : -1}>
          Edit
        </Button>
      </div>
    </div>
  );
}
