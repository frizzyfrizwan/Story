import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Check, Minus } from "lucide-react";
import { auth } from "@/auth";
import { integrationStatus } from "@/env";
import { FREE_ALERT_LIMIT, PLANS } from "@/lib/billing/stripe";
import { ensureProfile } from "@/lib/repo/profiles";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { focusRing } from "@/components/ui/tokens";
import { BillingPanel } from "@/components/settings/billing-panel";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings/billing");

  const profile = await ensureProfile(session.user.id);
  const status = integrationStatus();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <BillingPanel
          plan={profile.plan}
          renewsAt={profile.planRenewsAt ?? null}
          hasBillingAccount={Boolean(profile.stripeCustomerId)}
          billingConfigured={status.billing}
          prices={{ monthly: PLANS.pro.priceMonthly, yearly: PLANS.pro.priceYearly }}
        />

        <Panel as="div" eyebrow="Limits" title="What the free plan includes">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            <li className="flex items-start gap-2.5 text-sm text-fg">
              <Bell className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden="true" />
              <span>
                <span className="font-mono tnum font-medium">{FREE_ALERT_LIMIT}</span> active availability alerts, in-app
                only
              </span>
            </li>
            {PLANS.free.features
              .filter((f) => !/alert/i.test(f))
              .map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-fg">
                  <Check className="mt-0.5 size-4 shrink-0 text-aurora" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
          </ul>
          <p className="mt-4 text-[13px] text-fg-muted">
            Creating a fourth alert on the free plan returns a clear &ldquo;upgrade&rdquo; message — nothing is silently
            dropped.{" "}
            <Link href="/pricing" className={cn("text-sky hover:underline", focusRing)}>
              Compare plans
            </Link>
            .
          </p>
        </Panel>
      </div>

      <Panel as="div" eyebrow="Pro" title="What Pro adds" className="lg:sticky lg:top-24">
        <ul className="grid gap-2.5">
          {PLANS.pro.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-fg">
              <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
              <span>{f}</span>
            </li>
          ))}
          <li className="flex items-start gap-2.5 text-sm text-fg-subtle">
            <Minus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>No booking fees, ever. Kestrel never charges on top of the program.</span>
          </li>
        </ul>
        <p className="mt-4 font-mono text-[11px] text-fg-subtle">
          {`$${PLANS.pro.priceMonthly}/mo · $${PLANS.pro.priceYearly}/yr · USD`}
        </p>
      </Panel>
    </div>
  );
}
