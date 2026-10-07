import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Size it with height and width utility classes. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("skeleton", className)} {...props} />;
}

const WIDTHS = ["100%", "92%", "76%", "96%", "68%", "84%"];

export interface SkeletonTextProps extends ComponentProps<"div"> {
  lines?: number;
  /** Width of the final line. */
  lastLineWidth?: string;
  lineClassName?: string;
}

/** A paragraph's worth of lines with natural, varied widths. */
export function SkeletonText({ lines = 3, lastLineWidth = "58%", lineClassName, className, ...props }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2.5", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn("skeleton h-3.5", lineClassName)}
          style={{ width: i === lines - 1 && lines > 1 ? lastLineWidth : WIDTHS[i % WIDTHS.length] }}
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps extends ComponentProps<"div"> {
  /** `boarding-pass` mirrors a result card; `stat` a StatTile; `row` a list row. */
  variant?: "boarding-pass" | "stat" | "row";
}

/** Placeholder shaped like the real thing so the page doesn't jump when data lands. */
export function SkeletonCard({ variant = "boarding-pass", className, ...props }: SkeletonCardProps) {
  if (variant === "stat") {
    return (
      <div
        aria-hidden="true"
        className={cn("rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5", className)}
        {...props}
      >
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-4 h-8 w-28" />
        <Skeleton className="mt-3 h-3 w-16" />
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div
        aria-hidden="true"
        className={cn("flex items-center gap-4 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 px-4 py-3", className)}
        {...props}
      >
        <Skeleton className="size-9 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn("overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1", className)}
      {...props}
    >
      <div className="flex items-center gap-3 px-5 pt-5">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="flex items-center gap-4 px-5 py-5">
        <div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-12" />
        </div>
        <div className="relative flex flex-1 items-center">
          <span className="h-px flex-1 bg-panel-border-strong" />
          <Skeleton className="mx-2 size-2 rounded-full" />
          <span className="h-px flex-1 bg-panel-border-strong" />
        </div>
        <div className="text-right">
          <Skeleton className="ml-auto h-8 w-16" />
          <Skeleton className="ml-auto mt-2 h-3 w-12" />
        </div>
      </div>
      <div className="relative flex items-center">
        <span className="size-5 shrink-0 -translate-x-1/2 rounded-full border border-panel-border bg-bg" />
        <span className="h-px flex-1 border-t border-dashed border-panel-border-strong" />
        <span className="size-5 shrink-0 translate-x-1/2 rounded-full border border-panel-border bg-bg" />
      </div>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex gap-4">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}
