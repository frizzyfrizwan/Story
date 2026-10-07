import type { Metadata } from "next";
import { auth } from "@/auth";
import { ConciergeExperience } from "@/components/concierge/concierge-experience";

export const metadata: Metadata = {
  title: "Concierge",
  description: "Ask Kestrel's AI concierge about award seats, which points to transfer, hotel awards and sweet spots — with live searches shown as it works.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ConciergePage({ searchParams }: { searchParams: SearchParams }) {
  const [session, params] = await Promise.all([auth().catch(() => null), searchParams]);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 4000) : "";
  return <ConciergeExperience signedIn={Boolean(session?.user?.id)} initialPrompt={q || undefined} />;
}
