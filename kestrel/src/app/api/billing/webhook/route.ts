import { handleWebhook } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const raw = await req.text();
  try {
    const result = await handleWebhook(raw, sig);
    return Response.json({ received: true, result });
  } catch (err) {
    console.error("[stripe webhook]", err);
    return new Response("Webhook error", { status: 400 });
  }
}
