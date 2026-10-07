/**
 * Browser-side helpers for Kestrel's JSON API routes.
 * Every route returns `{ ok: true, data }` or `{ ok: false, error, ...extra }`.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** True when the server asked the user to sign in. */
  get unauthenticated() {
    return this.status === 401;
  }
  /** True when the server suggested upgrading to Pro. */
  get upgrade() {
    return this.status === 402 || this.extra.upgrade === true;
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

export function buildQuery(params: Query): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function unwrap<T>(res: Response): Promise<T> {
  let body: { ok?: boolean; data?: T; error?: string; [k: string]: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok || body.ok === false) {
    const { ok: _ok, error, data: _data, ...extra } = body;
    void _ok;
    void _data;
    throw new ApiError(typeof error === "string" ? error : `Request failed (${res.status})`, res.status, extra);
  }
  return body.data as T;
}

export async function apiGet<T>(path: string, params: Query = {}, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${path}${buildQuery(params)}`, { ...init, headers: { accept: "application/json", ...(init.headers ?? {}) } });
  return unwrap<T>(res);
}

export async function apiSend<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    method,
    headers: { "content-type": "application/json", accept: "application/json", ...(init.headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap<T>(res);
}

export const apiPost = <T>(path: string, body?: unknown, init?: RequestInit) => apiSend<T>("POST", path, body, init);
export const apiPut = <T>(path: string, body?: unknown, init?: RequestInit) => apiSend<T>("PUT", path, body, init);
export const apiPatch = <T>(path: string, body?: unknown, init?: RequestInit) => apiSend<T>("PATCH", path, body, init);
export const apiDelete = <T>(path: string, body?: unknown, init?: RequestInit) => apiSend<T>("DELETE", path, body, init);

/** Redirect to login preserving the current location. */
export function loginHref(next?: string): string {
  const target = next ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  return `/login?next=${encodeURIComponent(target)}`;
}
