import { CalendarDays, Clock, Zap } from "lucide-react";
import type { TransferLink } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TRANSFER_TIME_META } from "./transfer-utils";

/** Instant → aurora bolt, hours → sky clock, days → muted calendar. Server-safe. */
export function TransferTimeIcon({ time, className }: { time: TransferLink["transferTime"]; className?: string }) {
  const meta = TRANSFER_TIME_META[time];
  const Icon = meta.kind === "instant" ? Zap : meta.kind === "hours" ? Clock : CalendarDays;
  return (
    <Icon
      className={cn(
        "size-3.5 shrink-0",
        meta.kind === "instant" ? "text-aurora" : meta.kind === "hours" ? "text-sky" : "text-fg-subtle",
        className,
      )}
      aria-label={meta.label}
      role="img"
    />
  );
}
