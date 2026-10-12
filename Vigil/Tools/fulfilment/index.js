// Vigil licence fulfilment: Lemon Squeezy webhook → signed licence key → email via Lemon Squeezy's order email.
//
// Deploy as a Cloudflare Worker (free tier is plenty):
//   npm i -g wrangler && wrangler login
//   wrangler secret put LS_WEBHOOK_SECRET      # the "signing secret" you type when creating the webhook in Lemon Squeezy
//   wrangler secret put LS_API_KEY             # Lemon Squeezy → Settings → API → create key
//   wrangler secret put VIGIL_PRIVATE_KEY_HEX  # the private half from `swift Tools/make-license.swift keygen`
//   wrangler deploy
// Then in Lemon Squeezy → Settings → Webhooks: URL = your worker URL, events = order_created, subscription_created,
// subscription_payment_success. Enable "Generate license keys" is NOT needed; this worker issues Vigil keys itself.
//
// Plans are detected from the variant name: anything containing "lifetime" → lifetime key, otherwise a yearly key
// that expires 366 days after the payment (renewals issue a fresh key through subscription_payment_success).
// The key is written to the order as a custom note via the API and shown on the customer's receipt/My Orders page;
// it is also returned in the response body so you can see it in the webhook log.

const encoder = new TextEncoder();

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Canonical JSON: sorted keys, no whitespace, no escaped slashes — must match LicenseIssuer in the app.
function canonical(payload) {
  const sorted = {};
  for (const key of Object.keys(payload).sort()) sorted[key] = payload[key];
  return JSON.stringify(sorted);
}

async function issueKey(privateKeyHex, payload) {
  const raw = hexToBytes(privateKeyHex);
  // PKCS#8 wrapper for a raw Ed25519 private key (RFC 8410).
  const pkcs8Prefix = hexToBytes("302e020100300506032b657004220420");
  const pkcs8 = new Uint8Array(pkcs8Prefix.length + raw.length);
  pkcs8.set(pkcs8Prefix); pkcs8.set(raw, pkcs8Prefix.length);
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  const data = encoder.encode(canonical(payload));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, data));
  return "VIGIL-" + base64url(data) + "." + base64url(signature);
}

async function verifySignature(secret, body, signatureHex) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== (signatureHex || "").length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Vigil fulfilment is running.", { status: 200 });
    const body = await request.text();
    const signature = request.headers.get("X-Signature");
    if (!(await verifySignature(env.LS_WEBHOOK_SECRET, body, signature))) return new Response("bad signature", { status: 401 });

    const event = JSON.parse(body);
    const name = event.meta?.event_name;
    if (!["order_created", "subscription_created", "subscription_payment_success"].includes(name)) {
      return new Response("ignored", { status: 200 });
    }
    const attributes = event.data?.attributes ?? {};
    const email = attributes.user_email ?? attributes.customer_email ?? "";
    const variant = (attributes.first_order_item?.variant_name ?? attributes.variant_name ?? "").toLowerCase();
    const seats = variant.includes("family") ? 3 : 1;
    const lifetime = variant.includes("lifetime");
    const issued = Math.floor(Date.now() / 1000);
    const payload = { email, plan: lifetime ? "lifetime" : "pro", issued, expires: lifetime ? null : issued + 366 * 86400, seats };
    const key = await issueKey(env.VIGIL_PRIVATE_KEY_HEX, payload);

    // Attach the key to the order so it shows on the receipt and in the customer portal.
    const orderId = name === "order_created" ? event.data?.id : attributes.order_id;
    if (orderId && env.LS_API_KEY) {
      await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${env.LS_API_KEY}`, "Content-Type": "application/vnd.api+json", Accept: "application/vnd.api+json" },
        body: JSON.stringify({ data: { type: "orders", id: String(orderId), attributes: { custom_data: { vigil_license: key } } } }),
      }).catch(() => {});
    }
    return new Response(JSON.stringify({ email, plan: payload.plan, key }), { status: 200, headers: { "Content-Type": "application/json" } });
  },
};
