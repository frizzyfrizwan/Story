import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { integrationStatus } from "@/env";
import { ensureProfile } from "@/lib/repo/profiles";
import { AccountCard } from "@/components/settings/account-card";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings");

  const [profile, params] = await Promise.all([ensureProfile(session.user.id), searchParams]);
  const status = integrationStatus();
  const upgraded = params.upgraded === "1";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex flex-col gap-6">
        {upgraded && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[var(--radius)] border border-gold/30 bg-gold-soft px-4 py-3.5 text-sm animate-rise"
          >
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
            <div>
              <p className="font-medium text-fg">
                {profile.plan === "pro" ? "Welcome to Pro." : "Payment received — Pro is on its way."}
              </p>
              <p className="mt-0.5 text-fg-muted">
                {profile.plan === "pro"
                  ? "Unlimited alerts, full calendars and the concierge's live tools are unlocked."
                  : "Stripe confirms the subscription by webhook, usually within a minute. Refresh this page to see the Pro badge."}
              </p>
            </div>
          </div>
        )}

        <ProfileForm
          profile={{
            displayName: profile.displayName,
            handle: profile.handle,
            bio: profile.bio ?? "",
            homeAirport: profile.homeAirport ?? null,
            preferences: profile.preferences ?? {},
          }}
          emailConfigured={status.email}
        />
      </div>

      <AccountCard
        userId={session.user.id}
        name={session.user.name ?? profile.displayName}
        email={session.user.email ?? null}
        image={session.user.image ?? null}
        handle={profile.handle}
        plan={profile.plan}
        memberSince={profile.createdAt}
      />
    </div>
  );
}
