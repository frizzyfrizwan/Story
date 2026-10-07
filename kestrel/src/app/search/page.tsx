import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchExperience } from "@/components/search/search-experience";
import { FormSkeleton, ResultsSkeleton } from "@/components/search/empty-and-loading";
import { fromAwardQuery, hasRoute, metadataTitle, parseSearchState, type ParamRecord, type SearchQueryState } from "@/components/search/search-params";
import { intentToQuery, parseIntentHeuristic } from "@/lib/ai/intent-heuristics";
import { CABIN_LABEL } from "@/lib/types";
import { todayISO } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<ParamRecord>;
}

/** Normalise the URL; when only `q` is present, parse the description into a route. */
function resolve(params: ParamRecord): { query: SearchQueryState; q: string; today: string } {
  const today = todayISO();
  const state = parseSearchState(params, { today });
  let query = state.query;
  if (!hasRoute(query) && state.q) {
    const intent = parseIntentHeuristic(state.q, { today });
    query = fromAwardQuery(intentToQuery(intent, today), query);
  }
  return { query, q: state.q, today };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { query } = resolve(await searchParams);
  const title = metadataTitle(query);
  const description = hasRoute(query)
    ? `${CABIN_LABEL[query.cabin]} award availability from ${query.origin.join("/")} to ${query.destination.join("/")} across every program that can book it.`
    : "Live award seat search across 40+ programs: fewest miles, lowest taxes, transfer partners and what your wallet can book.";
  return { title, description, openGraph: { title: `${title} · Kestrel`, description } };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { query, today } = resolve(await searchParams);
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchExperience initialQuery={query} today={today} />
    </Suspense>
  );
}

function SearchFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8" aria-busy="true">
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Award search</p>
      <h1 className="font-display text-3xl leading-none tracking-tight text-fg sm:text-4xl">Searching…</h1>
      <FormSkeleton className="mt-5" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="hidden lg:block" />
        <ResultsSkeleton />
      </div>
    </div>
  );
}
