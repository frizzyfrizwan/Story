import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { CheckGlyph } from "./glyphs";
import { Accent, HomeSection } from "./home-section";
import { Reveal } from "./reveal";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Everything you need to find a seat.",
    bullets: [
      "Live award search across 40+ programs",
      "Transfer-partner math with current bonuses",
      "Availability calendars and sweet-spot guides",
      "Community finds and three saved alerts",
    ],
    cta: { label: "Start searching", href: "/search" },
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "Pro",
    period: "monthly or yearly",
    tagline: "For people who book a lot of premium cabins.",
    bullets: [
      "Unlimited alerts with instant push and email",
      "Wallet-aware results: only what your points can buy",
      "Unlimited concierge conversations that search and book",
      "Price history and the fastest inventory refresh",
    ],
    cta: { label: "See Pro pricing", href: "/pricing" },
    featured: true,
  },
] as const;

export function PricingTeaser() {
  return (
    <HomeSection
      id="pricing"
      eyebrow="Pricing"
      title={
        <>
          Free to search. <Accent className="text-signal">Pro when you&rsquo;re serious.</Accent>
        </>
      }
      description="The search engine, the transfer math and the community are free for everyone. Pro adds the tooling that pays for itself on a single premium-cabin booking."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.id} delay={i * 0.08} className="flex">
            <Panel
              grain
              as="div"
              padding="lg"
              strong={plan.featured}
              className={cn("flex w-full flex-col", plan.featured && "shadow-glow-signal")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-subtle">{plan.name}</p>
                  <p className="mt-2 font-display text-4xl leading-none tracking-tight text-fg">{plan.price}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-fg-subtle">{plan.period}</p>
                </div>
                {plan.featured && (
                  <Badge variant="signal" dot caps>
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="mt-5 text-sm text-fg-muted">{plan.tagline}</p>
              <ul className="mt-6 space-y-3">
                {plan.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-fg">
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                        plan.featured ? "bg-signal-soft text-signal" : "bg-aurora-soft text-aurora",
                      )}
                    >
                      <CheckGlyph className="size-3" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-2">
                <Button
                  href={plan.cta.href}
                  variant={plan.featured ? "primary" : "secondary"}
                  className="w-full sm:w-auto"
                  trailing={<ArrowRight />}
                >
                  {plan.cta.label}
                </Button>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>
    </HomeSection>
  );
}
