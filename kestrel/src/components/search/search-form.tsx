"use client";

/**
 * The search bar: airports (metro-aware, up to three each), swap, date with ±flex, cabin,
 * passengers. A "Describe your trip" mode parses plain language into the same fields.
 * `SearchSummaryBar` is the compact sticky version shown once the form scrolls away.
 */

import { ArrowLeftRight, Pencil, Search, WandSparkles, X } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { AirportCombobox, Badge, Button, CabinBadge, CabinPicker, DatePicker, Field, IconButton, Kbd, NumberStepper, Spinner, Textarea } from "@/components/ui";
import { useIntentParser } from "@/lib/ai/client-hooks";
import type { IntentChip } from "@/lib/ai/intent-heuristics";
import { apiGet } from "@/lib/client/api";
import type { Airport, Cabin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MAX_AIRPORTS, fromAwardQuery, summarizeQuery, type SearchQueryState } from "./search-params";

const fetchAirports = (q: string) => apiGet<Airport[]>("/api/airports", { q, limit: 8 });

export const SEARCH_FROM_ID = "search-from";

export interface SearchFormProps {
  value: SearchQueryState;
  /** Fired on Search; `q` carries the description when the natural-language mode was used. */
  onSubmit: (next: SearchQueryState, q?: string) => void;
  /** Natural-language text the current search came from, if any. */
  initialText?: string;
  loading?: boolean;
  className?: string;
}

type Mode = "form" | "nl";

function chipVariant(kind: IntentChip["kind"]) {
  switch (kind) {
    case "origin":
    case "destination":
      return "sky" as const;
    case "program":
      return "gold" as const;
    case "constraint":
      return "outline" as const;
    default:
      return "neutral" as const;
  }
}

