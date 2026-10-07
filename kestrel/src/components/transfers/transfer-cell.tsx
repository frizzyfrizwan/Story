"use client";

import { ArrowRight, Search } from "lucide-react";
import type { Alliance, ProgramKind, TransferLink } from "@/lib/types";
import { cn, fmtInt } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { focusRing } from "@/components/ui/tokens";
import { TransferTimeIcon } from "./transfer-time-icon";
import {
  TRANSFER_TIME_META,
  bonusDaysLeft,
  bonusDaysUntil,
  bonusLabel,
  bonusState,
  exampleMath,
  fmtEffectiveRatio,
  fmtRatio,
  fmtShortDate,
  linkRatio,
} from "./transfer-utils";

/** The slice of a LoyaltyProgram the matrix needs — keeps the RSC payload small. */
export interface ProgramLite {
  id: string;
  name: string;
  shortName: string;
  color: string;
  kind: ProgramKind;
  alliance?: Alliance;
}

export function BonusPill({ link, asOf, className }: { link: TransferLink; asOf: string; className?: string }) {
  const state = bonusState(link.bonus, asOf);
  if (!link.bonus || state === "none" || state === "expired") return null;
  const label = state === "active" ? bonusLabel(link.bonus) : `+${link.bonus.percent}% ${fmtShortDate(link.bonus.startsAt)}`;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 font-mono text-[10px] tnum font-medium leading-none",
        state === "active" ? "border-aurora/30 bg-aurora-soft text-aurora" : "border-sky/30 bg-sky-soft text-sky",
        className,
      )}
      title={link.bonus.note}
    >
      {state === "active" && <span className="size-1 rounded-full bg-current" aria-hidden="true" />}
      {label}
    </span>
  );
}

/** Popover body shared by the desktop cell and the mobile row. */
export function TransferDetails({ link, bank, dest, asOf }: { link: TransferLink; bank: ProgramLite; dest: ProgramLite; asOf: string }) {
  const state = bonusState(link.bonus, asOf);
  const ex = exampleMath(link, 60_000, asOf);
  const effective = linkRatio(link, asOf);
  const base = link.ratio[1] / link.ratio[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <ProgramLogo id={bank.id} name={bank.shortName} color={bank.color} size={30} />
        <ArrowRight className="size-4 text-fg-subtle" aria-hidden="true" />
        <ProgramLogo id={dest.id} name={dest.shortName} color={dest.color} size={30} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">
            {bank.shortName} → {dest.shortName}
          </p>
          <p className="truncate text-xs text-fg-subtle">{dest.name}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Ratio</dt>
          <dd className="mt-0.5 font-mono tnum text-fg">
            {fmtRatio(link.ratio)}
            {state === "active" && <span className="ml-1.5 text-aurora">→ {fmtEffectiveRatio(link, asOf)}</span>}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Posting time</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1.5 text-fg">
            <TransferTimeIcon time={link.transferTime} />
            {TRANSFER_TIME_META[link.transferTime].label}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Minimum</dt>
          <dd className="mt-0.5 font-mono tnum text-fg">{fmtInt(link.minimum)} pts</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Bonus</dt>
          <dd className="mt-0.5 text-fg">
            {link.bonus && state !== "expired" && state !== "none" ? (
              <>
                <Badge variant={state === "active" ? "aurora" : "sky"} size="sm" dot pulse={state === "active"}>
                  +{link.bonus.percent}%
                </Badge>
                <span className="mt-1 block text-xs text-fg-muted">
                  {fmtShortDate(link.bonus.startsAt)} – {fmtShortDate(link.bonus.endsAt)} ·{" "}
                  {state === "active" ? `${bonusDaysLeft(link.bonus, asOf)} days left` : `starts in ${bonusDaysUntil(link.bonus, asOf)} days`}
                </span>
              </>
            ) : (
              <span className="text-fg-subtle">None running</span>
            )}
          </dd>
        </div>
      </dl>

      {link.bonus?.note && state === "active" && <p className="text-xs leading-relaxed text-fg-muted pretty-text">{link.bonus.note}</p>}

      <div className="rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-2 px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Example</p>
        <p className="mt-1 font-mono tnum text-sm text-fg">
          {fmtInt(ex.source)} {bank.shortName} <ArrowRight className="inline size-3.5 text-fg-subtle" aria-hidden="true" />{" "}
          <span className={state === "active" ? "text-aurora" : "text-fg"}>{fmtInt(ex.dest)}</span> {dest.shortName}
          {state === "active" && base !== effective && (
            <span className="ml-1 text-xs text-fg-subtle">(vs {fmtInt(Math.floor(ex.source * base))} without the bonus)</span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button href={`/search?programs=${dest.id}&from=JFK&cabin=business`} variant="primary" size="sm" leading={<Search />}>
          Search awards with {dest.shortName}
        </Button>
        <Button href={`/programs/${dest.id}`} variant="ghost" size="sm" trailing={<ArrowRight />}>
          {dest.shortName} program guide
        </Button>
      </div>
    </div>
  );
}

export function TransferCell({ link, bank, dest, asOf }: { link: TransferLink | undefined; bank: ProgramLite; dest: ProgramLite; asOf: string }) {
  if (!link) {
    return (
      <span className="grid min-h-14 place-items-center text-fg-faint" aria-label={`No transfer from ${bank.shortName} to ${dest.shortName}`}>
        —
      </span>
    );
  }
  const state = bonusState(link.bonus, asOf);
  const rich = link.ratio[1] / link.ratio[0] > 1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-2 transition-colors hover:bg-fg/6 data-[state=open]:bg-fg/8",
            focusRing,
          )}
          aria-label={`${bank.shortName} to ${dest.shortName}: ${fmtRatio(link.ratio)}, ${TRANSFER_TIME_META[link.transferTime].label}${
            state === "active" && link.bonus ? `, ${bonusLabel(link.bonus)}` : ""
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("font-mono tnum text-sm font-medium", rich ? "text-aurora" : "text-fg")}>
              {fmtRatio(link.ratio)}
            </span>
            <TransferTimeIcon time={link.transferTime} />
          </span>
          <BonusPill link={link} asOf={asOf} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[20rem]">
        <TransferDetails link={link} bank={bank} dest={dest} asOf={asOf} />
      </PopoverContent>
    </Popover>
  );
}
