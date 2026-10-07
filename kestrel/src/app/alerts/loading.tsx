import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-label="Loading alerts">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-4 h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          <SkeletonCard className="h-36" />
          <SkeletonCard className="h-36" />
          <SkeletonCard className="h-36" />
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-48" />
        </div>
      </div>
    </div>
  );
}
