"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { HOTEL_PROGRAM_IDS } from "@/data/hotel-programs";
import type { HotelSearchParams, HotelSearchResult } from "./model";
import { resolveSearch } from "./server";

/**
 * Server function behind the hotel results grid. The public `/api/hotels/search` route returns
 * bare quotes; this resolves them against the catalogue, badges and the caller's wallet in one
 * round trip so the client never ships the hotel data.
 */

const schema = z.object({
  city: z.string().trim().min(2).max(60),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(6),
  programs: z.array(z.string()).max(HOTEL_PROGRAM_IDS.length),
});

export type SearchActionResult = { ok: true; data: HotelSearchResult } | { ok: false; error: string };

export async function searchHotelAwardsAction(input: HotelSearchParams): Promise<SearchActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tell us a city and your dates to search." };
  const q = parsed.data;
  if (q.checkOut <= q.checkIn) return { ok: false, error: "Check-out must be after check-in." };
  const programs = q.programs.filter((id) => HOTEL_PROGRAM_IDS.includes(id));
  try {
    const session = await auth();
    const data = await resolveSearch({ ...q, programs }, session?.user?.id ?? null);
    return { ok: true, data };
  } catch (err) {
    console.error("[hotels] search failed", err);
    return { ok: false, error: "The hotel search hit turbulence. Try again in a moment." };
  }
}
