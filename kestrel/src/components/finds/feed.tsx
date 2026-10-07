"use client";

/**
 * <Feed> — the community feed. Filters live in the URL (the server renders the first page for any
 * combination), TanStack Query owns pagination and optimistic state on the client.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ChevronDown, PenLine, Sparkles, X } from "lucide-react";
import { cn, fmtInt, pluralize } from "@/lib/utils";
import { CABINS, CABIN_LABEL, CABIN_SHORT, type Cabin, type Find } from "@/lib/types";
import { AIRLINE_PROGRAMS, HOTEL_LOYALTY_PROGRAMS, getProgram } from "@/data/programs";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select, type SelectOptionGroup } from "@/components/ui/select";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { focusRing } from "@/components/ui/tokens";
import { ProgramLogo } from "@/components/art/program-logo";
import { FindCard, TagChip } from "./find-card";
import { FEED_PAGE_SIZE } from "./format";
import { flattenFeed, useFeed, type FeedPage, type FeedParams, type FeedSort, type TrendingTag } from "./use-finds";

export interface FeedProps {
  initial: FeedPage;
  params: FeedParams;
}

type CabinFilter = Cabin | "all";

const CABIN_OPTIONS: { value: CabinFilter; label: string; shortLabel?: string; accent?: Cabin }[] = [
  { value: "all", label: "All cabins", shortLabel: "All" },
  ...CABINS.map((c) => ({ value: c, label: CABIN_LABEL[c], shortLabel: CABIN_SHORT[c], accent: c })),
];

const PROGRAM_OPTIONS: SelectOptionGroup[] = [
  {
    label: "Airline programs",
    options: AIRLINE_PROGRAMS.map((p) => ({
      value: p.id,
      label: p.shortName,
      description: p.name,
      icon: <ProgramLogo id={p.id} name={p.name} color={p.color} size={16} />,
    })),
  },
  {
    label: "Hotel programs",
    options: HOTEL_LOYALTY_PROGRAMS.map((p) => ({
      value: p.id,
      label: p.shortName,
      description: p.name,
      icon: <ProgramLogo id={p.id} name={p.name} color={p.color} size={16} />,
    })),
  },
];

export function feedHref(p: FeedParams): string {
  const sp = new URLSearchParams();
  if (p.sort && p.sort !== "new") sp.set("sort", p.sort);
  if (p.tag) sp.set("tag", p.tag);
  if (p.cabin) sp.set("cabin", p.cabin);
  if (p.programId) sp.set("programId", p.programId);
  const s = sp.toString();
  return s ? `/finds?${s}` : "/finds";
}

export function Feed({ initial, params }: FeedProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const feedParams: FeedParams = { ...params, limit: FEED_PAGE_SIZE };
  const query = useFeed(feedParams, initial);
  const items = useMemo(() => flattenFeed(query.data), [query.data]);
  const tags: TrendingTag[] = query.data?.pages[0]?.tags ?? initial.tags;
  const sort: FeedSort = params.sort ?? "new";
  const hasFilter = Boolean(params.tag || params.cabin || params.programId);
  const program = params.programId ? getProgram(params.programId) : undefined;

  const navigate = (next: FeedParams) => {
    startTransition(() => router.replace(feedHref(next), { scroll: false }));
  };

  const topFinders = useMemo(() => {
    const byId = new Map<string, { author: Find["author"]; count: number; likes: number }>();
    for (const f of items) {
      const cur = byId.get(f.author.id) ?? { author: f.author, count: 0, likes: 0 };
      cur.count += 1;
      cur.likes += f.likes;
      byId.set(f.author.id, cur);
    }
    return Array.from(byId.values())
      .sort((a, b) => b.count - a.count || b.likes - a.likes)
      .slice(0, 5);
  }, [items]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Community</p>
          <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl">Finds</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted pretty-text">
            Real redemptions from the community — what they booked, what it cost, and how.
          </p>
        </div>
        <Button href="/finds/new" size="md" leading={<PenLine />} className="sm:shrink-0">
          Share a find
        </Button>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        {/* ── Main column ──────────────────────────────── */}
        <div className="min-w-0">
          {/* Filter bar */}
          <div className="flex flex-col gap-3" role="group" aria-label="Filter finds">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={sort} onValueChange={(v) => navigate({ ...params, sort: v as FeedSort })}>
                <TabsList variant="pills" aria-label="Sort">
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="top">Top</TabsTrigger>
                </TabsList>
              </Tabs>
              <SegmentedControl<CabinFilter>
                size="sm"
                responsive
                aria-label="Cabin"
                value={params.cabin ?? "all"}
                onChange={(v) => navigate({ ...params, cabin: v === "all" ? undefined : v })}
                options={CABIN_OPTIONS}
              />
              <div className="w-full sm:ml-auto sm:w-56">
                <Select
                  size="sm"
                  aria-label="Program"
                  placeholder="Any program"
                  value={params.programId ?? "any"}
                  onValueChange={(v) => navigate({ ...params, programId: v === "any" ? undefined : v })}
                  options={[{ value: "any", label: "Any program" }, ...PROGRAM_OPTIONS]}
                />
              </div>
            </div>

            {tags.length > 0 && (
              <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {tags.map((t) => (
                  <TagChip
                    key={t.tag}
                    tag={t.tag}
                    size="md"
                    active={params.tag === t.tag}
                    href={feedHref({ ...params, tag: params.tag === t.tag ? undefined : t.tag })}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ ...params, tag: params.tag === t.tag ? undefined : t.tag });
                    }}
                    scroll={false}
                  />
                ))}
              </div>
            )}

            {hasFilter && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                <span>
                  Showing {pluralize(items.length, "find")}
                  {query.hasNextPage ? "+" : ""}
                  {params.tag && (
                    <>
                      {" "}
                      tagged <span className="font-mono text-fg">#{params.tag}</span>
                    </>
                  )}
                  {params.cabin && (
                    <>
                      {" "}
                      in <span className="text-fg">{CABIN_LABEL[params.cabin]}</span>
                    </>
                  )}
                  {program && (
                    <>
                      {" "}
                      via <span className="text-fg">{program.shortName}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => navigate({ sort: params.sort })}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full border border-panel-border px-2.5 text-xs text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
                    focusRing,
                  )}
                >
                  <X className="size-3" aria-hidden="true" /> Clear filters
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div
            className={cn("mt-6 flex flex-col gap-5 transition-opacity duration-200", pending && "opacity-60")}
            aria-busy={pending || query.isFetching}
          >
            {query.isPending ? (
              <FeedSkeleton />
            ) : items.length === 0 ? (
              <Panel padding="none">
                <EmptyState
                  title={hasFilter ? "Nothing here yet" : "No finds yet"}
                  description={
                    hasFilter
                      ? "No one has shared a redemption matching these filters. Widen the net or be the first."
                      : "Be the first to share a redemption you booked."
                  }
                  action={
                    <Button href="/finds/new" leading={<PenLine />}>
                      Share a find
                    </Button>
                  }
                  secondaryAction={
                    hasFilter ? (
                      <Button variant="ghost" onClick={() => navigate({ sort: params.sort })}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              </Panel>
            ) : (
              items.map((f, i) => <FindCard key={f.id} find={f} activeTag={params.tag} still={i >= FEED_PAGE_SIZE} />)
            )}
          </div>

          {query.hasNextPage && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="secondary"
                size="md"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
                trailing={<ChevronDown />}
              >
                Load more
              </Button>
            </div>
          )}
          {!query.hasNextPage && items.length > 0 && sort === "new" && (
            <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
              You&apos;ve reached the beginning
            </p>
          )}
        </div>

        {/* ── Right rail ───────────────────────────────── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5">
            <Panel eyebrow="Trending" title="Tags" padding="sm">
              {tags.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 12).map((t) => (
                    <li key={t.tag}>
                      <TagChip
                        tag={t.tag}
                        count={t.count}
                        active={params.tag === t.tag}
                        href={feedHref({ ...params, tag: params.tag === t.tag ? undefined : t.tag })}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate({ ...params, tag: params.tag === t.tag ? undefined : t.tag });
                        }}
                        scroll={false}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-subtle">Tags appear as people post.</p>
              )}
            </Panel>

            <Panel eyebrow="This page" title="Top finders" padding="sm">
              {topFinders.length ? (
                <ol className="flex flex-col">
                  {topFinders.map((t, i) => (
                    <li key={t.author.id}>
                      <Link
                        href={`/u/${t.author.handle}`}
                        className={cn(
                          "flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-fg/5",
                          focusRing,
                        )}
                      >
                        <span className="w-4 font-mono text-[11px] text-fg-subtle tnum">{i + 1}</span>
                        <Avatar seed={t.author.avatarSeed} name={t.author.name} size="sm" status={t.author.plan === "pro" ? "pro" : undefined} />
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-sm font-medium text-fg">{t.author.name}</span>
                          <span className="block truncate font-mono text-xs text-fg-subtle">@{t.author.handle}</span>
                        </span>
                        <span className="font-mono text-xs text-fg-muted tnum">
                          {fmtInt(t.count)} {t.count === 1 ? "find" : "finds"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-fg-subtle">No finders loaded yet.</p>
              )}
            </Panel>

            <Panel eyebrow="Post guidelines" title="What makes a great find" padding="sm" grain>
              <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-fg-muted">
                {[
                  "Share what you actually booked — route, cabin, program, miles and taxes.",
                  "Say how you found it: the alert, the transfer bonus, the date trick.",
                  "Tag the program and the sweet spot so others can search it.",
                  "Be kind. No referral links, no selling miles.",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Sparkles className="mt-1 size-3.5 shrink-0 text-signal" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Three card-shaped placeholders — used by the feed and the route-level loading UI. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="panel overflow-hidden rounded-[var(--radius-lg)]">
          <div className="flex items-center gap-3 px-5 pt-5 sm:px-6">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mx-5 mt-4 h-7 w-3/4 sm:mx-6" />
          <div className="mx-5 mt-4 flex items-center gap-4 rounded-[12px] border border-panel-border px-5 py-4 sm:mx-6">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-7 w-20" />
          </div>
          <div className="px-5 pt-4 sm:px-6">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="mt-2.5 h-3.5 w-11/12" />
            <Skeleton className="mt-2.5 h-3.5 w-2/3" />
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-panel-border px-5 py-3 sm:px-6">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Rail placeholder for the loading route. */
export function RailSkeleton() {
  return (
    <div className="hidden lg:flex lg:flex-col lg:gap-5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} variant="stat" className="h-40" />
      ))}
    </div>
  );
}
