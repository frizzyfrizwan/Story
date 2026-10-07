"use client";

import { useEffect, useMemo, useState } from "react";
import type { Balance, LoyaltyProgram } from "@/lib/types";
import { fmtInt } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select, type SelectOptionGroup } from "@/components/ui/select";
import { KIND_META, KIND_ORDER } from "@/components/programs/program-meta";
import type { UpsertBalanceInput } from "./use-wallet";

export interface AddBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: LoyaltyProgram[];
  /** Pre-fill to edit an existing balance (program locked). */
  initial?: Balance | null;
  onSubmit: (input: UpsertBalanceInput) => Promise<unknown>;
  pending?: boolean;
}

export function AddBalanceDialog({ open, onOpenChange, programs, initial, onSubmit, pending }: AddBalanceDialogProps) {
  const [programId, setProgramId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProgramId(initial?.programId ?? "");
    setAmount(initial ? String(initial.amount) : "");
    setStatus(initial?.status ?? "");
    setExpiresAt(initial?.expiresAt ?? null);
    setError(null);
  }, [open, initial]);

  const groups = useMemo<SelectOptionGroup<string>[]>(
    () =>
      KIND_ORDER.map((kind) => ({
        label: KIND_META[kind].plural,
        options: programs
          .filter((p) => p.kind === kind)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => ({
            value: p.id,
            label: p.name,
            description: p.currency,
            icon: <ProgramLogo id={p.id} name={p.shortName} color={p.color} size={16} />,
          })),
      })),
    [programs],
  );

  const parsedAmount = Math.round(Number(amount.replace(/[^0-9.]/g, "")));
  const valid = programId && Number.isFinite(parsedAmount) && parsedAmount >= 0 && amount.trim() !== "";
  const selected = programs.find((p) => p.id === programId);

  const submit = async () => {
    if (!valid) {
      setError(!programId ? "Pick a program" : "Enter a whole number of points");
      return;
    }
    await onSubmit({
      programId,
      amount: parsedAmount,
      status: status.trim() || undefined,
      expiresAt: expiresAt ?? undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow={initial ? "Edit balance" : "Add balance"}
        title={initial ? `Update ${selected?.shortName ?? "balance"}` : "Add points to your wallet"}
        description="Balances are private and power the reach and bookable-now panels."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={pending} disabled={!valid}>
              {initial ? "Save changes" : "Add balance"}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Program" required>
            <Select<string>
              value={programId}
              onValueChange={(v) => {
                setProgramId(v);
                setError(null);
              }}
              options={groups}
              placeholder="Choose a program…"
              disabled={Boolean(initial)}
              aria-label="Program"
            />
          </Field>
          <Field label="Balance" required error={error} hint={valid ? `${fmtInt(parsedAmount)} ${selected?.currency ?? "points"}` : "Whole points or miles"}>
            <Input
              mono
              inputMode="numeric"
              autoComplete="off"
              placeholder="185400"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="normal-case tracking-normal"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Elite status" optional hint="e.g. 25K, MVP Gold, Globalist">
              <Input value={status} maxLength={40} onChange={(e) => setStatus(e.target.value)} placeholder="None" />
            </Field>
            <Field label="Expiry" optional hint="Leave blank if points never expire">
              <DatePicker value={expiresAt} onChange={setExpiresAt} allowPast placeholder="No expiry" />
            </Field>
          </div>
          <button type="submit" className="sr-only">
            Save
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
