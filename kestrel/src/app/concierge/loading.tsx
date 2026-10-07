import { Skeleton } from "@/components/ui/skeleton";

/** Concierge route skeleton: conversation column with hero placeholders, context rail on the right. */
export default function ConciergeLoading() {
  return (
    <>
      <div role="progressbar" aria-label="Loading concierge" aria-busy="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0%,var(--signal)_40%,var(--gold)_60%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10" aria-hidden="true">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between pb-2 pt-5 sm:pt-6">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>

          <div className="py-8 sm:py-12">
            <Skeleton className="mx-auto size-14 rounded-full" />
            <Skeleton className="mx-auto mt-6 h-3 w-24" />
            <Skeleton className="mx-auto mt-4 h-10 w-3/4 max-w-md" />
            <Skeleton className="mx-auto mt-3 h-4 w-2/3 max-w-sm" />
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-4">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="mt-4 h-3.5 w-2/3" />
                  <Skeleton className="mt-2.5 h-3 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-5/6" />
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {[36, 44, 28, 40, 32].map((w, i) => (
                <Skeleton key={i} className="h-9 rounded-full" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
          </div>

          <Skeleton className="h-24 rounded-[var(--radius-lg)]" />
        </div>

        <div className="hidden lg:block">
          <div className="mt-5 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-4 sm:mt-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-5 h-3 w-16" />
            <Skeleton className="mt-3 h-5 w-24 rounded-full" />
            <div className="hairline my-5" />
            <Skeleton className="h-3 w-14" />
            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="hairline my-5" />
            <Skeleton className="h-3 w-20" />
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-[var(--radius)]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
