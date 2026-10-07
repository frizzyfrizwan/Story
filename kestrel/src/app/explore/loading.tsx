import { Skeleton } from "@/components/ui/skeleton";

/** Explore skeleton: hero controls, tab bar, then a grid of postcard cards. */
export default function ExploreLoading() {
  return (
    <div aria-busy="true" aria-label="Loading explore">
      <div className="aurora-bg">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-10 w-3/4 max-w-lg" />
          <Skeleton className="mt-3 h-4 w-2/3 max-w-md" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-full sm:w-80" />
            <Skeleton className="h-11 w-72 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex gap-6 border-b border-panel-border py-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1">
              <Skeleton className="aspect-[16/8] w-full rounded-none" />
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
