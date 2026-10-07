"use client";

/**
 * The award search page, client side. The URL is the state: the form, filters and sort all
 * read from `useSearchParams` and write back with `router.replace` (query changes) or the
 * History API (client-only filters), so every search is shareable and the back button works.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select, SourceBadge, Spinner } from "@/components/ui";
import { PROGRAM_BY_ID, getProgram } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { ApiError, apiGet } from "@/lib/client/api";
import type { AwardFare, AwardSearchResponse, Balance } from "@/lib/types";
import { CABIN_LABEL } from "@/lib/types";
import { planPayment } from "@/lib/wallet/affordability";
import { cn, fmtDate, pluralize } from "@/lib/utils";
import { AlertDialog, type AlertPrefill } from "./alert-dialog";
import { AvailabilityPanel } from "./availability-strip";
import { applyFilters, computeFacets, searchStats, sortVisible, type VisibleResult } from "./derive";
import { NoResults, ResultsSkeleton, SearchError, SearchIdle } from "./empty-and-loading";
import { FilterRail, FilterSheet } from "./filters";
import { Results } from "./results";
import { SEARCH_FROM_ID, SearchForm, SearchSummaryBar } from "./search-form";
import {
  DEFAULT_FILTERS,
  SORT_KEYS,
  SORT_LABEL,
  countActiveFilters,
  hasRoute,
  parseSearchState,
  primaryPair,
  recordFromSearchParams,
  searchHref,
  serializeSearchState,
  toAwardQuery,
  type ResultFilters,
  type SearchQueryState,
  type SearchState,
  type SortKey,
} from "./search-params";

export interface SearchExperienceProps {
  /** Server-normalised query (including any `q` prefill). */
  initialQuery: SearchQueryState;
  initialText?: string;
  /** Server's YYYY-MM-DD, so client and server agree on defaults. */
  today: string;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable || el.closest("[role=dialog],[cmdk-root]") != null;
}

