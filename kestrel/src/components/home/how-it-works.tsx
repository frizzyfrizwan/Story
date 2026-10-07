import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { AlertGlyph, ScanGlyph, TransferGlyph } from "./glyphs";
import { Accent, HomeSection } from "./home-section";
import { Reveal } from "./reveal";

type Tone = "aurora" | "signal" | "violet";

const TONE: Record<Tone, string> = {
  aurora: "bg-aurora-soft text-aurora",
  signal: "bg-signal-soft text-signal",
  violet: "bg-violet-soft text-violet",
};

const STEPS: { n: string; title: string; body: string; glyph: ReactNode; tone: Tone }[] = [
  {
    n: "01",
    title: "Search every program at once",
    body: "One query fans out across 40+ airline and hotel programs — Aeroplan, LifeMiles, KrisFlyer, Flying Blue and the rest — and comes back as a single ranked list with taxes, seat counts and a value score.",
    glyph: <ScanGlyph />,
    tone: "aurora",
  },
  {
    n: "02",
    title: "Pay with the right points",
    body: "Kestrel knows which bank currencies transfer where, at what ratio, and which bonus is running this week, so every fare shows the cheapest way in from the points you already hold.",
    glyph: <TransferGlyph />,
    tone: "signal",
  },
  {
    n: "03",
    title: "Get alerted when seats open",
    body: "Set a route, a window and a cabin. We keep re-checking inventory and ping you by email or push the moment space appears, with the booking link ready to go.",
    glyph: <AlertGlyph />,
    tone: "violet",
  },
];

export function HowItWorks() {
  return (
    <HomeSection
      id="how"
      eyebrow="How it works"
      title={
        <>
          Three steps from points to a <Accent className="text-signal">lie-flat seat.</Accent>
        </>
      }
      description="The work an award-booking expert does by hand — checking a dozen programs, doing the transfer math, watching for space — happens in one place, every time."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} as="li" delay={i * 0.08} className="flex">
            <Panel grain as="div" padding="lg" className="flex w-full flex-col">
              <div className="flex items-start justify-between">
                <span className={cn("grid size-14 place-items-center rounded-[var(--radius)]", TONE[s.tone])}>
                  {s.glyph}
                </span>
                <span className="font-mono text-[11px] tracking-[0.22em] text-fg-subtle tnum">{s.n}</span>
              </div>
              <h3 className="mt-7 font-display text-xl leading-tight tracking-tight text-fg sm:text-2xl balance-text">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted pretty-text">{s.body}</p>
            </Panel>
          </Reveal>
        ))}
      </ol>
    </HomeSection>
  );
}
