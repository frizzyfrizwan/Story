"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "@/components/ui/toast";
import { ApiError, apiGet, apiPost, loginHref } from "@/lib/client/api";
import { fmtInt } from "@/lib/utils";
import type { HotelResult } from "./model";

interface TripSummary {
  id: string;
  title: string;
}

/**
 * "Save to trip": drops the quote into the user's most recent trip, creating one when they have
 * none. A 401 sends them to sign in and back here afterwards.
 */
export function useSaveToTrip() {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);

  const save = useCallback(
    async (result: HotelResult) => {
      const { quote, property, program } = result;
      setSavingId(property.id);
      try {
        const { trips } = await apiGet<{ trips: TripSummary[] }>("/api/trips");
        let trip = trips[0];
        if (!trip) {
          const created = await apiPost<{ trip: TripSummary }>("/api/trips", {
            action: "create",
            title: `${property.city} on points`,
          });
          trip = created.trip;
        }
        await apiPost("/api/trips", {
          action: "add",
          tripId: trip.id,
          kind: "hotel",
          payload: {
            propertyId: property.id,
            name: property.name,
            brand: property.brand,
            city: property.city,
            programId: program.id,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            nights: quote.nights,
            guests: null,
            pointsPerNight: quote.pointsPerNight,
            totalPoints: quote.totalPoints,
            cashPerNightUsd: quote.cashPerNightUsd,
            totalCashUsd: quote.totalCashUsd,
            cpp: quote.cpp,
            valueScore: quote.valueScore,
            fifthNightFreeApplied: quote.fifthNightFreeApplied,
            bookingUrl: program.bookingUrl,
          },
        });
        toast.success(`Saved to “${trip.title}”`, {
          description: `${property.name} · ${fmtInt(quote.totalPoints)} ${program.currency}`,
          action: { label: "View trips", onClick: () => router.push("/trips") },
        });
      } catch (err) {
        if (err instanceof ApiError && err.unauthenticated) {
          toast.info("Sign in to save hotels to a trip");
          router.push(loginHref());
          return;
        }
        toast.error("Couldn't save this hotel", { description: err instanceof Error ? err.message : undefined });
      } finally {
        setSavingId(null);
      }
    },
    [router],
  );

  return { save, savingId };
}
