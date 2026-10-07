"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { BedDouble, Luggage, Plane, Plus, Search, StickyNote } from "lucide-react";
import { cn, fmtDate, parseISODate } from "@/lib/utils";
import { ApiError, apiPost } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/panel";
import { toast } from "@/components/ui/toast";
import type { TripSummary } from "./types";

function ago(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDistanceToNowStrict(d)} ago`;
}

/** Trips index: cards for each saved trip and a "New trip" dialog. Mutations refresh the server data. */
export function TripsBoard({ trips }: { trips: TripSummary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setTitleError("Give the trip a name.");
      return;
    }
    setCreating(true);
    setTitleError(null);
    try {
      const { trip } = await apiPost<{ trip: { id: string } }>("/api/trips", { action: "create", title: t, notes: notes.trim() });
      toast.success("Trip created", { description: t });
      setOpen(false);
      setTitle("");
      setNotes("");
      router.push(`/trips/${trip.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.unauthenticated) {
        window.location.assign("/login?next=/trips");
        return;
      }
      toast.error("Couldn't create the trip", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  const newTripButton = (
    <Button type="button" onClick={() => setOpen(true)} leading={<Plus />}>
      New trip
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Trips</p>
          <h1 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight text-fg sm:text-4xl">Your trip board</h1>
          <p className="mt-2 max-w-lg text-[15px] text-fg-muted pretty-text">
            Pin award seats, hotel stays and notes to a trip while you plan. Totals by program update as you add things.
          </p>
        </div>
        {trips.length > 0 && newTripButton}
      </header>

      {trips.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="No trips yet"
            description="Create one, then save flights and hotels to it from search results. Notes work too."
            action={newTripButton}
            secondaryAction={
              <Button href="/search" variant="secondary" leading={<Search />}>
                Search awards
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t, i) => {
            const total = t.counts.flight + t.counts.hotel + t.counts.note;
            return (
              <li key={t.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Card href={`/trips/${t.id}`} className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-panel-border bg-bg-elev-2 text-signal">
                      <Luggage className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-lg leading-tight tracking-tight text-fg">{t.title}</h2>
                      <p className="mt-0.5 text-[12px] text-fg-subtle">
                        Created {fmtDate(parseISODate(t.createdAt), { weekday: undefined, year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {t.notes && <p className="line-clamp-2 text-[13px] leading-relaxed text-fg-muted">{t.notes}</p>}

                  <dl className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                    <Count icon={<Plane />} label="flights" value={t.counts.flight} />
                    <Count icon={<BedDouble />} label="hotels" value={t.counts.hotel} />
                    <Count icon={<StickyNote />} label="notes" value={t.counts.note} />
                  </dl>

                  <p className="border-t border-panel-border pt-3 text-[12px] text-fg-subtle">
                    {total === 0 ? "Empty — add something from search" : `Updated ${ago(t.updatedAt)}`}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          eyebrow="New trip"
          title="Name the trip"
          description="You can rename it later. Notes are private to you."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" form="new-trip-form" loading={creating}>
                Create trip
              </Button>
            </>
          }
        >
          <form id="new-trip-form" onSubmit={create} className="flex flex-col gap-4">
            <Field label="Title" required error={titleError}>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(null);
                }}
                placeholder="Tokyo in cherry-blossom season"
                maxLength={120}
                autoFocus
              />
            </Field>
            <Field label="Notes" optional>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Who's going, what matters, dates in play…" maxLength={2000} />
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Count({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className={cn("flex items-center gap-1.5", value === 0 ? "text-fg-subtle" : "text-fg-muted")}>
      <dt className="[&_svg]:size-3.5">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd>
        <span className="font-mono tnum font-medium text-fg">{value}</span> {label}
      </dd>
    </div>
  );
}
