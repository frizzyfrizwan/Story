import { Skeleton } from "@/components/ui/skeleton";
import { FeedSkeleton, RailSkeleton } from "@/components/finds/feed";

/** Feed-shaped placeholder so the page doesn't jump when the first page lands. */
export default function FindsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12" aria-busy="true" aria-label="Loading finds">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-11 w-40" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-72 rounded-full" />
            <Skeleton className="h-9 w-56 rounded-[var(--radius)] sm:ml-auto" />
          </div>
          <div className="mt-3 flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-5">
            <FeedSkeleton />
          </div>
        </div>
        <RailSkeleton />
      </div>
    </div>
  );
}
