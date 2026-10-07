import type { Metadata } from "next";
import { auth } from "@/auth";
import { AlertDetail } from "@/components/alerts/alert-detail";

export const metadata: Metadata = {
  title: "Alert",
  description: "Hits, calendar and rule for one award alert.",
};

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <AlertDetail id={id} signedIn={Boolean(session?.user?.id)} />
    </div>
  );
}
