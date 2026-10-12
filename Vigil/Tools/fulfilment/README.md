# Vigil fulfilment worker

Turns a Lemon Squeezy order into a signed `VIGIL-…` licence key. Same key format as `Tools/make-license.swift`;
the app verifies it offline with the public key in `LicenseVerifier.productionPublicKeyHex`.

1. `cd Tools/fulfilment && npm i -g wrangler && wrangler login`
2. `wrangler secret put VIGIL_PRIVATE_KEY_HEX` → paste the private key (never commit it).
3. `wrangler secret put LS_WEBHOOK_SECRET` → any long random string; type the same one into Lemon Squeezy when creating the webhook.
4. `wrangler secret put LS_API_KEY` → Lemon Squeezy → Settings → API.
5. `wrangler deploy` → note the URL.
6. Lemon Squeezy → Settings → Webhooks → add: URL from step 5, events `order_created`, `subscription_created`, `subscription_payment_success`.
7. Product "Vigil Pro" with variants named **Lifetime** (US$29), **Yearly** (US$12/yr), **Family Lifetime** (US$49, 3 Macs). The variant name decides the plan.
8. Lemon Squeezy → the product's receipt email: add "Your licence key: {{ order.custom_data.vigil_license }}" (custom data shows on the receipt and in My Orders).

Test: Lemon Squeezy has a "Send test event" button on each webhook; the worker's response body contains the issued key.
Paste it into Vigil → Settings → Licence to confirm activation. `swift Tools/make-license.swift verify <public-hex> <key>` checks a key from the command line.
