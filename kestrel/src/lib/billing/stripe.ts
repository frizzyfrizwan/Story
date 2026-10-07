import "server-only";
import Stripe from "stripe";
import { env } from "@/env";
import { ensureProfile, setPlan, findUserIdByStripeCustomer } from "@/lib/repo/profiles";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

let stripe: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripe !== undefined) return stripe;
  stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true }) : null;
  return stripe;
}

export const PLANS = {
  free: {
    id: "free",
    name: "Explorer",
    priceMonthly: 0,
    priceYearly: 0,
    features: ["Award search across 40+ programs", "Transfer partner intelligence", "3 availability alerts", "Community Finds", "Live flight map"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 12,
    priceYearly: 99,
    features: [
      "Unlimited alerts with email + push",
      "Full 330-day availability calendars",
      "AI concierge with live tools",
      "Wallet sync & expiry tracking",
      "Priority live data refresh",
      "Early access to new programs",
    ],
  },
} as const;

export const FREE_ALERT_LIMIT = 3;

export async function createCheckoutSession(userId: string, email: string | null, interval: "month" | "year"): Promise<string> {
  const s = getStripe();
  if (!s) throw new Error("Billing is not configured");
  const price = interval === "year" ? env.STRIPE_PRICE_PRO_YEARLY : env.STRIPE_PRICE_PRO_MONTHLY;
  if (!price) throw new Error("Stripe price id missing");
  const profile = await ensureProfile(userId);
  let customer = profile.stripeCustomerId ?? undefined;
  if (!customer) {
    const c = await s.customers.create({ email: email ?? undefined, metadata: { userId } });
    customer = c.id;
    const db = await getDb();
    await db.update(schema.profiles).set({ stripeCustomerId: customer }).where(eq(schema.profiles.userId, userId));
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/settings?upgraded=1`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
    allow_promotion_codes: true,
    metadata: { userId },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(userId: string): Promise<string> {
  const s = getStripe();
  if (!s) throw new Error("Billing is not configured");
  const profile = await ensureProfile(userId);
  if (!profile.stripeCustomerId) throw new Error("No billing account yet");
  const session = await s.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/settings`,
  });
  return session.url;
}

/** Verify + apply a Stripe webhook. Returns a short description for logs. */
export async function handleWebhook(rawBody: string, signature: string): Promise<string> {
  const s = getStripe();
  if (!s || !env.STRIPE_WEBHOOK_SECRET) throw new Error("Billing is not configured");
  const event = s.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId ?? (session.customer ? await findUserIdByStripeCustomer(String(session.customer)) : null);
      if (userId) {
        await setPlan(userId, "pro", {
          customerId: String(session.customer ?? ""),
          subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
        });
      }
      return `checkout completed for ${userId ?? "unknown"}`;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = await findUserIdByStripeCustomer(String(sub.customer));
      if (!userId) return "subscription event for unknown customer";
      const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
      const renewsAt = sub.items.data[0]?.current_period_end
        ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
        : undefined;
      await setPlan(userId, active ? "pro" : "free", { customerId: String(sub.customer), subscriptionId: sub.id, renewsAt });
      return `subscription ${sub.status} for ${userId}`;
    }
    default:
      return `ignored ${event.type}`;
  }
}
