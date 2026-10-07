import { Search, Sparkles } from "lucide-react";
import { AuroraBackdrop, Starfield } from "@/components/art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlobeHero } from "@/components/viz";
import { Container } from "./home-section";
import { HeroSearch } from "./hero-search";

export function Hero({ demoMode }: { demoMode: boolean }) {
  return (
    <section className="aurora-bg relative overflow-hidden" aria-labelledby="hero-title">
      <AuroraBackdrop intensity={0.9} />
      <Starfield density={0.9} seed="home-hero" className="opacity-60 [:root[data-theme=light]_&]:hidden" />

      <Container className="relative grid gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-6 lg:pb-24 lg:pt-16">
        <div className="relative z-10 animate-rise">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="aurora" dot pulse caps>
              Live award search
            </Badge>
            {demoMode && (
              <Badge
                variant="gold"
                dot
                caps
                title="Running on the built-in simulator. Add API keys in Settings → Integrations to go live."
              >
                Demo data
              </Badge>
            )}
          </div>

          <h1
            id="hero-title"
            className="mt-6 font-display text-[2.6rem] leading-[0.95] tracking-tight text-fg sm:text-6xl lg:text-[4.5rem] xl:text-7xl"
          >
            See every seat.
            <br />
            <span className="text-gradient-signal">Spend fewer points.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-fg-muted pretty-text sm:text-lg">
            Live award search across 40+ airline and hotel programs, transfer-partner math that knows this
            week&apos;s bonuses, and an AI concierge that does the legwork.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/search" size="lg" leading={<Search />}>
              Search award seats
            </Button>
            <Button href="/concierge" variant="secondary" size="lg" leading={<Sparkles className="text-violet" />}>
              Try the concierge
            </Button>
          </div>

          <HeroSearch className="mt-8" />

          <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">
            <span>Free to use</span>
            <span aria-hidden="true">·</span>
            <span>No card scraping</span>
            <span aria-hidden="true">·</span>
            <span>Demo data is always badged</span>
          </p>
        </div>

        <div className="relative -mx-4 h-[340px] sm:mx-0 sm:h-[480px] lg:h-[620px]">
          <GlobeHero className="h-full" ariaLabel="Rotating globe with flagship award routes" />
          {/* Phones scroll past the globe instead of grabbing it; it keeps turning on its own. */}
          <div className="absolute inset-0 z-10 lg:hidden" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle sm:left-2">
            <span className="size-1.5 rounded-full bg-aurora" aria-hidden="true" />
            Flagship award routes
          </div>
        </div>
      </Container>

      <div className="hairline" aria-hidden="true" />
    </section>
  );
}
