"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ProgramLogo } from "@/components/art";
import { Section } from "@/components/ui/panel";
import { focusRing } from "@/components/ui/tokens";
import { HOTEL_PROGRAMS } from "@/data/hotel-programs";
import { cn } from "@/lib/utils";
import { searchHotelAwardsAction } from "./actions";
import { CompareBar } from "./compare-bar";
import { ART_INK, ART_INK_MUTED, HotelArt } from "./hotel-art";
import { HotelsSearchForm, HotelsSearchSummary } from "./hotels-search-form";
import {
  COMPARE_MAX,
  countryName,
  hotelSearchHref,
  parseHotelSearchParams,
  programShort,
  searchKey,
  type CitySuggestion,
  type HotelResult,
  type HotelSearchParams,
} from "./model";
import { HotelResults } from "./results";

const DATE_FIELD_ID = "hotels-dates";

export interface HotelsExperienceProps {
  /** Query parsed from the URL on the server; the form starts from it. */
  initial: HotelSearchParams;
  popular: CitySuggestion[];
  signedIn: boolean;
}

/** Landing-page destination tiles. */
type IllustratedCity = CitySuggestion & { art: NonNullable<CitySuggestion["art"]> };

function PopularDestinations({ cities, onPick }: { cities: CitySuggestion[]; onPick: (city: string) => void }) {
  const tiles = cities.filter((c): c is IllustratedCity => c.art !== null);
  if (!tiles.length) return null;
  return (
    <Section
      eyebrow="Popular"
      title="Where points go furthest"
      description="Hand-picked cities with the deepest award inventory. Pick one and we'll price it a month out — change the dates after."
      className="mt-14"
    >
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((c, i) => (
          <li key={c.name} className="animate-rise" style={{ animationDelay: `${i * 50}ms` } as CSSProperties}>
            <button
              type="button"
              onClick={() => onPick(c.name)}
              aria-label={`${c.name}, ${countryName(c.countryCode)} — ${c.hotelCount} award hotels`}
              className={cn(
                "group/tile block w-full overflow-hidden rounded-[var(--radius-lg)] text-left transition-transform duration-200 hover:-translate-y-0.5",
                focusRing,
              )}
            >
              <HotelArt name={c.name} art={c.art} className="rounded-[var(--radius-lg)]">
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p
                    className={cn("font-display text-2xl italic leading-none tracking-tight sm:text-3xl", ART_INK)}
                    style={{ fontVariationSettings: '"SOFT" 80, "WONK" 1' }}
                  >
                    {c.name}
                  </p>
                  <p className={cn("mt-1.5 font-mono text-[10px] uppercase tracking-[0.26em]", ART_INK_MUTED)}>
                    {countryName(c.countryCode)} · {c.hotelCount} hotels
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/15 bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100"
                >
                  <ArrowUpRight className="size-4" />
                </span>
              </HotelArt>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ProgramStrip() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fg-subtle">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]">Priced in</span>
      {HOTEL_PROGRAMS.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5 text-fg-muted">
          <ProgramLogo id={p.id} name={p.name} color={p.color} size={20} />
          {programShort(p)}
        </span>
      ))}
    </div>
  );
}

/**
 * The hotel award search. The URL is the source of truth for the committed query
 * (`history.pushState` + `useSearchParams`), so back/forward works and the grid never remounts;
 * the form holds an uncommitted draft until "Search".
 */
