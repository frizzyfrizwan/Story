import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Route-level loading UI: a runway-light progress bar at the top plus a page-shaped skeleton. */
export default function Loading() {
  return (
    <>
      <div
        role="progressbar"
        aria-label="Loading page"
        aria-busy="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
      >
        <div className="h-full w-full bg-[linear-gradient(90deg,transparent_0%,var(--signal)_40%,var(--gold)_60%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-10 w-2/3 max-w-md" />
        <Skeleton className="mt-3 h-4 w-1/2 max-w-sm" />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <SkeletonCard variant="stat" />
          <SkeletonCard variant="stat" />
          <SkeletonCard variant="stat" />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="hidden lg:block" />
          <SkeletonCard className="hidden lg:block" />
        </div>
      </div>
    </>
  );
}
