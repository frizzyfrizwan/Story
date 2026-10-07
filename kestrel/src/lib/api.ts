import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/** JSON response helpers for route handlers. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Parse a request body or search params against a Zod schema, with a 400 on failure. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json);
}

export function parseSearchParams<T>(url: string | URL, schema: ZodType<T>): T {
  const u = typeof url === "string" ? new URL(url) : url;
  const obj: Record<string, string | string[]> = {};
  u.searchParams.forEach((v, k) => {
    if (obj[k] === undefined) obj[k] = v;
    else obj[k] = ([] as string[]).concat(obj[k], v);
  });
  return schema.parse(obj);
}

/** Wrap a handler so thrown Zod/auth errors become clean JSON responses. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail("Invalid request", 400, { issues: err.issues });
      }
      if (err instanceof Error && err.message === "UNAUTHENTICATED") {
        return fail("Sign in required", 401);
      }
      console.error("[api]", err);
      return fail("Something went wrong", 500);
    }
  };
}

// ─── Minimal in-memory rate limiter (per-instance; swap for Upstash in multi-region deploys) ──

const buckets = new Map<string, { tokens: number; updated: number }>();

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: opts.limit, updated: now };
  const refill = ((now - b.updated) / opts.windowMs) * opts.limit;
  b.tokens = Math.min(opts.limit, b.tokens + refill);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return { allowed: false, remaining: 0 };
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear();
  return { allowed: true, remaining: Math.floor(b.tokens) };
}

export function clientKey(req: Request): string {
  const h = req.headers;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "anon";
}
