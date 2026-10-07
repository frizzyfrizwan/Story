"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet } from "lucide-react";
import type { LoyaltyProgram } from "@/lib/types";
import { cn, fmtInt } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { CSV_EXAMPLE, parseCsvPreview } from "./wallet-utils";

export interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: LoyaltyProgram[];
  onImport: (csv: string) => Promise<unknown>;
  pending?: boolean;
}

export function ImportCsvDialog({ open, onOpenChange, programs, onImport, pending }: ImportCsvDialogProps) {
  const [csv, setCsv] = useState("");
  useEffect(() => {
    if (open) setCsv("");
  }, [open]);

  const rows = useMemo(() => parseCsvPreview(csv, programs), [csv, programs]);
  const ok = rows.filter((r) => r.resolved);
  const bad = rows.length - ok.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        eyebrow="Import"
        title="Paste balances as CSV"
        description="One program per line: program, amount, status, expiry. Program can be a Kestrel id, full name or short name."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={!ok.length}
              leading={<FileSpreadsheet />}
              onClick={async () => {
                await onImport(csv);
                onOpenChange(false);
              }}
            >
              Import {ok.length ? fmtInt(ok.length) : ""} {ok.length === 1 ? "balance" : "balances"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="CSV"
            labelAction={
              <button type="button" className="text-sky underline-offset-4 hover:underline" onClick={() => setCsv(CSV_EXAMPLE)}>
                Paste an example
              </button>
            }
          >
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder={"program,amount,status,expires\namex-mr,185400\nAeroplan,45200,25K"}
              className="font-mono text-xs leading-relaxed"
            />
          </Field>

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1">
              <div className="flex items-center justify-between border-b border-panel-border px-3 py-2 text-xs">
                <span className="font-mono uppercase tracking-[0.14em] text-fg-subtle">Preview</span>
                <span className="inline-flex items-center gap-2">
                  <Badge variant="aurora" size="sm" icon={<Check />}>
                    {ok.length} ready
                  </Badge>
                  {bad > 0 && (
                    <Badge variant="rose" size="sm" icon={<AlertTriangle />}>
                      {bad} unknown
                    </Badge>
                  )}
                </span>
              </div>
              <ul className="max-h-60 divide-y divide-panel-border overflow-y-auto scrollbar-thin">
                {rows.slice(0, 60).map((r) => (
                  <li key={r.line} className={cn("flex items-center gap-3 px-3 py-2 text-sm", !r.resolved && "bg-rose-soft/40")}>
                    {r.resolved ? (
                      <ProgramLogo id={r.resolved.id} name={r.resolved.shortName} color={r.resolved.color} size={24} />
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full border border-rose/40 text-rose">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {r.resolved ? (
                        <span className="text-fg">{r.resolved.name}</span>
                      ) : (
                        <span className="text-rose">
                          &ldquo;{r.program}&rdquo; <span className="text-fg-subtle">— not a known program, will be skipped</span>
                        </span>
                      )}
                    </span>
                    {r.status && (
                      <Badge variant="gold" size="sm">
                        {r.status}
                      </Badge>
                    )}
                    {r.expiresAt && (
                      <span className="font-mono text-[11px] text-fg-subtle">exp {r.expiresAt}</span>
                    )}
                    <span className="font-mono tnum text-fg">{fmtInt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
