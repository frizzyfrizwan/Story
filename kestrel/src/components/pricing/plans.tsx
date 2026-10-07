"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn, fmtUsd } from "@/lib/utils";
import { ApiError, apiPost } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";

export interface PlanView {
  id: "free" | "pro";
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: readonly string[];
}

export interface PlansProps {
  plans: { free: PlanView; pro: PlanView };
  signedIn: boolean;
  currentPlan: "free" | "pro";
  billingConfigured: boolean;
}

type Interval = "month" | "year";

/** Monthly/yearly toggle + the two plan cards. CTAs depend on sign-in state, plan and whether Stripe exists. */
export function Plans({ plans, signedIn, currentPlan, billingConfigured }: PlansProps) {
  const [interval, setInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState(false);

  const pro = plans.pro;
  const savings = Math.max(0, Math.round((1 - pro.priceYearly / (pro.priceMonthly * 12)) * 100));
  const proPrice = interval === "year" ? pro.priceYearly / 12 : pro.priceMonthly;

  async function upgrade() {
    setBusy(true);
    try {
      const { url } = await apiPost<{ url: string }>("/api/billing/checkout", { interval });
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.unauthenticated) {
        window.location.assign("/login?next=/pricing");
        return;
      }
      if (err instanceof ApiError && err.status === 503) {
        toast.error("Billing isn't configured in this deployment", { description: "No Stripe keys are set, so checkout can't start." });
        return;
      }
      toast.error("Couldn't start checkout", { description: err instanceof Error ? err.message : undefined });
    }
  }

  function waitlist() {
    toast.info("Billing isn't configured in this deployment", {
      description: "There's no waitlist to join yet — Pro turns on once Stripe keys are added in Settings → Integrations.",
    });
  }

  const proCta = (() => {
    if (currentPlan === "pro") {
      return (
        <Button href="/settings/billing" variant="secondary" size="lg" className="w-full">
          You&apos;re on Pro — manage billing
        </Button>
      );
    }
    if (!billingConfigured) {
      return (
        <Button type="button" variant="secondary" size="lg" onClick={waitlist} className="w-full">
          Join the waitlist
        </Button>
      );
    }
    if (!signedIn) {
      return (
        <Button href="/login?next=/settings/billing" size="lg" trailing={<ArrowRight />} className="w-full">
          Sign in to upgrade
        </Button>
      );
    }
    return (
      <Button type="button" size="lg" onClick={upgrade} loading={busy} trailing={<ArrowRight />} className="w-full">
        Upgrade to Pro · {interval === "year" ? `${fmtUsd(pro.priceYearly)}/yr` : `${fmtUsd(pro.priceMonthly)}/mo`}
      </Button>
    );
  })();

  const freeCta = signedIn ? (
    <Button href="/search" variant="secondary" size="lg" className="w-full">
      {currentPlan === "free" ? "You're on Explorer — go search" : "Open search"}
    </Button>
  ) : (
    <Button href="/login" variant="secondary" size="lg" className="w-full">
      Start free
    </Button>
  );

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <SegmentedControl
          value={interval}
          onChange={setInterval}
          aria-label="Billing interval"
          options={[
            { value: "month", label: "Monthly" },
            {
              value: "year",
              label: (
                <span className="inline-flex items-center gap-2">
                  Yearly
                  {savings > 0 && (
                    <Badge variant="aurora" size="sm" caps>
                      Save {savings}%
                    </Badge>
                  )}
                </span>
              ),
              accent: "aurora",
            },
          ]}
        />
        <p className="text-[12px] text-fg-subtle" aria-live="polite">
          {interval === "year"
            ? `${fmtUsd(pro.priceYearly)} billed once a year — ${fmtUsd(pro.priceMonthly * 12 - pro.priceYearly)} less than monthly.`
            : "Billed monthly. Switch to yearly any time."}
        </p>
      </div>

      <div className="grid w-full gap-5 md:grid-cols-2">
        <PlanCard
          name={plans.free.name}
          tagline="Everything you need to find a seat."
          price={0}
          per="forever"
          features={plans.free.features}
          cta={freeCta}
          current={signedIn && currentPlan === "free"}
        />
        <PlanCard
          name={pro.name}
          tagline="For people who fly on points every year."
          price={proPrice}
          per={interval === "year" ? "/ month, billed yearly" : "/ month"}
          features={pro.features}
          cta={proCta}
          highlight
          current={currentPlan === "pro"}
          intro="Everything in Explorer, plus"
        />
      </div>
    </div>
  );
}

function PlanCard({
  name,
  tagline,
  price,
  per,
  features,
  cta,
  highlight,
  current,
  intro,
}: {
  name: string;
  tagline: string;
  price: number;
  per: string;
  features: readonly string[];
  cta: React.ReactNode;
  highlight?: boolean;
  current?: boolean;
  intro?: string;
}) {
  return (
    <article
      aria-label={`${name} plan`}
      className={cn(
        "panel grain relative flex flex-col gap-6 p-6 sm:p-8",
        highlight && "panel-strong border-signal/35 shadow-glow-signal",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl tracking-tight text-fg">{name}</h3>
          <p className="mt-1 text-sm text-fg-muted">{tagline}</p>
        </div>
        {highlight ? (
          <Badge variant="signal" caps icon={<Sparkles />}>
            Popular
          </Badge>
        ) : current ? (
          <Badge variant="outline" caps>
            Current
          </Badge>
        ) : null}
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-5xl leading-none tracking-tight text-fg">
          <span className="font-mono tnum">{price === 0 ? "$0" : fmtUsd(price, { cents: !Number.isInteger(price) })}</span>
        </span>
        <span className="text-sm text-fg-subtle">{per}</span>
      </p>

      {intro && <p className="-mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">{intro}</p>}
      <ul className="grid gap-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-fg">
            <Check className={cn("mt-0.5 size-4 shrink-0", highlight ? "text-gold" : "text-aurora")} aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">{cta}</div>
      {current && highlight && <p className="-mt-3 text-center text-[12px] text-fg-subtle">This is your current plan.</p>}
    </article>
  );
}
