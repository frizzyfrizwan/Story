import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getHotel } from "@/data/hotels";
import { getHotelProgram } from "@/data/hotel-programs";
import { fmtInt, fmtUsd } from "@/lib/utils";
import { HotelDetail } from "@/components/hotels/hotel-detail";
import { parseStayParams } from "@/components/hotels/model";
import { buildHotelDetail } from "@/components/hotels/server";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const property = getHotel(id);
  if (!property) return { title: "Hotel not found" };
  const program = getHotelProgram(property.programId);
  return {
    title: `${property.name} on points`,
    description: `${property.brand} in ${property.city}: about ${fmtInt(property.avgPointsPerNight)} ${program?.currency ?? "points"} or ${fmtUsd(property.avgCashUsd)} a night. Night-by-night award pricing, transfer partners and cents-per-point.`,
  };
}

export default async function HotelDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const property = getHotel(id);
  if (!property) notFound();

  const [sp, session] = await Promise.all([searchParams, auth()]);
  const stay = parseStayParams(sp);
  const initial = await buildHotelDetail(property, stay, session?.user?.id ?? null);
  return <HotelDetail initial={initial} />;
}
