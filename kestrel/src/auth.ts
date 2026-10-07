import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { authConfig, authSecret } from "./auth.config";
import { env, integrationStatus } from "./env";
import { dbSync, getDb, schema } from "./db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const status = integrationStatus();

const providers: Provider[] = [];

if (status.googleAuth) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (env.AUTH_RESEND_KEY) {
  providers.push(Resend({ apiKey: env.AUTH_RESEND_KEY, from: env.EMAIL_FROM }));
}

if (status.demoMode) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo account",
      credentials: { persona: { label: "Persona", type: "text" } },
      async authorize(credentials) {
        const persona = typeof credentials?.persona === "string" ? credentials.persona : "explorer";
        const email = `${persona}@demo.kestrel.travel`;
        const db = await getDb();
        const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
        if (existing) return { id: existing.id, email: existing.email, name: existing.name, image: existing.image };
        const [created] = await db
          .insert(schema.users)
          .values({ email, name: persona === "explorer" ? "Demo Explorer" : `Demo ${persona}`, emailVerified: new Date() })
          .returning();
        return { id: created.id, email: created.email, name: created.name, image: created.image };
      },
    }),
  );
}

const secret = authSecret;
if (!secret) {
  console.error("[auth] AUTH_SECRET is required in production. Generate one with `openssl rand -base64 32`.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret,
  adapter: DrizzleAdapter(dbSync(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers,
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Give every new user a profile so social features work immediately.
      const db = await getDb();
      const base = (user.name ?? user.email ?? "traveler").split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "") || "traveler";
      let handle = base;
      for (let i = 0; i < 5; i++) {
        const clash = await db.query.profiles.findFirst({ where: eq(schema.profiles.handle, handle) });
        if (!clash) break;
        handle = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
      }
      await db
        .insert(schema.profiles)
        .values({ userId: user.id, handle, displayName: user.name ?? handle, avatarSeed: user.id })
        .onConflictDoNothing();
    },
  },
});

/** Convenience: current user id or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Throws a 401-style error when unauthenticated — for route handlers and server actions. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("UNAUTHENTICATED");
  return id;
}
