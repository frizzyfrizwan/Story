import type { Metadata } from "next";
import { auth } from "@/auth";
import { AlertsDashboard } from "@/components/alerts/alerts-dashboard";
import { getProfile } from "@/lib/repo/profiles";
import { CABINS, type Cabin } from "@/lib/types";

export const metadata: Metadata = {
  title: "Alerts",
  description: "Watch any route and window for award space. Kestrel checks every day and tells you the moment seats open.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const codes = (v: string | string[] | undefined): string[] =>
  first(v)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{3}$/.test(s))
    .slice(0, 6);
const isoDate = (v: string | string[] | undefined): string | undefined => (/^\d{4}-\d{2}-\d{2}$/.test(first(v)) ? first(v) : undefined);

/**
 * /alerts — protected by middleware; still renders a sign-in panel for a null session.
 * `?new=1&from=JFK,EWR&to=HND&cabin=business&dateFrom=…&dateTo=…` opens the create dialog prefilled.
 */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, session] = await Promise.all([searchParams, auth()]);
  const user = session?.user?.id ? { id: session.user.id, name: session.user.name } : null;
  const profile = user ? await getProfile(user.id).catch(() => null) : null;

  const cabin = first(sp.cabin) as Cabin;
  const origins = codes(sp.from);
  const destinations = codes(sp.to);
  const open = first(sp.new) === "1" || first(sp.new) === "true";
  const prefill = open || origins.length || destinations.length
    ? {
        open,
        origins: origins.length ? origins : undefined,
        destinations: destinations.length ? destinations : undefined,
        cabin: CABINS.includes(cabin) ? cabin : undefined,
        dateFrom: isoDate(sp.dateFrom),
        dateTo: isoDate(sp.dateTo),
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <AlertsDashboard user={user} plan={profile?.plan === "pro" ? "pro" : "free"} prefill={prefill} />
    </div>
  );
}
