import { auth } from "@/auth";
import { handler, ok, fail } from "@/lib/api";
import { createPortalSession, getStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export const POST = handler(async () => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  if (!getStripe()) return fail("Billing is not configured on this deployment", 503);
  const url = await createPortalSession(session.user.id);
  return ok({ url });
});
