import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listBalances } from "@/lib/repo/wallet";
import { getProfile } from "@/lib/repo/profiles";
import type { Balance } from "@/lib/types";
import { WalletDashboard } from "@/components/wallet/wallet-dashboard";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Your points, priced: balances, transfer reach, what you can book today and which card to swipe.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?next=%2Fwallet");

  let balances: Balance[] = [];
  let homeAirport = "JFK";
  try {
    const [rows, profile] = await Promise.all([listBalances(userId), getProfile(userId)]);
    balances = rows;
    homeAirport = profile?.homeAirport?.toUpperCase() || "JFK";
  } catch (err) {
    console.warn("[wallet] could not load balances:", err instanceof Error ? err.message : err);
  }

  return <WalletDashboard initialBalances={balances} homeAirport={homeAirport} firstName={session.user.name?.split(" ")[0]} />;
}
