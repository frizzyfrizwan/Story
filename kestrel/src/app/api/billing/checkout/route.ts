import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { createCheckoutSession, getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export const POST = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  if (!getStripe()) return fail("Billing is not configured on this deployment", 503);
  const { interval } = await parseBody(req, z.object({ interval: z.enum(["month", "year"]).default("month") }));
  const url = await createCheckoutSession(session.user.id, session.user.email ?? null, interval);
  return ok({ url });
});