export function SearchForm({ value, onSubmit, initialText, loading, className }: SearchFormProps) {
  const id = useId();
  // Draft follows the URL-backed value; local edits are kept until the value changes.
  const key = JSON.stringify(value);
  const [draftState, setDraftState] = useState({ key, draft: value });
  const draft = draftState.key === key ? draftState.draft : value;
  const setDraft = (next: SearchQueryState) => setDraftState({ key, draft: next });
  const patch = (p: Partial<SearchQueryState>) => setDraft({ ...draft, ...p });

  const [mode, setMode] = useState<Mode>("form");
  const [text, setText] = useState(initialText ?? "");
  const [touched, setTouched] = useState(false);
  const parser = useIntentParser(text, { enabled: mode === "nl" });

  const originError = touched && draft.origin.length === 0 ? "Add at least one origin" : undefined;
  const destinationError = touched && draft.destination.length === 0 ? "Add at least one destination" : undefined;
  const dateError = touched && !draft.date ? "Pick a date" : undefined;

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!draft.origin.length || !draft.destination.length || !draft.date) return;
    onSubmit(draft);
  };

  const swap = () => patch({ origin: draft.destination, destination: draft.origin });

  // ─── Natural language ─────────────────────────────────────────
  const parsed = parser.query && parser.parsedText === text.trim() ? parser.query : null;
  const parsedReady = Boolean(parsed && parsed.origin.length && parsed.destination.length);
  const missing = parsed ? (!parsed.destination.length ? "Add a destination city or airport" : !parsed.origin.length ? "Add where you are flying from" : null) : null;

  const applyParsed = () => {
    if (!parsed) return;
    setDraft(fromAwardQuery(parsed, draft));
    setMode("form");
  };
  const submitNl = () => {
    if (!parsed || !parsedReady) return;
    onSubmit(fromAwardQuery(parsed, draft), text.trim());
  };
  const onTextKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitNl();
    }
  };

  return (
    <section className={cn("panel panel-strong grain p-4 sm:p-5", className)} aria-label="Search award flights">
      {mode === "form" ? (
        <form onSubmit={submitForm} noValidate>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(13rem,0.7fr)] md:items-start">
            <Field label="From" error={originError} id={SEARCH_FROM_ID}>
              <AirportCombobox
                id={SEARCH_FROM_ID}
                value={draft.origin}
                onChange={(origin) => patch({ origin })}
                multiple
                max={MAX_AIRPORTS}
                placeholder="City, airport or NYC"
                fetcher={fetchAirports}
                label="From"
              />
            </Field>
            <div className="flex justify-center md:pt-[26px]">
              <IconButton label="Swap origin and destination" variant="secondary" size="sm" onClick={swap} className="rotate-90 md:rotate-0">
                <ArrowLeftRight />
              </IconButton>
            </div>
            <Field label="To" error={destinationError} id={`${id}-to`}>
              <AirportCombobox
                id={`${id}-to`}
                value={draft.destination}
                onChange={(destination) => patch({ destination })}
                multiple
                max={MAX_AIRPORTS}
                placeholder="City, airport or TYO"
                fetcher={fetchAirports}
                label="To"
              />
            </Field>
            <Field label="Depart" error={dateError} id={`${id}-date`}>
              <DatePicker
                id={`${id}-date`}
                value={draft.date || null}
                onChange={(iso) => {
                  if (iso) patch({ date: iso });
                }}
                flex={draft.flexDays}
                onFlexChange={(flexDays) => patch({ flexDays })}
                clearable={false}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-3">
            <CabinPicker value={draft.cabin} onChange={(cabin: Cabin) => patch({ cabin })} size="md" />
            <NumberStepper label="Passengers" unit="pax" value={draft.passengers} onChange={(passengers) => patch({ passengers })} min={1} max={9} size="sm" />
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" leading={<WandSparkles className="text-violet" aria-hidden="true" />} onClick={() => setMode("nl")}>
                Describe your trip
              </Button>
              <Button type="submit" variant="primary" size="md" leading={<Search aria-hidden="true" />} loading={loading}>
                Search
              </Button>
            </div>
          </div>

          {initialText && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
              <WandSparkles className="size-3.5 text-violet" aria-hidden="true" />
              <span>
                From your description: <span className="text-fg-muted">“{initialText}”</span>
              </span>
              <button type="button" onClick={() => setMode("nl")} className="text-sky underline-offset-2 hover:underline">
                Edit
              </button>
            </p>
          )}
        </form>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-violet">
              <WandSparkles className="size-3.5" aria-hidden="true" />
              Describe your trip
            </p>
            <Button type="button" variant="ghost" size="sm" leading={<X aria-hidden="true" />} onClick={() => setMode("form")}>
              Back to the form
            </Button>
          </div>
          <Textarea
            autoFocus
            rows={2}
            autoResize
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onTextKey}
            placeholder="Business class to Tokyo in cherry blossom season for two, using Amex points, nonstop"
            aria-label="Describe your trip"
            className="mt-3 text-base"
          />
          <div className="mt-3 flex min-h-7 flex-wrap items-center gap-1.5" aria-live="polite">
            {parser.loading && <Spinner size="sm" className="text-fg-subtle" label="Reading your trip" />}
            {parser.chips.map((chip) =>
              chip.kind === "cabin" ? (
                <CabinBadge key={`${chip.kind}-${chip.value}`} cabin={chip.value as Cabin} size="md" />
              ) : (
                <Badge key={`${chip.kind}-${chip.value}`} variant={chipVariant(chip.kind)} size="md">
                  {chip.label}
                </Badge>
              ),
            )}
            {!parser.loading && parser.error && <span className="text-xs text-rose">{parser.error}</span>}
            {!parser.loading && missing && <span className="text-xs text-gold">{missing}</span>}
            {!parser.loading && !parser.chips.length && !parser.error && text.trim().length < 3 && (
              <span className="text-xs text-fg-subtle">We read places, dates, cabin, passengers, programs and constraints as you type.</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-fg-subtle">
              <Kbd>↵</Kbd> to search · <Kbd keys={["shift", "enter"]} /> for a new line
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={!parsed} onClick={applyParsed}>
                Fill the form
              </Button>
              <Button type="button" variant="primary" size="md" leading={<Search aria-hidden="true" />} disabled={!parsedReady} loading={loading} onClick={submitNl}>
                Search
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Sticky summary ─────────────────────────────────────────────

export interface SearchSummaryBarProps {
  query: SearchQueryState;
  visible: boolean;
  onEdit: () => void;
}

/** Fixed under the app header; slides in when the full form scrolls out of view. */
export function SearchSummaryBar({ query, visible, onEdit }: SearchSummaryBarProps) {
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 top-16 z-30 transition-[transform,opacity] duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="panel panel-strong flex items-center justify-between gap-3 py-1.5 pl-4 pr-1.5 shadow-panel">
          <button type="button" onClick={onEdit} className="min-w-0 flex-1 rounded-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            <span className="block truncate font-mono text-[13px] tnum text-fg">{summarizeQuery(query)}</span>
          </button>
          <Button size="sm" variant="secondary" leading={<Pencil aria-hidden="true" />} onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}
