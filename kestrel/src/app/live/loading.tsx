import { Skeleton, Spinner } from "@/components/ui";

/** Route-level skeleton: the map frame with its floating panels blocked in, plus the board slot. */
export default function LiveLoading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading live flights">
      <section className="relative h-[52dvh] min-h-[380px] overflow-hidden bg-bg-elev-1 dot-grid lg:h-[calc(100dvh-4rem)]">
        <div className="absolute left-3 top-3 hidden w-80 flex-col gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/80 p-4 lg:flex">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-12 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="absolute right-3 top-3 hidden items-center gap-4 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/80 px-4 py-3 lg:flex">
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-3 rounded-full border border-panel-border bg-bg-elev-1/90 px-4 py-2 text-sm text-fg-muted">
            <Spinner variant="radar" size="sm" className="text-aurora" label="" />
            Scanning airspace…
          </div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        <div className="rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
