"use client";

import { ArrowRight, CalendarClock } from "lucide-react";
import type { TransferLink } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { focusRing } from "@/components/ui/tokens";
import { TransferDetails, type ProgramLite } from "./transfer-cell";
import { bonusDaysLeft, bonusDaysUntil, bonusElapsed, bonusState, fmtEffectiveRatio, fmtShortDate } from "./transfer-utils";

/** Every running or scheduled bonus, soonest to expire first, with a days-left bar. */
export function LiveBonuses({ links, programs, asOf }: { links: TransferLink[]; programs: Record<string, ProgramLite>; asOf: string }) {
  const rows = links
    .filter((l) => l.bonus && programs[l.from] && programs[l.to])
    .map((l) => ({ link: l, state: bonusState(l.bonus, asOf) }))
    .filter((r) => r.state === "active" || r.state === "upcoming")
    .sort((a, b) => a.link.bonus!.endsAt.localeCompare(b.link.bonus!.endsAt) || a.link.bonus!.startsAt.localeCompare(b.link.bonus!.startsAt));

  if (!rows.length) {
    return (
      <EmptyState
        compact
        illustration="none"
        icon={<CalendarClock />}
        title="No bonuses running"
        description="Banks run transfer bonuses a few times a year. Set an alert and we'll ping you when one lands."
      />
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-panel-border rounded-[var(--radius)] border border-panel-border bg-bg-elev-1">
      {rows.map(({ link, state }) => {
        const bank = programs[link.from];
        const dest = programs[link.to];
        const bonus = link.bonus!;
        const daysLeft = bonusDaysLeft(bonus, asOf);
        const until = bonusDaysUntil(bonus, asOf);
        const urgent = state === "active" && daysLeft <= 7;
        return (
          <li key={`${link.from}-${link.to}`}>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "grid w-full gap-x-4 gap-y-3 px-4 py-4 text-left transition-colors hover:bg-fg/[0.03] data-[state=open]:bg-fg/5 sm:grid-cols-[auto_1fr_auto] sm:items-center",
                    focusRing,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ProgramLogo id={bank.id} name={bank.shortName} color={bank.color} size={34} />
                    <ArrowRight className="size-4 text-fg-subtle" aria-hidden="true" />
                    <ProgramLogo id={dest.id} name={dest.shortName} color={dest.color} size={34} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-fg">
                        {bank.shortName} → {dest.name}
                      </span>
                      <Badge variant={state === "active" ? "aurora" : "sky"} size="sm" dot pulse={state === "active"}>
                        +{bonus.percent}%
                      </Badge>
                      <span className="font-mono text-xs tnum text-fg-subtle">{fmtEffectiveRatio(link, state === "active" ? asOf : bonus.startsAt)} effective</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-fg-muted">{bonus.note ?? `${fmtShortDate(bonus.startsAt)} – ${fmtShortDate(bonus.endsAt)}`}</p>
                    <div className="mt-2.5 max-w-md">
                      <Progress
                        value={state === "active" ? Math.round(bonusElapsed(bonus, asOf) * 100) : 0}
                        size="sm"
                        tone={urgent ? "rose" : state === "active" ? "aurora" : "sky"}
                        aria-label={`${bank.shortName} to ${dest.shortName} bonus window`}
                      />
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className={cn("font-mono tnum text-lg font-medium leading-none", urgent ? "text-rose" : "text-fg")}>
                      {state === "active" ? daysLeft : until}
                      <span className="ml-1 text-xs font-normal text-fg-subtle">{state === "active" ? (daysLeft === 1 ? "day left" : "days left") : until === 1 ? "day away" : "days away"}</span>
                    </div>
                    <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">
                      {state === "active" ? `ends ${fmtShortDate(bonus.endsAt)}` : `${fmtShortDate(bonus.startsAt)} – ${fmtShortDate(bonus.endsAt)}`}
                    </div>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[20rem]">
                <TransferDetails link={link} bank={bank} dest={dest} asOf={asOf} />
              </PopoverContent>
            </Popover>
          </li>
        );
      })}
    </ol>
  );
}
