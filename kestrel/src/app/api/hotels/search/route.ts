import { z } from "zod";
import { handler, ok, fail, parseSearchParams, rateLimit, clientKey } from "@/lib/api";
import { searchHotels } from "@/lib/providers";
import { addDays, todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  city: z.string().trim().min(2).max(60),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guests: z.coerce.number().int().min(1).max(6).default(2),
  programs: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? undefined : Array.isArray(v) ? v : v.split(",").filter(Boolean))),
});

export const GET = handler(async (req: Request) => {
  const rl = rateLimit(`hotels:${clientKey(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests", 429);
  const q = parseSearchParams(req.url, schema);
  const checkIn = q.checkIn ?? addDays(todayISO(), 30);
  const checkOut = q.checkOut ?? addDays(checkIn, 3);
  if (checkOut <= checkIn) return fail("Check-out must be after check-in", 400);
  const res = await searchHotels({ city: q.city, checkIn, checkOut, guests: q.guests, programs: q.programs });
  return ok({ ...res, checkIn, checkOut }, { headers: { "cache-control": "private, max-age=60" } });
});
