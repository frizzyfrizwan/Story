import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, MapPin, PenLine } from "lucide-react";
import { auth } from "@/auth";
import { listFinds } from "@/lib/repo/finds";
import { getProfileByHandle } from "@/lib/repo/profiles";
import { fmtInt } from "@/lib/utils";
import { getAirport } from "@/data/airports";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEED_PAGE_SIZE, fmtMonthYear } from "@/components/finds/format";
import { ProfileFinds } from "@/components/finds/profile-finds";
import { ViewerProvider } from "@/components/finds/viewer";

type Params = Promise<{ handle: string }>;

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().slice(0, 24);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(cleanHandle(handle));
  if (!profile) return { title: "Profile not found" };
  const description = profile.bio?.trim() || `Finds shared by @${profile.handle} on Kestrel.`;
  return {
    title: `${profile.displayName} (@${profile.handle})`,
    description,
    openGraph: { title: `${profile.displayName} on Kestrel`, description, type: "profile" },
  };
}

/** Walk the author's finds to count them and sum likes (pages of 50; capped for safety). */
async function authorStats(userId: string): Promise<{ finds: number; likes: number }> {
  let finds = 0;
  let likes = 0;
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await listFinds({ userId, limit: 50, cursor });
    finds += page.items.length;
    likes += page.items.reduce((n, f) => n + f.likes, 0);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return { finds, likes };
}

export default async function ProfilePage({ params }: { params: Params }) {
  const [{ handle: raw }, session] = await Promise.all([params, auth()]);
  const handle = cleanHandle(raw);
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const viewerId = session?.user?.id ?? null;
  const [first, stats] = await Promise.all([
    listFinds({ userId: profile.userId, limit: FEED_PAGE_SIZE, viewerId }),
    authorStats(profile.userId),
  ]);
  const home = profile.homeAirport ? getAirport(profile.homeAirport) : undefined;
  const isMe = viewerId === profile.userId;
  const memberSince = fmtMonthYear(profile.createdAt);
  const bio = profile.bio?.trim() ?? "";

  return (
    <ViewerProvider viewerId={viewerId}>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
        {/* ── Header ───────────────────────────────────── */}
        <header className="relative overflow-hidden rounded-[var(--radius-xl)] border border-panel-border aurora-bg px-5 py-7 sm:px-8 sm:py-9">
          <div className="dot-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
            <Avatar seed={profile.avatarSeed} name={profile.displayName} size="xl" status={profile.plan === "pro" ? "pro" : undefined} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="font-display text-3xl leading-none tracking-tight text-fg sm:text-4xl">{profile.displayName}</h1>
                {profile.plan === "pro" && (
                  <Badge variant="gold" caps dot>
                    Pro
                  </Badge>
                )}
              </div>
              <p className="mt-2 font-mono text-sm text-fg-muted">@{profile.handle}</p>
              {bio && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted pretty-text">{bio}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {profile.homeAirport && (
                  <Badge variant="outline" size="lg" icon={<MapPin aria-hidden="true" />} title={home ? `${home.name}, ${home.country}` : undefined}>
                    <span className="font-mono font-semibold tracking-wider text-fg">{profile.homeAirport}</span>
                    {home && <span className="text-fg-muted">{home.city}</span>}
                  </Badge>
                )}
                {memberSince && (
                  <Badge variant="outline" size="lg" icon={<Calendar aria-hidden="true" />}>
                    Member since {memberSince}
                  </Badge>
                )}
              </div>
            </div>
            {isMe && (
              <Button href="/finds/new" size="sm" leading={<PenLine />} className="sm:shrink-0">
                Share a find
              </Button>
            )}
          </div>
        </header>

        {/* ── Stats ────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
          <StatTile label="Finds" value={stats.finds} format={fmtInt} tone="signal" size="sm" animate />
          <StatTile label="Likes received" value={stats.likes} format={fmtInt} tone="aurora" size="sm" animate />
          <StatTile label="Member since" value={<span className="font-display text-xl tracking-tight sm:text-[1.5rem]">{memberSince || "—"}</span>} tone="sky" size="sm" />
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <Tabs defaultValue="finds" className="mt-8">
          <TabsList>
            <TabsTrigger value="finds" count={stats.finds}>
              Finds
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          <TabsContent value="finds" className="mt-6">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
              <ProfileFinds userId={profile.userId} handle={profile.handle} isMe={isMe} initial={{ ...first, tags: [] }} />
              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <AboutPanel bio={bio} homeAirport={profile.homeAirport} homeCity={home?.city} memberSince={memberSince} plan={profile.plan} finds={stats.finds} />
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="about" className="mt-6">
            <div className="max-w-2xl">
              <AboutPanel bio={bio} homeAirport={profile.homeAirport} homeCity={home?.city} memberSince={memberSince} plan={profile.plan} finds={stats.finds} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ViewerProvider>
  );
}

function AboutPanel({
  bio,
  homeAirport,
  homeCity,
  memberSince,
  plan,
  finds,
}: {
  bio: string;
  homeAirport: string | null;
  homeCity?: string;
  memberSince: string;
  plan: "free" | "pro";
  finds: number;
}) {
  const rows: [string, React.ReactNode][] = [
    ["Home airport", homeAirport ? <span className="font-mono tracking-wider">{homeAirport}{homeCity ? <span className="ml-1.5 font-sans tracking-normal text-fg-muted">{homeCity}</span> : null}</span> : <span className="text-fg-subtle">Not set</span>],
    ["Member since", memberSince || "—"],
    ["Plan", plan === "pro" ? <Badge variant="gold" size="sm" caps>Pro</Badge> : "Free"],
    ["Finds shared", <span key="n" className="font-mono tnum">{fmtInt(finds)}</span>],
  ];
  return (
    <Panel eyebrow="About" padding="sm" grain>
      <p className="text-[15px] leading-relaxed text-fg-muted pretty-text">{bio || "This finder hasn't written a bio yet."}</p>
      <dl className="mt-4 flex flex-col divide-y divide-panel-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">{label}</dt>
            <dd className="text-sm text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
