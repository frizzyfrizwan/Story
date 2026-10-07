import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseSearchParams } from "@/lib/api";
import { getHotel } from "@/data/hotels";
import { addDays, todayISO } from "@/lib/utils";
import { buildHotelDetail } from "@/components/hotels/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  checkIn: iso.optional(),
  checkOut: iso.optional(),
  guests: z.coerce.number().int().min(1).max(6).default(2),
});

/**
 * GET /api/hotels/:id?checkIn&checkOut&guests → the stay priced night by night
 * (`quoteHotelDetailed`), the resolved result card, nearby comparables and, when signed in,
 * a payment plan from the caller's wallet.
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const property = getHotel(id);
  if (!property) return fail("Hotel not found", 404);

  const q = parseSearchParams(req.url, schema);
  const checkIn = q.checkIn ?? addDays(todayISO(), 30);
  const checkOut = q.checkOut ?? addDays(checkIn, 3);
  if (checkOut <= checkIn) return fail("Check-out must be after check-in", 400);

  const session = await auth();
  const detail = await buildHotelDetail(property, { checkIn, checkOut, guests: q.guests }, session?.user?.id ?? null);
  return ok(detail, { headers: { "cache-control": "private, max-age=60" } });
});
