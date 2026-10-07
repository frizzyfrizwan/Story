import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTrips, type TripItem } from "@/lib/repo/trips";
import { TripsBoard } from "@/components/trips/trips-board";
import type { TripSummary } from "@/components/trips/types";

export const metadata: Metadata = { title: "Trips" };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/trips");

  const rows = await listTrips(session.user.id);
  const trips: TripSummary[] = rows.map((t) => {
    const items = Array.isArray(t.items) ? (t.items as Partial<TripItem>[]) : [];
    const counts = { flight: 0, hotel: 0, note: 0 };
    for (const i of items) if (i && i.kind && i.kind in counts) counts[i.kind] += 1;
    return { id: t.id, title: t.title, notes: t.notes ?? "", counts, createdAt: t.createdAt, updatedAt: t.updatedAt };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <TripsBoard trips={trips} />
    </div>
  );
}
