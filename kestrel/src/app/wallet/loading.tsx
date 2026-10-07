import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12" aria-busy="true" aria-label="Loading wallet">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-4 h-11 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard variant="stat" />
        <SkeletonCard variant="stat" />
        <SkeletonCard variant="stat" />
        <SkeletonCard variant="stat" />
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard variant="row" className="h-32" />
          <SkeletonCard variant="row" className="h-32" />
          <SkeletonCard variant="row" className="h-32" />
          <SkeletonCard variant="row" className="h-32" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <SkeletonCard className="lg:col-span-2" />
        <SkeletonCard className="lg:col-span-3" />
      </div>
    </div>
  );
}
