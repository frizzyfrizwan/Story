import type { Metadata } from "next";
import { auth } from "@/auth";
import { ExploreExperience } from "@/components/explore/explore-experience";
import { DEAL_SORTS, EXPLORE_VIEWS, type DealSort, type ExploreView } from "@/components/explore/format";
import { getProfile } from "@/lib/repo/profiles";
import { CABINS, type Cabin } from "@/lib/types";

export const metadata: Metadata = {
  title: "Explore award deals",
  description: "See where your points can take you: curated award deals, 90-day availability calendars and a map of every destination within reach.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const code = (v: string | string[] | undefined): string => {
  const s = first(v).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : "";
};

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, session] = await Promise.all([searchParams, auth()]);
  const userId = session?.user?.id ?? null;
  const profile = userId ? await getProfile(userId).catch(() => null) : null;

  const view = first(sp.view) as ExploreView;
  const cabin = first(sp.cabin) as Cabin;
  const sort = first(sp.sort) as DealSort;

  return (
    <ExploreExperience
      signedIn={Boolean(userId)}
      homeAirport={profile?.homeAirport ?? null}
      initial={{
        view: EXPLORE_VIEWS.includes(view) ? view : "deals",
        from: code(sp.from),
        to: code(sp.to),
        cabin: CABINS.includes(cabin) ? cabin : "business",
        sort: DEAL_SORTS.includes(sort) ? sort : "value",
        mine: first(sp.mine) === "1" || first(sp.mine) === "true",
      }}
    />
  );
}
