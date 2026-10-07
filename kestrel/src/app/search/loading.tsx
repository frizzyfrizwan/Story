import { FormSkeleton, ResultsSkeleton } from "@/components/search/empty-and-loading";
import { Skeleton } from "@/components/ui/skeleton";

/** Route-level skeleton for /search: runway light, form, rail and four boarding passes. */
export default function SearchLoading() {
  return (
    <>
      <div role="progressbar" aria-label="Loading search" aria-busy="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0%,var(--signal)_40%,var(--gold)_60%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-64" />
        <FormSkeleton className="mt-5" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="panel hidden h-[32rem] lg:block" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
            <ResultsSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}
