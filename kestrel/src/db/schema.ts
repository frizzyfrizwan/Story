import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

// ─── Auth.js tables (shape required by @auth/drizzle-adapter) ─────────

export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuid()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ─── Kestrel app tables ───────────────────────────────────────────────

export const profiles = sqliteTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").default(""),
  homeAirport: text("home_airport"),
  avatarSeed: text("avatar_seed").notNull(),
  plan: text("plan").$type<"free" | "pro">().notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planRenewsAt: text("plan_renews_at"),
  preferences: text("preferences", { mode: "json" })
    .$type<{
      theme?: "dark" | "light";
      defaultCabin?: string;
      currency?: string;
      emailDigest?: boolean;
      pushAlerts?: boolean;
    }>()
    .default(sql`'{}'`),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export const balances = sqliteTable(
  "balance",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programId: text("program_id").notNull(),
    amount: integer("amount").notNull().default(0),
    status: text("status"),
    expiresAt: text("expires_at"),
    source: text("source").$type<"manual" | "import" | "connected">().notNull().default("manual"),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("balance_user_program").on(t.userId, t.programId)],
);

export const alerts = sqliteTable(
  "alert",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    origins: text("origins", { mode: "json" }).$type<string[]>().notNull(),
    destinations: text("destinations", { mode: "json" }).$type<string[]>().notNull(),
    dateFrom: text("date_from").notNull(),
    dateTo: text("date_to").notNull(),
    cabin: text("cabin").notNull(),
    passengers: integer("passengers").notNull().default(1),
    maxMiles: integer("max_miles"),
    programs: text("programs", { mode: "json" }).$type<string[]>(),
    channels: text("channels", { mode: "json" }).$type<string[]>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    hitCount: integer("hit_count").notNull().default(0),
    lastCheckedAt: text("last_checked_at"),
    lastHitAt: text("last_hit_at"),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("alert_user").on(t.userId), index("alert_active").on(t.active)],
);

export const alertHits = sqliteTable(
  "alert_hit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    alertId: text("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    carrier: text("carrier").notNull(),
    programId: text("program_id").notNull(),
    cabin: text("cabin").notNull(),
    miles: integer("miles").notNull(),
    taxesUsd: real("taxes_usd").notNull(),
    seats: integer("seats").notNull(),
    foundAt: text("found_at").notNull().$defaultFn(now),
    seen: integer("seen", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("alert_hit_alert").on(t.alertId), uniqueIndex("alert_hit_dedupe").on(t.alertId, t.date, t.carrier, t.programId, t.cabin)],
);

export const savedSearches = sqliteTable(
  "saved_search",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    query: text("query", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("saved_search_user").on(t.userId)],
);

export const trips = sqliteTable(
  "trip",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes").default(""),
    items: text("items", { mode: "json" }).$type<unknown[]>().notNull().default(sql`'[]'`),
    createdAt: text("created_at").notNull().$defaultFn(now),
    updatedAt: text("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("trip_user").on(t.userId)],
);

export const finds = sqliteTable(
  "find",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    origin: text("origin"),
    destination: text("destination"),
    carrier: text("carrier"),
    cabin: text("cabin"),
    programId: text("program_id"),
    miles: integer("miles"),
    taxesUsd: real("taxes_usd"),
    cpp: real("cpp"),
    travelDate: text("travel_date"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("find_created").on(t.createdAt), index("find_user").on(t.userId)],
);

export const findLikes = sqliteTable(
  "find_like",
  {
    findId: text("find_id")
      .notNull()
      .references(() => finds.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.findId, t.userId] })],
);

export const findComments = sqliteTable(
  "find_comment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    findId: text("find_id")
      .notNull()
      .references(() => finds.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("find_comment_find").on(t.findId)],
);

export const follows = sqliteTable(
  "follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })],
);

/** Snapshots of award availability from any provider — powers the explorer and alerts. */
export const availabilitySnapshots = sqliteTable(
  "availability_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    date: text("date").notNull(),
    cabin: text("cabin").notNull(),
    programId: text("program_id").notNull(),
    carrier: text("carrier").notNull(),
    miles: integer("miles").notNull(),
    taxesUsd: real("taxes_usd").notNull(),
    seats: integer("seats").notNull(),
    source: text("source").notNull(),
    fetchedAt: text("fetched_at").notNull().$defaultFn(now),
  },
  (t) => [
    index("snap_route_date").on(t.origin, t.destination, t.date),
    index("snap_fetched").on(t.fetchedAt),
  ],
);

export const transferBonuses = sqliteTable(
  "transfer_bonus",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    fromProgramId: text("from_program_id").notNull(),
    toProgramId: text("to_program_id").notNull(),
    percent: integer("percent").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    verifiedAt: text("verified_at").notNull().$defaultFn(now),
    note: text("note"),
  },
  (t) => [index("bonus_pair").on(t.fromProgramId, t.toProgramId)],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id"),
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("ai_usage_user").on(t.userId)],
);

export const notifications = sqliteTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("notification_user").on(t.userId, t.read)],
);

/** Small key/value store for process-level flags (seed lock, schema notes). */
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type BalanceRow = typeof balances.$inferSelect;
export type AlertRow = typeof alerts.$inferSelect;
export type AlertHitRow = typeof alertHits.$inferSelect;
export type FindRow = typeof finds.$inferSelect;
export type FindCommentRow = typeof findComments.$inferSelect;
export type TripRow = typeof trips.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
