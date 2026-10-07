import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getHotelCity } from "@/data/hotels";
import { HotelsExperience } from "@/components/hotels/hotels-experience";
import { parseHotelSearchParams } from "@/components/hotels/model";
import { popularCities } from "@/components/hotels/server";
import Loading from "./loading";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = parseHotelSearchParams(await searchParams);
  const city = q.city ? (getHotelCity(q.city)?.name ?? q.city) : null;
  return {
    title: city ? `Hotel awards in ${city}` : "Hotel awards",
    description: city
      ? `Points versus cash for every award hotel in ${city}, priced night by night with transfer partners and the fifth-night-free rule applied.`
      : "Every award hotel in 55 cities, priced night by night in seven programs and scored against the cash rate.",
  };
}

export default async function HotelsPage({ searchParams }: { searchParams: SearchParams }) {
  const [sp, session] = await Promise.all([searchParams, auth()]);
  const initial = parseHotelSearchParams(sp);
  return (
    <Suspense fallback={<Loading />}>
      <HotelsExperience initial={initial} popular={popularCities()} signedIn={Boolean(session?.user?.id)} />
    </Suspense>
  );
}
