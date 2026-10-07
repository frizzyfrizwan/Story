import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Info } from "lucide-react";
import { auth } from "@/auth";
import { env, integrationStatus } from "@/env";
import { listProviders } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { focusRing } from "@/components/ui/tokens";
import { CopyEnvButton } from "@/components/settings/copy-env-button";
import { HealthCard } from "@/components/settings/health-card";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

type RowStatus = "live" | "live-anon" | "off" | "always";

interface Row {
  id: string;
  group: "Data" | "AI" | "Auth & email" | "Billing";
  name: string;
  powers: string;
  status: RowStatus;
  /** Env var names (and prose) a person must set to go live. */
  requires?: string;
  docs: string;
}

/** What each provider powers + where to get keys. Keyed by registry id. */
const PROVIDER_INFO: Record<string, { powers: string; docs: string }> = {
  seatsaero: { powers: "Award search, availability calendars, deals, alert checks", docs: "https://seats.aero/partner-api" },
  opensky: { powers: "Live aircraft on the map and globe", docs: "https://openskynetwork.github.io/opensky-api/" },
  aviationstack: { powers: "Flight status lookups", docs: "https://aviationstack.com/documentation" },
  aerodatabox: { powers: "Flight status lookups (alternative)", docs: "https://aerodatabox.com/" },
  "amadeus-hotels": { powers: "Hotel award comparisons against live cash rates", docs: "https://developers.amadeus.com/self-service" },
  "amadeus-fares": { powers: "Cash fares for cents-per-point math", docs: "https://developers.amadeus.com/self-service" },
  duffel: { powers: "Cash fares for cents-per-point math (alternative)", docs: "https://duffel.com/docs" },
  "exchangerate-api": { powers: "Currency conversion for taxes and fees", docs: "https://www.exchangerate-api.com/docs" },
  simulator: { powers: "Deterministic fallback for everything above — every result it produces is tagged DEMO DATA", docs: "/concierge" },
};

function envVarsIn(text: string | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g) ?? []));
}

function buildRows(): Row[] {
  const status = integrationStatus();
  const providers = listProviders();

  const data: Row[] = providers.map((p) => {
    const info = PROVIDER_INFO[p.id] ?? { powers: "Live data", docs: "/settings/integrations" };
    const optional = p.enabled && Boolean(p.requires);
    return {
      id: p.id,
      group: "Data",
      name: p.label,
      powers: info.powers,
      status: p.id === "simulator" ? "always" : p.enabled ? (optional ? "live-anon" : "live") : "off",
      requires: p.requires,
      docs: info.docs,
    };
  });

  const rest: Row[] = [
    {
      id: "anthropic",
      group: "AI",
      name: "Anthropic",
      powers: `Concierge, natural-language search parsing, deal explanations (${env.ANTHROPIC_MODEL} · ${env.ANTHROPIC_FAST_MODEL})`,
      status: status.ai ? "live" : "off",
      requires: status.ai ? undefined : "ANTHROPIC_API_KEY (optional ANTHROPIC_MODEL, ANTHROPIC_FAST_MODEL)",
      docs: "https://docs.anthropic.com/",
    },
    {
      id: "google",
      group: "Auth & email",
      name: "Google sign-in",
      powers: "One-click OAuth sign-in",
      status: status.googleAuth ? "live" : "off",
      requires: status.googleAuth ? undefined : "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET",
      docs: "https://authjs.dev/getting-started/providers/google",
    },
    {
      id: "resend",
      group: "Auth & email",
      name: "Resend",
      powers: "Magic-link sign-in and alert emails",
      status: status.email ? "live" : "off",
      requires: status.email ? undefined : "AUTH_RESEND_KEY (optional EMAIL_FROM)",
      docs: "https://resend.com/docs",
    },
    {
      id: "stripe",
      group: "Billing",
      name: "Stripe",
      powers: "Pro subscriptions, checkout and the customer portal",
      status: status.billing ? "live" : "off",
      requires: status.billing
        ? env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_PRO_MONTHLY && env.STRIPE_PRICE_PRO_YEARLY
          ? undefined
          : "Also set STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY"
        : "STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_PRICE_PRO_MONTHLY + STRIPE_PRICE_PRO_YEARLY",
      docs: "https://docs.stripe.com/billing/quickstart",
    },
  ];

  return [...rest, ...data];
}

const ENV_ORDER = [
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_RESEND_KEY",
  "EMAIL_FROM",
  "DEMO_MODE",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_FAST_MODEL",
  "SEATS_AERO_API_KEY",
  "OPENSKY_CLIENT_ID",
  "OPENSKY_CLIENT_SECRET",
  "AVIATIONSTACK_KEY",
  "AERODATABOX_KEY",
  "AMADEUS_CLIENT_ID",
  "AMADEUS_CLIENT_SECRET",
  "AMADEUS_ENV",
  "DUFFEL_API_KEY",
  "EXCHANGERATE_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
];

