import { Skeleton } from "@/components/ui/skeleton";
import { HotelCardSkeleton } from "@/components/hotels/hotel-card";

/** Route-level skeleton for /hotels and /hotels/[id]: runway light, search panel, card grid. */
export default function HotelsLoading() {
  return (
    <>
      <div
        role="progressbar"
        aria-label="Loading hotels"
        aria-busy="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
      >
        <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0%,var(--signal)_40%,var(--gold)_60%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:pt-12" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-2/3 max-w-md" />

        <div className="mt-6 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1.35fr_auto_auto] lg:items-end">
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-11 w-full" />
            </div>
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-11 w-full" />
            </div>
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-2 h-11 w-36" />
            </div>
            <Skeleton className="h-11 w-full rounded-full lg:w-28" />
          </div>
          <div className="mt-4 flex gap-2 border-t border-panel-border pt-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
        </div>

        <div className="mt-8 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-6">
          <div className="hidden rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 p-4 lg:block">
            <Skeleton className="h-5 w-16" />
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="mt-3 h-6 w-full" />
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-9 w-44 rounded-[var(--radius)]" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <HotelCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
