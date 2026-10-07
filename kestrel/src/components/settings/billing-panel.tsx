"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, CreditCard, Sparkles } from "lucide-react";
import { cn, fmtDate, fmtUsd, parseISODate } from "@/lib/utils";
import { ApiError, apiPost } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { toast } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/tokens";

export interface BillingPanelProps {
  plan: "free" | "pro";
  renewsAt: string | null;
  /** The profile already has a Stripe customer (portal can open). */
  hasBillingAccount: boolean;
  /** STRIPE_SECRET_KEY present on the server. */
  billingConfigured: boolean;
  prices: { monthly: number; yearly: number };
}

type Busy = "month" | "year" | "portal" | null;

/** Current plan + the two upgrade paths + portal. Every failure is explained, never swallowed. */
export function BillingPanel({ plan, renewsAt, hasBillingAccount, billingConfigured, prices }: BillingPanelProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(
    billingConfigured ? null : "Stripe isn't configured on this deployment, so upgrades and the billing portal are switched off.",
  );

  const yearlySavings = Math.max(0, Math.round((1 - prices.yearly / (prices.monthly * 12)) * 100));

  function explain(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      if (err.unauthenticated) {
        window.location.assign("/login?next=/settings/billing");
        return;
      }
      if (err.status === 503) {
        setNotice("Stripe isn't configured on this deployment. Add STRIPE_SECRET_KEY and the price ids, then restart.");
        toast.error("Billing isn't configured", { description: "This deployment has no Stripe keys." });
        return;
      }
      setNotice(err.message);
      toast.error(fallback, { description: err.message });
      return;
    }
    setNotice(fallback);
    toast.error(fallback);
  }

  async function checkout(interval: "month" | "year") {
    setBusy(interval);
    setNotice(null);
    try {
      const { url } = await apiPost<{ url: string }>("/api/billing/checkout", { interval });
      window.location.assign(url);
    } catch (err) {
      explain(err, "Couldn't start checkout");
      setBusy(null);
    }
  }

  async function portal() {
    setBusy("portal");
    setNotice(null);
    try {
      const { url } = await apiPost<{ url: string }>("/api/billing/portal");
      window.location.assign(url);
    } catch (err) {
      explain(err, "Couldn't open the billing portal");
      setBusy(null);
    }
  }

  const renews = renewsAt ? fmtDate(parseISODate(renewsAt), { year: "numeric" }) : null;

  return (
    <Panel as="div" eyebrow="Your plan" title={plan === "pro" ? "Kestrel Pro" : "Explorer (free)"} strong grain>
      <div className="flex flex-wrap items-center gap-3">
        {plan === "pro" ? (
          <Badge variant="gold" dot caps>
            Pro
          </Badge>
        ) : (
          <Badge variant="outline" caps>
            Free
          </Badge>
        )}
        <p className="text-sm text-fg-muted">
          {plan === "pro"
            ? renews
              ? `Renews ${renews}.`
              : "Active. Renewal date appears once Stripe confirms the subscription."
            : "No card on file. Upgrade whenever you want more than three alerts."}
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-3.5 py-3 text-[13px] leading-relaxed text-fg"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          <span>
            {notice}{" "}
            <Link href="/settings/integrations" className={cn("font-medium text-sky hover:underline", focusRing)}>
              See integrations
            </Link>
          </span>
        </div>
      )}

      {plan === "free" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PriceOption
            label="Monthly"
            price={fmtUsd(prices.monthly)}
            per="/ month"
            note="Cancel anytime"
            busy={busy === "month"}
            disabled={!billingConfigured || busy !== null}
            onClick={() => checkout("month")}
          />
          <PriceOption
            label="Yearly"
            price={fmtUsd(prices.yearly)}
            per="/ year"
            note={yearlySavings > 0 ? `Save ${yearlySavings}% vs monthly` : "Billed once a year"}
            highlight
            busy={busy === "year"}
            disabled={!billingConfigured || busy !== null}
            onClick={() => checkout("year")}
          />
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={portal}
            loading={busy === "portal"}
            disabled={!billingConfigured || !hasBillingAccount || busy !== null}
            leading={<CreditCard />}
            trailing={<ArrowUpRight />}
          >
            Manage billing
          </Button>
          {!hasBillingAccount && (
            <p className="self-center text-[13px] text-fg-subtle">
              No Stripe customer is linked to this account yet, so there is no portal to open.
            </p>
          )}
        </div>
      )}

      {plan === "free" && hasBillingAccount && (
        <div className="mt-3">
          <Button type="button" variant="link" size="sm" onClick={portal} loading={busy === "portal"} disabled={!billingConfigured}>
            Open the billing portal for past invoices
          </Button>
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-fg-subtle">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
        Checkout happens on Stripe; we never see your card. Your plan flips to Pro when Stripe&apos;s webhook confirms the
        payment — usually within a minute.
      </p>
    </Panel>
  );
}

function PriceOption({
  label,
  price,
  per,
  note,
  highlight,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  price: string;
  per: string;
  note: string;
  highlight?: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius)] border bg-bg-elev-1 p-4",
        highlight ? "border-signal/40 shadow-glow-signal" : "border-panel-border",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg">{label}</span>
        {highlight && (
          <Badge variant="signal" size="sm" caps>
            Best value
          </Badge>
        )}
      </div>
      <p className="font-display text-3xl leading-none tracking-tight text-fg">
        <span className="font-mono tnum">{price}</span>
        <span className="ml-1 font-sans text-sm font-normal text-fg-subtle">{per}</span>
      </p>
      <p className="text-[13px] text-fg-muted">{note}</p>
      <Button type="button" variant={highlight ? "primary" : "secondary"} onClick={onClick} loading={busy} disabled={disabled} className="mt-auto w-full">
        Upgrade {label.toLowerCase()}
      </Button>
    </div>
  );
}
