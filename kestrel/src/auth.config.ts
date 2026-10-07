import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no database adapter, no Node-only imports).
 * Used by middleware; the full config in `auth.ts` extends it.
 */
/** Dev fallback so local and e2e runs work without configuration. Production must set AUTH_SECRET. */
export const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "kestrel-dev-secret-rotate-me");

export const authConfig = {
  secret: authSecret,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const protectedPrefixes = ["/wallet", "/alerts", "/settings", "/trips", "/finds/new"];
      const needsAuth = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!needsAuth) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
