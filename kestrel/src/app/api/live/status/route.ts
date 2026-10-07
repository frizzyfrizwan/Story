import { z } from "zod";
import { handler, ok, fail, parseSearchParams } from "@/lib/api";
import { getFlightStatus } from "@/lib/providers";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 20;

const schema = z.object({
  flight: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/, "Use a flight number like UA1 or SQ 22"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handler(async (req: Request) => {
  const q = parseSearchParams(req.url, schema);
  const m = /^([A-Z0-9]{2})\s?(\d{1,4}[A-Z]?)$/.exec(q.flight);
  if (!m) return fail("Invalid flight number", 400);
  const status = await getFlightStatus(m[1], m[2], q.date ?? todayISO());
  if (!status) return fail("Flight not found", 404);
  return ok(status, { headers: { "cache-control": "public, max-age=30" } });
});
