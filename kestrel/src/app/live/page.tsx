import type { Metadata } from "next";
import { LiveExperience } from "@/components/live/live-experience";

export const metadata: Metadata = {
  title: "Live flights",
  description:
    "A live radar of aircraft in the air right now — OpenSky when reachable, Kestrel's deterministic simulator otherwise — plus flight status lookup and the award seats on the same route.",
};

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  return <LiveExperience initialFlight={first(sp.flight)} initialAirport={first(sp.airport)} />;
}
