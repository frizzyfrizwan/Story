import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const { pathname, search } = req.nextUrl;
    const protectedPrefixes = ["/wallet", "/alerts", "/settings", "/trips", "/finds/new"];
    const needsAuth = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (needsAuth) {
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("next", pathname + search);
      return Response.redirect(url);
    }
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)"],
};
