"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { Balance, LoyaltyProgram } from "@/lib/types";
import { cn, fmtCpp, fmtInt, fmtUsd } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { focusRing } from "@/components/ui/tokens";
import { fmtShortDate } from "@/components/transfers/transfer-utils";
import { daysToExpiry } from "./wallet-utils";

export interface BalanceCardProps {
  balance: Balance;
  program: LoyaltyProgram | undefined;
  asOf: string;
  onSaveAmount: (amount: number) => Promise<unknown> | void;
  onEdit: () => void;
  onDelete: () => void;
  saving?: boolean;
}

export function BalanceCard({ balance, program, asOf, onSaveAmount, onEdit, onDelete, saving }: BalanceCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(balance.amount));
  const inputRef = useRef<HTMLInputElement>(null);
  const name = program?.name ?? balance.programId;
  const short = program?.shortName ?? balance.programId;
  const cpp = program?.valuationCpp ?? 1;
  const valueUsd = (balance.amount * cpp) / 100;
  const days = daysToExpiry(balance, asOf);
  const expiring = days != null && days <= 90;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const n = Math.round(Number(draft.replace(/[^0-9.]/g, "")));
    setEditing(false);
    if (!Number.isFinite(n) || n < 0 || n === balance.amount) {
      setDraft(String(balance.amount));
      return;
    }
    void onSaveAmount(n);
  };

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-[var(--radius)] border bg-bg-elev-1 p-4 shadow-panel transition-colors",
        expiring ? "border-rose/30" : "border-panel-border hover:border-panel-border-strong",
      )}
      aria-busy={saving || undefined}
    >
      <div className="flex items-start gap-3">
        <ProgramLogo id={balance.programId} name={short} color={program?.color} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-fg">{name}</h3>
          <p className="truncate text-xs text-fg-subtle">{program?.currency ?? "Unknown program"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Tooltip content="Edit status or expiry">
            <IconButton label={`Edit ${short}`} size="sm" onClick={onEdit}>
              <Pencil />
            </IconButton>
          </Tooltip>
          <Popover>
            <Tooltip content="Remove">
              <PopoverTrigger asChild>
                <IconButton label={`Remove ${short}`} size="sm" className="hover:text-rose">
                  <Trash2 />
                </IconButton>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent align="end" className="w-64">
              <p className="text-sm font-medium text-fg">Remove {short}?</p>
              <p className="mt-1 text-xs text-fg-muted">
                {fmtInt(balance.amount)} {program?.currency ?? "points"} will disappear from your reach and deals.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <PopoverClose asChild>
                  <Button variant="ghost" size="sm">
                    Keep
                  </Button>
                </PopoverClose>
                <PopoverClose asChild>
                  <Button variant="danger" size="sm" onClick={onDelete} leading={<Trash2 />}>
                    Remove
                  </Button>
                </PopoverClose>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              inputMode="numeric"
              aria-label={`${short} balance`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(String(balance.amount));
                  setEditing(false);
                }
              }}
              className={cn(
                "h-10 w-36 rounded-[var(--radius-sm)] border border-signal/60 bg-bg-elev-2 px-2.5 font-mono tnum text-2xl font-medium text-fg outline-none ring-[3px] ring-signal/20",
              )}
            />
            <IconButton label="Save" size="sm" type="submit" variant="ghost" className="text-aurora">
              <Check />
            </IconButton>
            <IconButton
              label="Cancel"
              size="sm"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDraft(String(balance.amount));
                setEditing(false);
              }}
            >
              <X />
            </IconButton>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(balance.amount));
              setEditing(true);
            }}
            className={cn(
              "-mx-1 rounded-[var(--radius-sm)] px-1 text-left font-mono tnum text-2xl font-medium leading-none text-fg transition-colors hover:bg-fg/6",
              focusRing,
            )}
            title="Click to edit"
          >
            {fmtInt(balance.amount)}
          </button>
        )}
        <div className="text-right">
          <div className="font-mono tnum text-sm text-fg-muted">{fmtUsd(valueUsd)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">@ {fmtCpp(cpp)}</div>
        </div>
      </div>

      {(balance.status || balance.expiresAt || balance.source !== "manual") && (
        <div className="flex flex-wrap items-center gap-1.5">
          {balance.status && (
            <Badge variant="gold" size="sm">
              {balance.status}
            </Badge>
          )}
          {balance.expiresAt && days != null && (
            <Badge variant={expiring ? "rose" : "outline"} size="sm" dot={expiring} pulse={expiring && days <= 30}>
              {days < 0 ? `Expired ${fmtShortDate(balance.expiresAt)}` : days === 0 ? "Expires today" : `Expires ${fmtShortDate(balance.expiresAt)} · ${days}d`}
            </Badge>
          )}
          {balance.source === "import" && (
            <Badge variant="neutral" size="sm" caps>
              CSV
            </Badge>
          )}
          {balance.source === "connected" && (
            <Badge variant="sky" size="sm" caps dot pulse>
              Synced
            </Badge>
          )}
        </div>
      )}
    </article>
  );
}
