import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTrip, type TripItem } from "@/lib/repo/trips";
import { getAirline } from "@/data/airlines";
import { getAirport } from "@/data/airports";
import { getHotelProgram } from "@/data/hotel-programs";
import { getHotel } from "@/data/hotels";
import { getProgram } from "@/data/programs";
import { daysBetween } from "@/lib/utils";
import { TripDetail } from "@/components/trips/trip-detail";
import { isoDate, num, str, type ProgramTotal, type TripItemView, type TripView } from "@/components/trips/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return { title: "Trip" };
  const { id } = await params;
  const trip = await getTrip(session.user.id, id);
  return { title: trip ? trip.title : "Trip" };
}

function programInfo(id: string | undefined): { name: string; color: string } | null {
  if (!id) return null;
  const p = getProgram(id);
  if (p) return { name: p.shortName, color: p.color };
  const h = getHotelProgram(id);
  if (h) return { name: h.name, color: h.color };
  return null;
}

/** Turn a stored item into a view model with names/colours resolved from reference data. */
function enrich(raw: Partial<TripItem>): TripItemView | null {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  const kind = raw.kind === "flight" || raw.kind === "hotel" || raw.kind === "note" ? raw.kind : "note";
  const payload = raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : {};
  const view: TripItemView = { id: raw.id, kind, addedAt: typeof raw.addedAt === "string" ? raw.addedAt : "", payload, meta: {} };

  if (kind === "flight") {
    const origin = str(payload.origin);
    const destination = str(payload.destination);
    const carrier = str(payload.carrier);
    const programId = str(payload.programId);
    const airline = carrier ? getAirline(carrier) : undefined;
    const prog = programInfo(programId);
    view.meta = {
      originCity: origin ? getAirport(origin)?.city : undefined,
      destinationCity: destination ? getAirport(destination)?.city : undefined,
      carrierName: airline?.name,
      carrierColor: airline?.color,
      programId,
      programName: prog?.name,
      programColor: prog?.color,
    };
  } else if (kind === "hotel") {
    const propertyId = str(payload.propertyId);
    const hotel = propertyId ? getHotel(propertyId) : undefined;
    const programId = str(payload.programId) ?? hotel?.programId;
    const prog = programInfo(programId);
    view.meta = {
      hotelName: hotel?.name,
      hotelCity: hotel?.city,
      programId,
      programName: prog?.name,
      programColor: prog?.color,
    };
  }
  return view;
}

function totals(items: TripItemView[]): TripView["totals"] {
  const byProgram = new Map<string, ProgramTotal>();
  let taxesUsd = 0;
  let hotelCashUsd = 0;
  let nights = 0;

  const add = (programId: string | undefined, name: string | undefined, color: string | undefined, points: number | undefined) => {
    if (!programId || points == null || points <= 0) return;
    const cur = byProgram.get(programId) ?? { programId, name: name ?? programId, color: color ?? "var(--fg-subtle)", points: 0 };
    cur.points += points;
    byProgram.set(programId, cur);
  };

  for (const i of items) {
    if (i.kind === "flight") {
      add(i.meta.programId, i.meta.programName, i.meta.programColor, num(i.payload.miles));
      taxesUsd += num(i.payload.taxesUsd) ?? 0;
    } else if (i.kind === "hotel") {
      add(i.meta.programId, i.meta.programName, i.meta.programColor, num(i.payload.totalPoints));
      hotelCashUsd += num(i.payload.totalCashUsd) ?? 0;
      const ci = isoDate(i.payload.checkIn);
      const co = isoDate(i.payload.checkOut);
      nights += num(i.payload.nights) ?? (ci && co ? Math.max(0, daysBetween(ci, co)) : 0);
    }
  }

  return {
    byProgram: [...byProgram.values()].sort((a, b) => b.points - a.points),
    taxesUsd: Math.round(taxesUsd),
    hotelCashUsd: Math.round(hotelCashUsd),
    nights,
  };
}

export default async function TripPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=${encodeURIComponent(`/trips/${id}`)}`);

  const trip = await getTrip(session.user.id, id);
  if (!trip) notFound();

  const rawItems = Array.isArray(trip.items) ? (trip.items as Partial<TripItem>[]) : [];
  const items = rawItems.map(enrich).filter((i): i is TripItemView => i !== null);

  const view: TripView = {
    id: trip.id,
    title: trip.title,
    notes: trip.notes ?? "",
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    items,
    totals: totals(items),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <TripDetail trip={view} />
    </div>
  );
}
