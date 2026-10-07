import type { Metadata } from "next";
import { auth } from "@/auth";
import { listFinds, trendingTags } from "@/lib/repo/finds";
import { CABINS, type Cabin } from "@/lib/types";
import { Feed } from "@/components/finds/feed";
import { FEED_PAGE_SIZE } from "@/components/finds/format";
import type { FeedParams } from "@/components/finds/use-finds";
import { ViewerProvider } from "@/components/finds/viewer";

export const metadata: Metadata = {
  title: "Finds",
  description: "Real award redemptions from the Kestrel community — routes, cabins, programs, miles and taxes.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseParams(sp: SearchParams): FeedParams {
  const sort = first(sp.sort) === "top" ? "top" : "new";
  const tag = first(sp.tag)?.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || undefined;
  const cabinRaw = first(sp.cabin);
  const cabin = cabinRaw && (CABINS as readonly string[]).includes(cabinRaw) ? (cabinRaw as Cabin) : undefined;
  const programId = first(sp.programId)?.slice(0, 60) || undefined;
  return { sort, tag, cabin, programId };
}

export default async function FindsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, session] = await Promise.all([searchParams, auth()]);
  const params = parseParams(sp);
  const viewerId = session?.user?.id ?? null;
  const [page, tags] = await Promise.all([listFinds({ ...params, limit: FEED_PAGE_SIZE, viewerId }), trendingTags()]);

  return (
    <ViewerProvider viewerId={viewerId}>
      <Feed initial={{ ...page, tags }} params={params} />
    </ViewerProvider>
  );
}
