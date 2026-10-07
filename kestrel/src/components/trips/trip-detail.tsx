"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BedDouble, ExternalLink, Plane, Search, StickyNote, Trash2 } from "lucide-react";
import { CABIN_LABEL, type Cabin } from "@/lib/types";
import { cn, daysBetween, fmtDate, fmtInt, fmtUsd, pluralize } from "@/lib/utils";
import { ApiError, apiPost, buildQuery } from "@/lib/client/api";
import { Badge, CabinBadge, ProgramChip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { toast } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/tokens";
import { RouteLine } from "@/components/viz/boarding-pass";
import { isoDate, num, str, type TripItemView, type TripView } from "./types";

const CABIN_IDS: readonly string[] = ["economy", "premium", "business", "first"];
const isCabin = (v: unknown): v is Cabin => typeof v === "string" && CABIN_IDS.includes(v);

function safeDate(iso: string | undefined, opts?: Intl.DateTimeFormatOptions): string | undefined {
  if (!iso) return undefined;
  try {
    return fmtDate(iso, opts);
  } catch {
    return iso;
  }
}

/** One trip: grouped items, totals, add-note, remove, delete. Every mutation re-fetches from the server. */
export function TripDetail({ trip }: { trip: TripView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const flights = trip.items.filter((i) => i.kind === "flight");
  const hotels = trip.items.filter((i) => i.kind === "hotel");
  const notes = trip.items.filter((i) => i.kind === "note");

  function bail(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.unauthenticated) {
      window.location.assign(`/login?next=/trips/${trip.id}`);
      return;
    }
    toast.error(fallback, { description: err instanceof Error ? err.message : undefined });
  }

  async function removeItem(item: TripItemView) {
    setRemoving(item.id);
    try {
      await apiPost("/api/trips", { action: "remove", tripId: trip.id, itemId: item.id });
      toast.success("Removed from trip");
      startTransition(() => router.refresh());
    } catch (err) {
      bail(err, "Couldn't remove that item");
    } finally {
      setRemoving(null);
    }
  }

  async function addNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    setAddingNote(true);
    try {
      await apiPost("/api/trips", { action: "add", tripId: trip.id, kind: "note", payload: { text } });
      setNote("");
      toast.success("Note added");
      startTransition(() => router.refresh());
    } catch (err) {
      bail(err, "Couldn't add the note");
    } finally {
      setAddingNote(false);
    }
  }

  async function deleteTrip() {
    setDeleting(true);
    try {
      await apiPost("/api/trips", { action: "delete", tripId: trip.id });
      toast.success("Trip deleted", { description: trip.title });
      router.push("/trips");
      router.refresh();
    } catch (err) {
      bail(err, "Couldn't delete the trip");
      setDeleting(false);
    }
  }

  const created = safeDate(trip.createdAt.slice(0, 10), { year: "numeric", weekday: undefined });
  const updated = safeDate(trip.updatedAt.slice(0, 10), { year: "numeric", weekday: undefined });

  return (
    <div className={cn("flex flex-col gap-8 transition-opacity", pending && "opacity-70")} aria-busy={pending || undefined}>
      <header className="flex flex-col gap-4">
        <Link href="/trips" className={cn("inline-flex w-fit items-center gap-1.5 rounded-[6px] text-[13px] text-fg-muted hover:text-fg", focusRing)}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All trips
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Trip</p>
            <h1 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight text-fg sm:text-4xl balance-text">{trip.title}</h1>
            <p className="mt-2 text-[13px] text-fg-subtle">
              Created {created}
              {updated && updated !== created ? ` · updated ${updated}` : ""}
            </p>
            {trip.notes && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{trip.notes}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button href="/search" variant="secondary" size="sm" leading={<Search />}>
              Open search
            </Button>
            <Button type="button" variant="outline" size="sm" leading={<Trash2 />} className="border-rose/40 text-rose hover:bg-rose-soft" onClick={() => setDeleteOpen(true)}>
              Delete trip
            </Button>
          </div>
        </div>
      </header>

      <Totals trip={trip} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-8">
          <Group
            icon={<Plane />}
            title="Flights"
            count={flights.length}
            empty={
              <EmptyState
                compact
                illustration="none"
                icon={<Plane />}
                title="No flights saved"
                description="Save an award from search results and it lands here with its program and taxes."
                action={
                  <Button href="/search" variant="secondary" size="sm" leading={<Search />}>
                    Search awards
                  </Button>
                }
              />
            }
          >
            {flights.map((item) => (
              <FlightItem key={item.id} item={item} removing={removing === item.id} onRemove={() => removeItem(item)} />
            ))}
          </Group>

          <Group
            icon={<BedDouble />}
            title="Hotels"
            count={hotels.length}
            empty={
              <EmptyState
                compact
                illustration="none"
                icon={<BedDouble />}
                title="No stays saved"
                description="Hotel award quotes you save show their points, cash alternative and nights here."
                action={
                  <Button href="/hotels" variant="secondary" size="sm" leading={<Search />}>
                    Search hotels
                  </Button>
                }
              />
            }
          >
            {hotels.map((item) => (
              <HotelItem key={item.id} item={item} removing={removing === item.id} onRemove={() => removeItem(item)} />
            ))}
          </Group>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Panel as="div" eyebrow="Notes" title={notes.length ? pluralize(notes.length, "note") : "Notes"}>
            <form onSubmit={addNote} className="flex flex-col gap-3">
              <Field label="Add a note" labelHidden>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Transfer by Friday, call ANA to add the infant…"
                  maxLength={2000}
                  autoResize
                />
              </Field>
              <Button type="submit" size="sm" loading={addingNote} disabled={!note.trim()} leading={<StickyNote />} className="self-end">
                Add note
              </Button>
            </form>

            {notes.length > 0 && (
              <ul className="mt-5 flex flex-col gap-3 border-t border-panel-border pt-5">
                {notes.map((item) => (
                  <NoteItem key={item.id} item={item} removing={removing === item.id} onRemove={() => removeItem(item)} />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          size="sm"
          eyebrow="Delete trip"
          title={`Delete “${trip.title}”?`}
          description={`This removes the trip and its ${pluralize(trip.items.length, "saved item")}. The awards themselves aren't affected.`}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Keep it
              </Button>
              <Button type="button" variant="danger" onClick={deleteTrip} loading={deleting} leading={<Trash2 />}>
                Delete trip
              </Button>
            </>
          }
        />
      </Dialog>
    </div>
  );
}

// ─── Totals ───────────────────────────────────────────────────

function Totals({ trip }: { trip: TripView }) {
  const t = trip.totals;
  const totalPoints = t.byProgram.reduce((s, p) => s + p.points, 0);
  if (trip.items.length === 0) return null;

  return (
    <Panel as="div" eyebrow="Totals" title="What this trip needs" padding="md">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div>
          {t.byProgram.length === 0 ? (
            <p className="text-sm text-fg-muted">No points priced yet — saved items are missing program details.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {t.byProgram.map((p) => (
                <li key={p.programId} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-1 px-3 py-2">
                  <ProgramChip id={p.programId} name={p.name} color={p.color} size="sm" />
                  <span className="font-mono tnum text-sm font-medium text-fg">{fmtInt(p.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-1 sm:border-l sm:border-panel-border sm:pl-6">
          <Stat label="Points" value={fmtInt(totalPoints)} />
          <Stat label="Taxes & fees" value={fmtUsd(t.taxesUsd)} />
          {t.nights > 0 && <Stat label="Hotel nights" value={String(t.nights)} />}
          {t.hotelCashUsd > 0 && <Stat label="Hotel cash value" value={fmtUsd(t.hotelCashUsd)} />}
        </dl>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 font-mono tnum text-lg font-medium leading-none text-fg">{value}</dd>
    </div>
  );
}

// ─── Groups & items ───────────────────────────────────────────

function Group({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`group-${title}`}>
      <h2 id={`group-${title}`} className="flex items-center gap-2 font-display text-xl tracking-tight text-fg [&_svg]:size-4 [&_svg]:text-fg-subtle">
        {icon}
        {title}
        <span className="rounded-full bg-fg/8 px-2 py-0.5 font-mono text-[11px] tnum text-fg-subtle">{count}</span>
      </h2>
      {count === 0 ? <div className="panel mt-4">{empty}</div> : <ul className="mt-4 flex flex-col gap-3">{children}</ul>}
    </section>
  );
}

function RemoveButton({ removing, onRemove, label }: { removing: boolean; onRemove: () => void; label: string }) {
  return (
    <IconButton label={label} size="sm" onClick={onRemove} loading={removing} className="text-fg-subtle hover:text-rose">
      <Trash2 />
    </IconButton>
  );
}

function FlightItem({ item, removing, onRemove }: { item: TripItemView; removing: boolean; onRemove: () => void }) {
  const p = item.payload;
  const origin = str(p.origin)?.toUpperCase();
  const destination = str(p.destination)?.toUpperCase();
  const date = isoDate(p.date);
  const cabin = isCabin(p.cabin) ? p.cabin : undefined;
  const carrier = str(p.carrier)?.toUpperCase();
  const flightNumber = str(p.flightNumber);
  const miles = num(p.miles);
  const taxes = num(p.taxesUsd);
  const duration = num(p.durationMin);
  const seats = num(p.seats);
  const searchHref = `/search${buildQuery({ from: origin, to: destination, date, cabin })}`;

  return (
    <li className="panel grain p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-fg-muted">
          {carrier && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: item.meta.carrierColor ?? "var(--fg-subtle)" }} />
              <span className="text-fg">{item.meta.carrierName ?? carrier}</span>
              {flightNumber && <span className="font-mono text-fg-subtle">{carrier} {flightNumber}</span>}
            </span>
          )}
          {date && <span className="font-mono tnum">{safeDate(date, { year: "numeric" })}</span>}
          {cabin && <CabinBadge cabin={cabin} size="sm" />}
        </div>
        <RemoveButton removing={removing} onRemove={onRemove} label="Remove flight from trip" />
      </div>

      {origin && destination ? (
        <RouteLine
          origin={origin}
          destination={destination}
          durationMin={duration}
          carrierColor={item.meta.carrierColor}
          caption={[item.meta.originCity, item.meta.destinationCity].filter(Boolean).join(" → ") || undefined}
          className="mt-3"
        />
      ) : (
        <p className="mt-3 text-sm text-fg-muted">Route details weren&apos;t saved with this item.</p>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-panel-border pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {item.meta.programId && (
            <ProgramChip id={item.meta.programId} name={item.meta.programName ?? item.meta.programId} color={item.meta.programColor ?? "var(--fg-subtle)"} size="sm" />
          )}
          <span className="font-mono tnum text-sm text-fg">
            {miles != null ? `${fmtInt(miles)} pts` : "— pts"}
            <span className="text-fg-subtle"> + {taxes != null ? fmtUsd(taxes) : "—"}</span>
          </span>
          {seats != null && <span className="text-[12px] text-fg-subtle">{pluralize(seats, "seat")} when saved</span>}
          {cabin && <span className="sr-only">{CABIN_LABEL[cabin]}</span>}
        </div>
        <Link href={searchHref} className={cn("inline-flex items-center gap-1 rounded-[6px] text-[13px] font-medium text-sky hover:underline", focusRing)}>
          Open search <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

function HotelItem({ item, removing, onRemove }: { item: TripItemView; removing: boolean; onRemove: () => void }) {
  const p = item.payload;
  const name = str(p.name) ?? item.meta.hotelName ?? "Saved stay";
  const city = str(p.city) ?? item.meta.hotelCity;
  const checkIn = isoDate(p.checkIn);
  const checkOut = isoDate(p.checkOut);
  const nights = num(p.nights) ?? (checkIn && checkOut ? Math.max(0, daysBetween(checkIn, checkOut)) : undefined);
  const points = num(p.totalPoints);
  const perNight = num(p.pointsPerNight);
  const cash = num(p.totalCashUsd);
  const cpp = num(p.cpp);
  const searchHref = `/hotels${buildQuery({ city, checkIn, checkOut })}`;

  return (
    <li className="panel grain p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg leading-tight tracking-tight text-fg">{name}</h3>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {city ?? "Location not saved"}
            {checkIn && checkOut && (
              <>
                {" · "}
                <span className="font-mono tnum">
                  {safeDate(checkIn)} → {safeDate(checkOut)}
                </span>
                {nights != null && ` · ${pluralize(nights, "night")}`}
              </>
            )}
          </p>
        </div>
        <RemoveButton removing={removing} onRemove={onRemove} label="Remove hotel from trip" />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-panel-border pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {item.meta.programId && (
            <ProgramChip id={item.meta.programId} name={item.meta.programName ?? item.meta.programId} color={item.meta.programColor ?? "var(--fg-subtle)"} size="sm" />
          )}
          <span className="font-mono tnum text-sm text-fg">
            {points != null ? `${fmtInt(points)} pts` : "— pts"}
            {perNight != null && <span className="text-fg-subtle"> · {fmtInt(perNight)}/night</span>}
          </span>
          {cash != null && <span className="text-[13px] text-fg-muted">vs {fmtUsd(cash)} cash</span>}
          {cpp != null && (
            <Badge variant={cpp >= 1.5 ? "aurora" : "neutral"} size="sm">
              {cpp.toFixed(1)}¢ / pt
            </Badge>
          )}
        </div>
        <Link href={searchHref} className={cn("inline-flex items-center gap-1 rounded-[6px] text-[13px] font-medium text-sky hover:underline", focusRing)}>
          Open search <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

function NoteItem({ item, removing, onRemove }: { item: TripItemView; removing: boolean; onRemove: () => void }) {
  const p = item.payload;
  const text = str(p.text) ?? str(p.body) ?? str(p.note) ?? "(empty note)";
  const added = safeDate(item.addedAt.slice(0, 10));
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-1 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{text}</p>
        {added && <p className="mt-1.5 font-mono text-[11px] text-fg-subtle">{added}</p>}
      </div>
      <RemoveButton removing={removing} onRemove={onRemove} label="Remove note" />
    </li>
  );
}
