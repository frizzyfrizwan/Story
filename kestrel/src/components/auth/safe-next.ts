/**
 * Validate a post-sign-in destination. Only same-origin, relative paths survive,
 * and never the login/logout/API routes (which would loop or sign the user out).
 */
export function safeNext(raw: string | string[] | undefined, fallback = "/search"): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return fallback;
  let path = v;
  // Auth.js may hand us an absolute callbackUrl on our own origin.
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      const own = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
      if (u.host !== own.host) return fallback;
      path = u.pathname + u.search;
    }
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/logout") || path.startsWith("/api/")) {
    return fallback;
  }
  return path;
}
