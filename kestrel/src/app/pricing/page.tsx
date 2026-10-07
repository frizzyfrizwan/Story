import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { integrationStatus } from "@/env";
import { FREE_ALERT_LIMIT, PLANS } from "@/lib/billing/stripe";
import { getProfile } from "@/lib/repo/profiles";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/panel";
import { ComparisonTable, buildComparison } from "@/components/pricing/comparison-table";
import { Faq, type FaqItem } from "@/components/pricing/faq";
import { Plans, type PlanView } from "@/components/pricing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Kestrel is free to search. Pro adds unlimited alerts, full availability calendars and the live-tool concierge.",
};

export const dynamic = "force-dynamic";

const FAQ: FaqItem[] = [
  {
    q: "Where does the award data come from?",
    a: (
      <>
        When a deployment has a <code>SEATS_AERO_API_KEY</code>, award seats and calendars come live from the seats.aero
        Partner API, cash fares from Amadeus or Duffel, and live aircraft from OpenSky. Without keys, Kestrel runs its
        deterministic simulator and labels every result <Badge variant="gold" size="sm" caps className="align-middle">Demo data</Badge>.
        You can always see which is which on <Link href="/settings/integrations">Settings → Integrations</Link>.
      </>
    ),
  },
  {
    q: "What is demo mode, and is anything in it real?",
    a: (
      <>
        Demo mode is what you get with zero configuration: one-click demo personas, simulated availability and seeded
        community posts. The seats, prices and balances are generated — plausible, consistent from search to search, but
        not bookable. The product itself is the same code that runs live.
      </>
    ),
  },
  {
    q: "Does Kestrel book the flight for me?",
    a: (
      <>
        No. Kestrel finds the seat, prices it in every program that can book it and shows the transfer path. Booking
        happens on the airline or hotel program&apos;s own site through a deep link — we never ask for your loyalty
        logins.
      </>
    ),
  },
  {
    q: "Can I cancel Pro at any time?",
    a: (
      <>
        Yes. Subscriptions are handled by Stripe; open the billing portal from{" "}
        <Link href="/settings/billing">Settings → Billing</Link> to cancel, switch between monthly and yearly, or
        download invoices. Pro stays active until the end of the period you paid for.
      </>
    ),
  },
  {
    q: "What counts as an alert, and what happens at the free limit?",
    a: (
      <>
        An alert is one watched route-and-date window (for example NYC → Tokyo, business, next March). Explorer includes{" "}
        {FREE_ALERT_LIMIT} active alerts delivered in-app; creating another returns a clear upgrade prompt rather than
        silently failing. Pro removes the cap and adds email and push delivery.
      </>
    ),
  },
  {
    q: "What do you store about me?",
    a: (
      <>
        Your email, display name, handle, the balances and alerts you enter, trips you save and finds you post. Card
        numbers never touch Kestrel — Stripe handles payment. You can request deletion from{" "}
        <Link href="/settings">Settings</Link>.
      </>
    ),
  },
];

export default async function PricingPage() {
  const session = await auth();
  const profile = session?.user?.id ? await getProfile(session.user.id) : null;
  const status = integrationStatus();

  const plans: { free: PlanView; pro: PlanView } = {
    free: {
      id: "free",
      name: PLANS.free.name,
      priceMonthly: PLANS.free.priceMonthly,
      priceYearly: PLANS.free.priceYearly,
      features: PLANS.free.features,
    },
    pro: {
      id: "pro",
      name: PLANS.pro.name,
      priceMonthly: PLANS.pro.priceMonthly,
      priceYearly: PLANS.pro.priceYearly,
      features: PLANS.pro.features,
    },
  };

  return (
    <div>
      <section className="aurora-bg relative overflow-hidden">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center animate-rise">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal">Pricing</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl lg:text-6xl balance-text">
              Free to search. <span className="text-gradient-signal">Pro when you fly.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-fg-muted pretty-text">
              Every seat, every program and the transfer math are free. Pro is for the alerts, calendars and concierge
              tools that find the seat before anyone else does.
            </p>
          </div>

          <div className="mt-12">
            <Plans
              plans={plans}
              signedIn={Boolean(session?.user)}
              currentPlan={profile?.plan ?? "free"}
              billingConfigured={status.billing}
            />
          </div>

          <p className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              Payments by Stripe — we never see your card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Cancel anytime, keep Pro to the end of the period
            </span>
            <span>Prices in USD</span>
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-16 sm:px-6">
        <Section eyebrow="Compare" title="Feature by feature" description="The honest version: what each plan does today, not on a roadmap.">
          <ComparisonTable groups={buildComparison(FREE_ALERT_LIMIT)} freeName={PLANS.free.name} proName={PLANS.pro.name} />
        </Section>

        <Section eyebrow="Questions" title="Before you trust us with your email" size="sm">
          <Faq items={FAQ} />
        </Section>

        <p className="text-center text-[12.5px] text-fg-subtle pretty-text">
          Award pricing and availability are informational and change constantly — confirm with the program before you
          transfer points. Kestrel is not affiliated with any airline, hotel or bank.
        </p>
      </div>
    </div>
  );
}
