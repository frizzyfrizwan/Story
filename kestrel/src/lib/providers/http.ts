import { ProviderError } from "./types";

/**
 * Shared HTTP + caching primitives for every live provider.
 *
 * - `fetchJson` wraps `fetch` with a timeout, caller abort propagation, a single
 *   retry on 5xx / network failures, and typed `ProviderError`s.
 * - `memo` is a tiny in-memory TTL cache with LRU eviction and in-flight
 *   de-duplication so concurrent identical requests share one network call.
 * - The `as*` helpers are defensive accessors for untrusted JSON.
 */

// ─── fetchJson ────────────────────────────────────────────────

export interface FetchJsonOptions {
  /** Provider id used in error messages, e.g. "seatsaero" */
  providerId: string;
  /** Per-attempt timeout (default 8 000 ms) */
  timeoutMs?: number;
  /** Extra attempts after the first on 5xx / network error / timeout (default 1) */
  retries?: number;
  /** Base back-off between attempts, multiplied by the attempt number (default 250 ms) */
  retryDelayMs?: number;
  /** Caller abort signal; `init.signal` is honoured too */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 250;

/** URL without query string or credentials — safe for logs and error messages. */
export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function snippet(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t ? ` — ${t.slice(0, 160)}` : "";
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a JSON document with timeout, abort propagation and one retry on
 * transient failure. Throws `ProviderError` (with HTTP `status` when known).
 *
 * The response is returned as `T` without validation — callers must treat it as
 * untrusted and use the `as*` accessors below.
 */
export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}, opts: FetchJsonOptions): Promise<T> {
  const { providerId } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, opts.retries ?? DEFAULT_RETRIES);
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const outer = opts.signal ?? init.signal ?? undefined;

  let lastError: ProviderError | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (outer?.aborted) throw new ProviderError(providerId, "request aborted");

    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    outer?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        const err = new ProviderError(
          providerId,
          `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""} from ${describeUrl(url)}${snippet(text)}`,
          res.status,
        );
        if (res.status >= 500 && attempt < retries) {
          lastError = err;
          await delay(retryDelayMs * (attempt + 1));
          continue;
        }
        throw err;
      }
      if (text.trim() === "") return null as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ProviderError(providerId, `invalid JSON from ${describeUrl(url)}`, res.status);
      }
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      if (outer?.aborted && !timedOut) throw new ProviderError(providerId, "request aborted");
      const err = new ProviderError(
        providerId,
        timedOut ? `timed out after ${timeoutMs}ms (${describeUrl(url)})` : `network error: ${errorMessage(e)} (${describeUrl(url)})`,
      );
      if (attempt < retries) {
        lastError = err;
        await delay(retryDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    }
  }
  throw lastError ?? new ProviderError(providerId, "request failed");
}

export type QueryValue = string | number | boolean | undefined | null;

/** Build `base + path + ?query`, skipping undefined/null values. */
export function buildUrl(base: string, path: string, params: Record<string, QueryValue> = {}): string {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

// ─── memo (TTL + LRU + in-flight de-dupe) ─────────────────────

export const MEMO_MAX_ENTRIES = 500;

interface MemoEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, MemoEntry>();
const inflight = new Map<string, Promise<unknown>>();

function store(key: string, value: unknown, ttlMs: number): void {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (cache.size > MEMO_MAX_ENTRIES) {
    // Map preserves insertion order; the first key is the least recently used.
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Memoise an async producer by key for `ttlMs`. Concurrent calls for the same
 * key share the pending promise. Rejections are never cached.
 *
 * The cache stores values as `unknown`; the caller guarantees that a key always
 * maps to the same `T` (encode the type in the key, e.g. "fx:rates").
 */
export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit) {
    if (hit.expiresAt > now) {
      // Refresh recency.
      cache.delete(key);
      cache.set(key, hit);
      return hit.value as T;
    }
    cache.delete(key);
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = fn()
    .then((value) => {
      if (ttlMs > 0) store(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** Peek at a cached value without touching recency; undefined when absent/expired. */
export function memoPeek<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return undefined;
  return hit.value as T;
}

/** Drop one key (or everything). Used by tests and when credentials rotate. */
export function memoClear(key?: string): void {
  if (key === undefined) {
    cache.clear();
    inflight.clear();
  } else {
    cache.delete(key);
    inflight.delete(key);
  }
}

export function memoSize(): number {
  return cache.size;
}

// ─── Defensive JSON accessors ─────────────────────────────────

export type JsonRecord = Record<string, unknown>;

export function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Accepts finite numbers and numeric strings ("70000", "1234.56"). */
export function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function asBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/** Walk a path of keys/indices through untrusted JSON; undefined when any hop is missing. */
export function pick(obj: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[key];
    } else {
      if (!isRecord(cur)) return undefined;
      cur = cur[key];
    }
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** "AC, UA ,LH" → ["AC","UA","LH"] */
export function splitList(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}
