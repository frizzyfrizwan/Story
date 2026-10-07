"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronDown, MapPin, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Airport } from "@/lib/types";
import { useFieldContext } from "./input";
import { Spinner } from "./spinner";
import { fieldSurface, floating, focusRing, menuItem, menuLabel, popIn } from "./tokens";

export type AirportFetcher = (query: string) => Promise<Airport[]> | Airport[];

export interface AirportComboboxProps {
  /** Selected IATA codes — or metro codes such as NYC when a whole area is picked. */
  value: string[];
  onChange: (codes: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  /** Returns matches for a query; an empty query should return default hubs. */
  fetcher: AirportFetcher;
  /** Accessible name — falls back to the surrounding <Field> label. */
  label?: string;
  id?: string;
  /** Emits one hidden input per selected code. */
  name?: string;
  disabled?: boolean;
  /** Max selections in `multiple` mode. */
  max?: number;
  size?: "md" | "lg";
  className?: string;
  emptyText?: string;
  /** Codes to list first while the query is empty. */
  recent?: string[];
}

/** What the control knows about a selected code — a real airport or a metro area. */
interface Place {
  code: string;
  city: string;
  country?: string;
  countryCode?: string;
  name?: string;
  hub?: boolean;
  metro?: boolean;
  members?: string[];
}

type Row = { kind: "metro"; code: string; members: Airport[] } | { kind: "airport"; airport: Airport; nested: boolean };

function flagOf(cc?: string): string {
  if (!cc || cc.length !== 2) return "";
  return cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const fromAirport = (a: Airport): Place => ({
  code: a.iata,
  city: a.city,
  country: a.country,
  countryCode: a.countryCode,
  name: a.name,
  hub: a.hub,
});

const fromMetro = (code: string, members: Airport[]): Place => ({
  code,
  city: members[0]?.city ?? code,
  country: members[0]?.country,
  countryCode: members[0]?.countryCode,
  metro: true,
  members: members.map((m) => m.iata),
});

/**
 * Airport picker: cmdk list inside a popover, IATA in mono, metro groups
 * (NYC → JFK/EWR/LGA), hub stars, chips for multi-select. Data comes from the
 * `fetcher` prop so this file never imports the airport table.
 */
export function AirportCombobox({
  value,
  onChange,
  multiple = false,
  placeholder = "City or airport",
  fetcher,
  label,
  id: idProp,
  name,
  disabled,
  max,
  size = "md",
  className,
  emptyText = "No airports match",
  recent,
}: AirportComboboxProps) {
  const field = useFieldContext();
  const autoId = useId();
  const id = idProp ?? field?.id ?? autoId;
  const listId = `${id}-list`;

  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<Record<string, Place>>({});

  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setQuery("");
  }, []);

  /** Cache airport + metro info so chips and the trigger can label codes. */
  const remember = useCallback((list: Airport[]) => {
    if (!list.length) return;
    setPlaces((prev) => {
      const next = { ...prev };
      const metros = new Map<string, Airport[]>();
      for (const a of list) {
        next[a.iata] = fromAirport(a);
        if (a.metro) metros.set(a.metro, [...(metros.get(a.metro) ?? []), a]);
      }
      for (const [code, members] of metros) {
        const known = next[code]?.members ?? [];
        const place = fromMetro(code, members);
        next[code] = { ...place, members: Array.from(new Set([...known, ...(place.members ?? [])])) };
      }
      return next;
    });
  }, []);

