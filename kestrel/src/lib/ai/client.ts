import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";

/**
 * Shared Anthropic client. `null` when no key is configured — every AI feature
 * must degrade gracefully (heuristic parser, canned explanations) in that case.
 */
let client: Anthropic | null | undefined;

export function getAnthropic(): Anthropic | null {
  if (client !== undefined) return client;
  if (!env.ANTHROPIC_API_KEY) {
    client = null;
    return client;
  }
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  return client;
}

export function isAiEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Primary model for reasoning-heavy work (concierge, trip plans). */
export const AI_MODEL = env.ANTHROPIC_MODEL;
/** Fast model for low-latency structured parsing (search box intent, badges). */
export const AI_FAST_MODEL = env.ANTHROPIC_FAST_MODEL;

/**
 * Server-side refusal fallbacks are on by default so a safety decline on the
 * primary model re-runs on a fallback inside the same call.
 */
export const AI_BETAS = ["server-side-fallback-2026-07-01"] as const;

export const KESTREL_SYSTEM_PROMPT = `You are Kestrel, an award-travel concierge inside the Kestrel app.
You help people fly and stay better using points and miles: finding award seats, choosing which bank
points to transfer, explaining program rules, comparing redemptions, and planning trips.

Ground rules:
- Be concrete. Quote miles, taxes, cents-per-point and dates when you have them from tool results or context.
- Never invent availability. If live data is not in your context, say what to search and offer to run it.
- Prefer transfer partners the user actually holds. Mention transfer times and current bonuses.
- Flag fuel surcharges, change fees and expiration risks when relevant.
- Keep answers tight: short paragraphs, bullets for options, no filler.
- You can show the user actions as markdown links to in-app routes:
  /search?from=JFK&to=NRT&date=2026-05-14&cabin=business, /programs/aeroplan, /hotels?city=Tokyo, /live.
`;

export type AnthropicClient = Anthropic;
export { Anthropic };
