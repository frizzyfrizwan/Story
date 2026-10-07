import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { listAlerts, createAlert, listHits } from "@/lib/repo/alerts";
import { getProfile } from "@/lib/repo/profiles";
import { FREE_ALERT_LIMIT } from "@/lib/billing/stripe";
import { CABINS } from "@/lib/types";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const [alerts, hits] = await Promise.all([listAlerts(session.user.id), listHits(session.user.id, undefined, 60)]);
  return ok({ alerts, hits });
});

const alertSchema = z.object({
  name: z.string().max(80).optional(),
  origins: z.array(z.string().trim().toUpperCase().length(3)).min(1).max(6),
  destinations: z.array(z.string().trim().toUpperCase().length(3)).min(1).max(6),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cabin: z.enum(CABINS as [string, ...string[]]),
  passengers: z.number().int().min(1).max(9).default(1),
  maxMiles: z.number().int().min(1000).max(1_000_000).optional(),
  programs: z.array(z.string()).max(20).optional(),
  channels: z.array(z.enum(["email", "push", "inapp"])).min(1).default(["inapp", "email"]),
});

export const POST = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const input = await parseBody(req, alertSchema);
  if (input.dateTo < input.dateFrom) return fail("End date must be after start date", 400);
  const profile = await getProfile(session.user.id);
  const existing = await listAlerts(session.user.id);
  if (profile?.plan !== "pro" && existing.filter((a) => a.active).length >= FREE_ALERT_LIMIT) {
    return fail(`Free plan includes ${FREE_ALERT_LIMIT} active alerts. Upgrade to Pro for unlimited alerts.`, 402, { upgrade: true });
  }
  const alert = await createAlert(session.user.id, { ...input, cabin: input.cabin as (typeof CABINS)[number] });
  return ok({ alert }, { status: 201 });
});