  // Search (debounced, stale-safe) while open.
  useEffect(() => {
    if (!open) return;
    const myId = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(
      async () => {
        try {
          const list = await fetcherRef.current(query.trim());
          if (myId !== requestId.current) return;
          setResults(list);
          remember(list);
        } catch {
          if (myId === requestId.current) setResults([]);
        } finally {
          if (myId === requestId.current) setLoading(false);
        }
      },
      query ? 120 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, open, remember]);

  // Resolve labels for codes we have not seen yet (initial values, recents).
  useEffect(() => {
    const wanted = Array.from(new Set([...value, ...(recent ?? [])])).filter((c) => !places[c]);
    if (!wanted.length) return;
    let cancelled = false;
    (async () => {
      for (const code of wanted) {
        let place: Place = { code, city: code };
        try {
          const list = await fetcherRef.current(code);
          const upper = code.toUpperCase();
          const exact = list.find((a) => a.iata.toUpperCase() === upper);
          const members = list.filter((a) => a.metro?.toUpperCase() === upper);
          if (exact) place = fromAirport(exact);
          else if (members.length) place = fromMetro(code, members);
        } catch {
          /* keep the bare code */
        }
        if (cancelled) return;
        setPlaces((prev) => (prev[code] ? prev : { ...prev, [code]: place }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, recent, places]);

  const isSelected = useCallback((code: string) => value.includes(code), [value]);
  const atMax = multiple && max != null && value.length >= max;

  const select = (code: string) => {
    if (multiple) {
      if (isSelected(code)) {
        onChange(value.filter((v) => v !== code));
        return;
      }
      if (atMax) return;
      onChange([...value, code]);
      setQuery("");
      inputRef.current?.focus();
    } else {
      onChange([code]);
      setOpen(false);
    }
  };
  const remove = (code: string) => onChange(value.filter((v) => v !== code));

  // Keep result order; hoist a metro header before its first member and nest members under it.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const a of results) {
      if (!a.metro) {
        out.push({ kind: "airport", airport: a, nested: false });
        continue;
      }
      if (seen.has(a.metro)) continue;
      seen.add(a.metro);
      const members = results.filter((m) => m.metro === a.metro);
      out.push({ kind: "metro", code: a.metro, members });
      for (const m of members) out.push({ kind: "airport", airport: m, nested: true });
    }
    return out;
  }, [results]);

  const recentPlaces = useMemo(
    () => (query ? [] : (recent ?? []).map((c) => places[c]).filter((p): p is Place => Boolean(p))),
    [query, recent, places],
  );

  const single = !multiple ? (value[0] ? (places[value[0]] ?? { code: value[0], city: "" }) : null) : null;
  const triggerClasses = cn(fieldSurface, size === "lg" ? "min-h-12 text-base" : "min-h-11 text-sm", className);
  const comboboxA11y = {
    role: "combobox" as const,
    "aria-expanded": open,
    "aria-haspopup": "listbox" as const,
    "aria-controls": open ? listId : undefined,
    "aria-label": label,
    "aria-describedby": field?.describedBy,
    "aria-invalid": field?.invalid || undefined,
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        {multiple ? (
          <div
            ref={anchorRef}
            data-disabled={disabled || undefined}
            className={cn(
              triggerClasses,
              "flex cursor-text flex-wrap items-center gap-1.5 py-1.5 pl-3 pr-2 focus-within:border-signal/60 focus-within:ring-[3px] focus-within:ring-signal/20 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            )}
            onClick={(e) => {
              if (disabled || (e.target as HTMLElement).closest("button")) return;
              setOpen(true);
            }}
          >
            <MapPin className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
            {value.map((code) => {
              const p = places[code];
              return (
                <span
                  key={code}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-panel-border-strong bg-bg-elev-2 pl-2.5 pr-1 text-xs text-fg animate-[rise_160ms_ease-out_both]"
                >
                  <span className="font-mono font-semibold tracking-wide">{code}</span>
                  {p?.metro && <span className="text-fg-subtle">all</span>}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => remove(code)}
                    aria-label={`Remove ${p?.city ? `${p.city} (${code})` : code}`}
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-fg/10 hover:text-fg",
                      focusRing,
                    )}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              id={id}
              disabled={disabled}
              {...comboboxA11y}
              onClick={() => setOpen(!open)}
              className="h-7 min-w-[8ch] flex-1 truncate text-left text-fg-subtle outline-none"
            >
              {value.length ? (atMax ? "" : "Add…") : placeholder}
            </button>
            <ChevronDown className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
          </div>
        ) : (
          <div ref={anchorRef} className="contents">
            <button
              type="button"
              id={id}
              disabled={disabled}
              {...comboboxA11y}
              onClick={() => setOpen(!open)}
              className={cn(
                triggerClasses,
                "flex items-center gap-2.5 px-3.5 text-left outline-none focus-visible:border-signal/60 focus-visible:ring-[3px] focus-visible:ring-signal/20 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <MapPin className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
              {single ? (
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="font-mono font-semibold tracking-wide text-fg">{single.code}</span>
                  <span className="truncate text-fg-muted">
                    {single.city}
                    {single.metro && " · all airports"}
                  </span>
                </span>
              ) : (
                <span className="flex-1 truncate text-fg-subtle">{placeholder}</span>
              )}
              <ChevronDown className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
            </button>
          </div>
        )}
      </PopoverPrimitive.Anchor>

      {name && value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className={cn(
            floating,
            "w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[var(--radius)] p-0 text-fg",
            popIn,
          )}
        >
          <Command shouldFilter={false} loop label={label ?? "Airports"} className="flex flex-col">
            <div className="flex items-center gap-2.5 border-b border-panel-border px-3.5">
              {loading ? (
                <Spinner size="sm" className="text-fg-subtle" label="" />
              ) : (
                <Search className="size-4 text-fg-subtle" aria-hidden="true" />
              )}
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder="Search city, airport or code"
                aria-label="Search airports"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !query && multiple && value.length) remove(value[value.length - 1]);
                }}
              />
              {multiple && max != null && (
                <span className="shrink-0 font-mono text-[10.5px] tnum text-fg-subtle">
                  {value.length}/{max}
                </span>
              )}
            </div>

            <Command.List
              id={listId}
              className="max-h-[min(340px,calc(var(--radix-popover-content-available-height)-48px))] overflow-y-auto overscroll-contain p-1.5 scrollbar-thin"
            >
              {!loading && rows.length === 0 && recentPlaces.length === 0 && (
                <Command.Empty className="px-3 py-8 text-center text-sm text-fg-subtle">
                  {query ? emptyText : "Type a city, airport or code"}
                </Command.Empty>
              )}

              {recentPlaces.length > 0 && (
                <Command.Group>
                  <div className={menuLabel} aria-hidden="true">
                    Recent
                  </div>
                  {recentPlaces.map((p) => (
                    <PlaceItem
                      key={`recent:${p.code}`}
                      value={`recent:${p.code}`}
                      code={p.code}
                      title={p.metro ? `${p.city} — all airports` : p.city}
                      subtitle={p.metro ? p.members?.join(" · ") : [p.name, p.country].filter(Boolean).join(" · ")}
                      flag={flagOf(p.countryCode)}
                      hub={p.hub}
                      selected={isSelected(p.code)}
                      onSelect={() => select(p.code)}
                    />
                  ))}
                </Command.Group>
              )}

              {rows.length > 0 && (
                <Command.Group>
                  <div className={menuLabel} aria-hidden="true">
                    {query ? "Airports" : "Popular hubs"}
                  </div>
                  {rows.map((row) =>
                    row.kind === "metro" ? (
                      <PlaceItem
                        key={`metro:${row.code}`}
                        value={`metro:${row.code}`}
                        code={row.code}
                        title={`${row.members[0]?.city ?? row.code} — all airports`}
                        subtitle={row.members.map((m) => m.iata).join(" · ")}
                        flag={flagOf(row.members[0]?.countryCode)}
                        metro
                        selected={isSelected(row.code)}
                        onSelect={() => select(row.code)}
                      />
                    ) : (
                      <PlaceItem
                        key={`airport:${row.airport.iata}`}
                        value={`airport:${row.airport.iata}`}
                        code={row.airport.iata}
                        title={row.airport.city}
                        subtitle={[row.airport.name, row.airport.country].filter(Boolean).join(" · ")}
                        flag={flagOf(row.airport.countryCode)}
                        hub={row.airport.hub}
                        nested={row.nested}
                        selected={isSelected(row.airport.iata)}
                        onSelect={() => select(row.airport.iata)}
                      />
                    ),
                  )}
                </Command.Group>
              )}
            </Command.List>

            {multiple && (
              <div className="flex items-center justify-between border-t border-panel-border px-3.5 py-2 text-[11px] text-fg-subtle">
                <span>{atMax ? `Maximum of ${max} selected` : "Enter to add · Backspace removes the last"}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg",
                    focusRing,
                  )}
                >
                  Done
                </button>
              </div>
            )}
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

interface PlaceItemProps {
  value: string;
  code: string;
  title: string;
  subtitle?: string;
  flag?: string;
  hub?: boolean;
  metro?: boolean;
  nested?: boolean;
  selected: boolean;
  onSelect: () => void;
}

function PlaceItem({ value, code, title, subtitle, flag, hub, metro, nested, selected, onSelect }: PlaceItemProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      aria-selected={selected}
      className={cn(menuItem, "cursor-pointer", nested && "pl-8")}
    >
      <span
        className={cn(
          "w-11 shrink-0 font-mono text-[13px] font-semibold tracking-wide",
          metro ? "text-sky" : "text-fg",
        )}
      >
        {code}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate">{title}</span>
        {subtitle && (
          <span className={cn("truncate text-xs text-fg-subtle", metro && "font-mono tracking-wide")}>{subtitle}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-fg-subtle">
        {flag && (
          <span aria-hidden="true" className="text-sm leading-none">
            {flag}
          </span>
        )}
        {hub && <Star className="size-3.5 fill-gold text-gold" aria-label="Major hub" />}
        {selected && <Check className="size-4 text-signal" aria-hidden="true" />}
      </span>
    </Command.Item>
  );
}