function buildTemplate(rows: Row[]): { template: string; keys: string[] } {
  const found = new Set<string>(ENV_ORDER);
  for (const r of rows) for (const k of envVarsIn(r.requires)) found.add(k);
  const keys = [...ENV_ORDER.filter((k) => found.has(k)), ...[...found].filter((k) => !ENV_ORDER.includes(k)).sort()];
  const template = [
    "# Kestrel integrations — paste into .env.local and fill in what you have.",
    "# Everything is optional; each integration lights up on its own.",
    ...keys.map((k) => `${k}=`),
    "",
  ].join("\n");
  return { template, keys };
}

const STATUS_PILL: Record<RowStatus, { label: string; variant: "aurora" | "outline" | "gold" | "sky"; pulse?: boolean }> = {
  live: { label: "Live", variant: "aurora", pulse: true },
  "live-anon": { label: "Live · limited", variant: "sky" },
  off: { label: "Not configured", variant: "outline" },
  always: { label: "Always on", variant: "gold" },
};

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings/integrations");

  const status = integrationStatus();
  const rows = buildRows();
  const { template, keys } = buildTemplate(rows);
  const liveCount = rows.filter((r) => r.status === "live" || r.status === "live-anon").length;
  const groups = Array.from(new Set(rows.map((r) => r.group)));

  return (
    <div className="flex flex-col gap-6">
      {status.demoMode && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[var(--radius)] border border-gold/30 bg-gold-soft px-4 py-3.5 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-fg">Demo mode is on.</p>
            <p className="mt-0.5 leading-relaxed text-fg-muted">
              With no live keys, the built-in simulator answers every search deterministically — same route and date,
              same seats — and every result wears a <Badge variant="gold" size="sm" caps className="align-middle">Demo data</Badge>{" "}
              badge. Demo sign-in stays on until a real auth provider is configured or <code className="text-fg">DEMO_MODE=false</code>.
            </p>
          </div>
        </div>
      )}

      <Panel
        as="div"
        eyebrow="Integrations"
        title={`${liveCount} of ${rows.length} live`}
        description="Keys are read from the server environment at boot. Nothing here is editable from the browser — by design."
        actions={<CopyEnvButton template={template} keyCount={keys.length} />}
        padding="none"
        bodyClassName="pt-0"
      >
        <div className="mt-5 border-t border-panel-border">
          {groups.map((group) => (
            <section key={group} aria-label={group}>
              <h4 className="bg-bg-elev-1/60 px-5 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle sm:px-6">
                {group}
              </h4>
              <ul className="divide-y divide-panel-border">
                {rows
                  .filter((r) => r.group === group)
                  .map((r) => {
                    const pill = STATUS_PILL[r.status];
                    const external = r.docs.startsWith("http");
                    return (
                      <li
                        key={r.id}
                        className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_150px] sm:items-start sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-fg">
                            {r.name}
                            <Link
                              href={r.docs}
                              target={external ? "_blank" : undefined}
                              rel={external ? "noreferrer" : undefined}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-[4px] text-[12px] font-normal text-sky hover:underline",
                                focusRing,
                              )}
                            >
                              {external ? "Docs" : "Open"}
                              {external && <ExternalLink className="size-3" aria-hidden="true" />}
                            </Link>
                          </p>
                          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted sm:hidden">{r.powers}</p>
                        </div>
                        <p className="hidden text-[13px] leading-relaxed text-fg-muted sm:block">{r.powers}</p>
                        <div className="flex flex-col items-start gap-1.5 sm:items-end">
                          <Badge variant={pill.variant} dot pulse={pill.pulse} caps size="sm">
                            {pill.label}
                          </Badge>
                        </div>
                        {r.requires && (
                          <p className="text-[12px] leading-relaxed text-fg-subtle sm:col-span-3">
                            <span className="mr-1.5 font-mono uppercase tracking-[0.12em]">Requires</span>
                            <RequiresText text={r.requires} />
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <HealthCard />
        <Panel as="div" eyebrow="How it works" title="Live first, simulator second">
          <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-fg-muted marker:font-mono marker:text-fg-subtle">
            <li>Every search asks the live providers that have keys, with an 8-second budget each.</li>
            <li>Anything that fails or times out falls back to the simulator, and the result is tagged accordingly.</li>
            <li>
              Live award rows are also snapshotted so <Link href="/explore" className="text-sky hover:underline">Explore</Link> and
              alerts get smarter over time.
            </li>
            <li>
              Restart the server after changing keys — the environment is read once at boot and reported on{" "}
              <code className="text-fg">/api/health</code>.
            </li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}

/** Env var names in mono; everything else as prose. */
function RequiresText({ text }: { text: string }) {
  const parts = text.split(/(\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(part) ? (
          <code key={i} className="rounded-[4px] bg-fg/6 px-1 py-0.5 font-mono text-[11.5px] text-fg">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
