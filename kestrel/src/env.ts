import { z } from "zod";

/**
 * Environment contract. Everything is optional so the app boots with zero config
 * (demo mode). Each integration lights up when its keys are present.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Database (libSQL: file: for local, libsql:// for Turso)
  DATABASE_URL: z.string().default("file:./data/kestrel.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),

  // Auth.js
  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_RESEND_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Kestrel <hello@kestrel.travel>"),
  /** Allow one-click demo sign-in. Defaults to on when no real provider is configured. */
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : v === "true" || v === "1")),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  ANTHROPIC_FAST_MODEL: z.string().default("claude-sonnet-5-5"),

  // Award / flight / hotel data providers
  SEATS_AERO_API_KEY: z.string().optional(),
  OPENSKY_CLIENT_ID: z.string().optional(),
  OPENSKY_CLIENT_SECRET: z.string().optional(),
  AVIATIONSTACK_KEY: z.string().optional(),
  AERODATABOX_KEY: z.string().optional(),
  AMADEUS_CLIENT_ID: z.string().optional(),
  AMADEUS_CLIENT_SECRET: z.string().optional(),
  AMADEUS_ENV: z.enum(["test", "production"]).default("test"),
  DUFFEL_API_KEY: z.string().optional(),
  EXCHANGERATE_API_KEY: z.string().optional(),

  // Billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),

  // Ops
  CRON_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Never crash the whole app on env problems; surface them loudly instead.
    console.error("[env] invalid environment:", parsed.error.flatten().fieldErrors);
    return schema.parse({});
  }
  return parsed.data;
}

export const env: Env = load();

/** Which integrations are live, for the status banner and settings page. */
export function integrationStatus() {
  const hasRealAuth = Boolean((env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) || env.AUTH_RESEND_KEY);
  return {
    ai: Boolean(env.ANTHROPIC_API_KEY),
    awards: Boolean(env.SEATS_AERO_API_KEY),
    liveFlights: true, // OpenSky anonymous access works without keys (rate limited)
    liveFlightsAuth: Boolean(env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET),
    flightStatus: Boolean(env.AVIATIONSTACK_KEY || env.AERODATABOX_KEY),
    hotels: Boolean(env.AMADEUS_CLIENT_ID && env.AMADEUS_CLIENT_SECRET),
    cashFares: Boolean(env.DUFFEL_API_KEY || (env.AMADEUS_CLIENT_ID && env.AMADEUS_CLIENT_SECRET)),
    fx: Boolean(env.EXCHANGERATE_API_KEY),
    email: Boolean(env.AUTH_RESEND_KEY),
    billing: Boolean(env.STRIPE_SECRET_KEY),
    googleAuth: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    demoMode: env.DEMO_MODE ?? !hasRealAuth,
  };
}

export type IntegrationStatus = ReturnType<typeof integrationStatus>;