export function SearchExperience({ initialQuery, initialText, today }: SearchExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const state = useMemo<SearchState>(
    () => parseSearchState(recordFromSearchParams(sp), { today, fallback: initialQuery }),
    [sp, today, initialQuery],
  );
  const { query, filters } = state;
  const awardQuery = useMemo(() => toAwardQuery(query), [query]);

  // ─── URL writes ───────────────────────────────────────────────
  const replaceUrl = useCallback(
    (next: SearchState, mode: "route" | "shallow") => {
      const href = searchHref(next);
      if (mode === "shallow") {
        // Client-only filters: no server round trip; Next keeps useSearchParams in sync.
        window.history.replaceState(window.history.state, "", href);
      } else {
        router.replace(href, { scroll: false });
      }
    },
    [router],
  );
  const setQuery = useCallback(
    (nextQuery: SearchQueryState, q?: string) => replaceUrl({ query: nextQuery, filters: { ...filters, maxMiles: null }, q: q ?? "" }, "route"),
    [filters, replaceUrl],
  );
  const setFilters = useCallback((patch: Partial<ResultFilters>) => replaceUrl({ ...state, filters: { ...state.filters, ...patch } }, "shallow"), [state, replaceUrl]);
  const resetFilters = useCallback(() => replaceUrl({ ...state, filters: { ...DEFAULT_FILTERS, sort: state.filters.sort } }, "shallow"), [state, replaceUrl]);

  // A `q`-only link: canonicalise so the URL carries the parsed route.
  const canonicalised = useRef(false);
  useEffect(() => {
    if (canonicalised.current || !hasRoute(query)) return;
    canonicalised.current = true;
    if (!sp.get("from") || !sp.get("to")) {
      const href = searchHref(state);
      if (href !== `${pathname}?${sp.toString()}`) window.history.replaceState(window.history.state, "", href);
    }
  }, [query, sp, state, pathname]);

  // ─── Data ─────────────────────────────────────────────────────
  const search = useQuery({
    queryKey: ["awards", awardQuery],
    queryFn: ({ signal }) =>
      apiGet<AwardSearchResponse>(
        "/api/awards/search",
        {
          origin: awardQuery!.origin,
          destination: awardQuery!.destination,
          date: awardQuery!.date,
          cabin: awardQuery!.cabin,
          passengers: awardQuery!.passengers,
          flexDays: awardQuery!.flexDays,
          programs: awardQuery!.programs,
        },
        { signal },
      ),
    enabled: awardQuery != null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: ({ signal }) => apiGet<{ balances: Balance[] }>("/api/wallet", {}, { signal }),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const signedOut = wallet.error instanceof ApiError && wallet.error.unauthenticated;
  const balances: Balance[] | null = wallet.data?.balances ?? null;
  const walletInfo = { signedIn: Boolean(wallet.data) || (wallet.isError && !signedOut), hasBalances: (balances?.length ?? 0) > 0 };

  const isAffordable = useMemo(() => {
    if (!balances) return undefined;
    const cache = new Map<string, boolean>();
    const pax = Math.max(1, query.passengers);
    return (fare: AwardFare) => {
      const k = `${fare.programId}:${fare.miles}`;
      let v = cache.get(k);
      if (v === undefined) {
        v = planPayment(fare.programId, fare.miles * pax, balances, TRANSFER_LINKS, PROGRAM_BY_ID).affordable;
        cache.set(k, v);
      }
      return v;
    };
  }, [balances, query.passengers]);

  const results = useMemo(() => search.data?.results ?? [], [search.data]);
  const effectiveFilters = useMemo(() => (filters.afford && !isAffordable ? { ...filters, afford: false } : filters), [filters, isAffordable]);
  const visible = useMemo(() => sortVisible(applyFilters(results, effectiveFilters, { isAffordable }), filters.sort), [results, effectiveFilters, isAffordable, filters.sort]);
  const facets = useMemo(() => computeFacets(results, effectiveFilters, { isAffordable }), [results, effectiveFilters, isAffordable]);
  const activeFilters = countActiveFilters(effectiveFilters);
  const stats = searchStats(search.data);
  const pair = useMemo(() => primaryPair(query), [query]);
  const resetKey = JSON.stringify(awardQuery) + filters.sort;

  // ─── Alerts ───────────────────────────────────────────────────
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrefill, setAlertPrefill] = useState<AlertPrefill | null>(null);
  const openAlert = useCallback(
    (item?: VisibleResult) => {
      setAlertPrefill({
        origins: query.origin,
        destinations: query.destination,
        date: query.date,
        cabin: query.cabin,
        passengers: query.passengers,
        maxMiles: item?.best.miles,
        programs: query.programs.length ? query.programs : undefined,
      });
      setAlertOpen(true);
    },
    [query],
  );

  // ─── Sticky summary + keyboard ────────────────────────────────
  const formAnchor = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = formAnchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      rootMargin: "-72px 0px 0px 0px",
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const focusForm = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => document.getElementById(SEARCH_FROM_ID)?.focus(), 350);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
      e.preventDefault();
      focusForm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusForm]);

  // ─── Render ───────────────────────────────────────────────────
  const routeSet = awardQuery != null;
  const cardContext = useMemo(() => ({ query, balances, onAlert: (item: VisibleResult) => openAlert(item) }), [query, balances, openAlert]);
  const fetching = search.isFetching && search.data != null;
  const title = routeSet ? `${query.origin.join("/")} → ${query.destination.join("/")}` : "Search award seats";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <SearchSummaryBar query={query} visible={collapsed && routeSet} onEdit={focusForm} />

      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Award search</p>
          <h1 className="font-display text-3xl leading-none tracking-tight text-fg sm:text-4xl">{title}</h1>
          {routeSet && (
            <p className="mt-2 text-sm text-fg-muted">
              {CABIN_LABEL[query.cabin]} · {fmtDate(query.date)}
              {query.flexDays ? ` ±${query.flexDays} days` : ""} · {pluralize(query.passengers, "passenger")}
            </p>
          )}
        </div>
      </header>

      <div ref={formAnchor}>
        <SearchForm value={query} onSubmit={setQuery} initialText={state.q || initialText} loading={search.isPending && routeSet} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <FilterRail filters={effectiveFilters} facets={facets} activeCount={activeFilters} resultCount={visible.length} wallet={walletInfo} onChange={setFilters} onReset={resetFilters} />

        <div className="flex min-w-0 flex-col gap-4">
          {routeSet && pair && (
            <AvailabilityPanel
              origin={pair.origin}
              destination={pair.destination}
              cabin={query.cabin}
              date={query.date}
              today={today}
              onSelectDate={(date) => date !== query.date && setQuery({ ...query, date })}
            />
          )}

          {!routeSet ? (
            <div className="panel">
              <SearchIdle />
            </div>
          ) : search.isPending ? (
            <ResultsSkeleton />
          ) : search.isError ? (
            <div className="panel">
              <SearchError message={search.error instanceof Error ? search.error.message : "Something went wrong"} onRetry={() => search.refetch()} />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-fg" aria-live="polite">
                    {visible.length === results.length ? pluralize(visible.length, "itinerary", "itineraries") : `${visible.length} of ${pluralize(results.length, "itinerary", "itineraries")}`}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-fg-subtle">
                    {fetching ? <Spinner size="sm" label="Refreshing" /> : null}
                    <span className="tnum">
                      Searched {pluralize(stats.programs, "program")} in {stats.seconds}s
                    </span>
                    {search.data && <SourceBadge source={search.data.source} />}
                    {search.data?.providers.some((p) => p.error) && (
                      <span className="text-gold" title={search.data.providers.filter((p) => p.error).map((p) => `${p.id}: ${p.error}`).join("\n")}>
                        · a provider failed
                      </span>
                    )}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <FilterSheet filters={effectiveFilters} facets={facets} activeCount={activeFilters} resultCount={visible.length} wallet={walletInfo} onChange={setFilters} onReset={resetFilters} />
                  <Select<SortKey>
                    size="sm"
                    aria-label="Sort results"
                    value={filters.sort}
                    onValueChange={(sort) => setFilters({ sort })}
                    options={SORT_KEYS.map((k) => ({ value: k, label: SORT_LABEL[k] }))}
                    className="w-44"
                  />
                </div>
              </div>

              {query.programs.length > 0 && (
                <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                  Restricted to {query.programs.map((id) => getProgram(id)?.shortName ?? id).join(", ")} ·
                  <button type="button" onClick={() => setQuery({ ...query, programs: [] }, state.q || undefined)} className="text-sky underline-offset-2 hover:underline">
                    search every program
                  </button>
                </p>
              )}

              {visible.length === 0 ? (
                <div className={cn("panel", fetching && "opacity-60")}>
                  <NoResults state={state} filtered={results.length > 0} onClearFilters={resetFilters} onAlert={() => openAlert()} />
                </div>
              ) : (
                <Results items={visible} grouped={query.flexDays > 0} resetKey={resetKey} context={cardContext} stale={fetching} />
              )}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen} prefill={alertPrefill} />
      {/* Keep the serialised state referenced so a future shallow write always starts from the latest URL. */}
      <span hidden data-search-state={serializeSearchState(state)} />
    </div>
  );
}