export function HotelsExperience({ initial, popular, signedIn }: HotelsExperienceProps) {
  const searchParams = useSearchParams();
  const committed = useMemo(() => parseHotelSearchParams(searchParams), [searchParams]);
  const committedKey = searchKey(committed);
  const active = committed.city.trim().length >= 2;

  const [draft, setDraft] = useState<HotelSearchParams>(initial);
  useEffect(() => {
    setDraft(committed);
  }, [committed]);

  const search = useQuery({
    queryKey: ["hotels", "search", committedKey],
    queryFn: async () => {
      const r = await searchHotelAwardsAction(committed);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: active,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const commit = useCallback(
    (next: HotelSearchParams) => {
      const href = hotelSearchHref(next);
      setDraft(next);
      if (href !== `${window.location.pathname}${window.location.search}`) {
        window.history.pushState(null, "", href);
      } else {
        void search.refetch();
      }
    },
    [search],
  );

  // ── Compare tray: survives re-searches; quotes refresh when the same hotel is priced again.
  const [compareItems, setCompareItems] = useState<HotelResult[]>([]);
  useEffect(() => {
    const latest = search.data?.results;
    if (!latest) return;
    setCompareItems((items) =>
      items.map((item) => latest.find((r) => r.property.id === item.property.id) ?? item),
    );
  }, [search.data]);
  const compareIds = useMemo(() => compareItems.map((r) => r.property.id), [compareItems]);
  const toggleCompare = useCallback((r: HotelResult) => {
    setCompareItems((items) => {
      if (items.some((i) => i.property.id === r.property.id)) return items.filter((i) => i.property.id !== r.property.id);
      return items.length >= COMPARE_MAX ? items : [...items, r];
    });
  }, []);

  // ── Sticky summary once the form has scrolled off the top.
  const formRef = useRef<HTMLDivElement>(null);
  const [formOffscreen, setFormOffscreen] = useState(false);
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setFormOffscreen(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const tryOtherDates = useCallback(() => {
    scrollToForm();
    window.setTimeout(() => {
      const trigger = document.getElementById(DATE_FIELD_ID);
      trigger?.focus();
      trigger?.click();
    }, 350);
  }, [scrollToForm]);

  const pickCity = useCallback((city: string) => commit({ ...draft, city }), [commit, draft]);

  const cityTitle = search.data?.city?.name ?? committed.city;
  const errorMessage = search.error instanceof Error ? search.error.message : search.error ? String(search.error) : null;

  return (
    <div className={cn(!active && "aurora-bg")}>
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:pt-12">
        <header className={cn("max-w-3xl", active ? "mb-6" : "mb-8")}>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal">Hotel awards</p>
          {active ? (
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight sm:text-4xl balance-text">
              Hotel awards in <span className="text-gradient-signal">{cityTitle}</span>
            </h1>
          ) : (
            <>
              <h1 className="mt-3 font-display text-4xl leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl balance-text">
                Points or cash?
                <br />
                <span className="text-gradient-signal">Know before you book.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-fg-muted pretty-text sm:text-lg">
                Every award hotel in 55 cities, priced night by night in seven currencies and scored against
                what the same room costs in cash — so you spend points only where they beat your card.
              </p>
            </>
          )}
        </header>

        <div ref={formRef} className="scroll-mt-24">
          <HotelsSearchForm
            value={draft}
            onChange={setDraft}
            onSubmit={commit}
            loading={active && search.isFetching && !search.isPlaceholderData && !search.data}
            popular={popular}
            dateFieldId={DATE_FIELD_ID}
          />
        </div>

        {active ? (
          <>
            <HotelsSearchSummary query={committed} visible={formOffscreen} onEdit={scrollToForm} />
            <div className="mt-8">
              <HotelResults
                query={committed}
                data={search.data}
                loading={!search.data && search.isPending}
                fetching={search.isFetching && search.isPlaceholderData}
                error={errorMessage}
                signedIn={signedIn}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
                onPickCity={pickCity}
                onTryOtherDates={tryOtherDates}
                onRetry={() => void search.refetch()}
              />
            </div>
          </>
        ) : (
          <>
            <ProgramStrip />
            <PopularDestinations cities={popular} onPick={pickCity} />
          </>
        )}
      </div>

      <CompareBar
        items={compareItems}
        stay={committed}
        max={COMPARE_MAX}
        onRemove={(id) => setCompareItems((items) => items.filter((i) => i.property.id !== id))}
        onClear={() => setCompareItems([])}
      />
    </div>
  );
}
