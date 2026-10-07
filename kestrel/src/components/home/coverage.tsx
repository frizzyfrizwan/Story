import type { LoyaltyProgram } from "@/lib/types";
import { AIRLINE_PROGRAMS, BANK_PROGRAMS, HOTEL_LOYALTY_PROGRAMS, PROGRAMS } from "@/data/programs";
import { HOTELS, HOTEL_CITIES } from "@/data/hotels";
import { ROUTES } from "@/data/routes";
import { AIRPORTS } from "@/data/airports";
import { ProgramLogo } from "@/components/art";
import { Marquee } from "@/components/ui/marquee";
import { CoverageStats } from "./coverage-stats";
import { Accent, HomeSection } from "./home-section";
import { Reveal } from "./reveal";

function ProgramPill({ p }: { p: LoyaltyProgram }) {
  return (
    <span className="inline-flex h-11 items-center gap-2.5 rounded-full border border-panel-border bg-bg-elev-1 pl-1 pr-4 shadow-panel">
      <ProgramLogo id={p.id} name={p.name} color={p.color} size={32} />
      <span className="whitespace-nowrap text-sm font-medium text-fg">{p.shortName}</span>
    </span>
  );
}

export function Coverage({ finds }: { finds: number }) {
  const routes = ROUTES.length;
  return (
    <HomeSection
      id="coverage"
      eyebrow="Coverage"
      title={
        <>
          Every program that matters, <Accent className="text-aurora">in one search.</Accent>
        </>
      }
      description="Airline programs across all three alliances, the big hotel charts, and the bank currencies that feed them. If points can buy a seat, Kestrel knows how to price it."
    >
      <Reveal className="space-y-3">
        <Marquee speed={34} gap={12} aria-label="Airline programs">
          {AIRLINE_PROGRAMS.map((p) => (
            <ProgramPill key={p.id} p={p} />
          ))}
        </Marquee>
        <Marquee speed={26} gap={12} direction="right" aria-label="Bank and hotel programs">
          {[...BANK_PROGRAMS, ...HOTEL_LOYALTY_PROGRAMS].map((p) => (
            <ProgramPill key={p.id} p={p} />
          ))}
        </Marquee>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <CoverageStats
          programs={PROGRAMS.length}
          hotels={HOTELS.length}
          cities={HOTEL_CITIES.length}
          routes={routes}
          airports={AIRPORTS.length}
          finds={finds}
        />
      </Reveal>
    </HomeSection>
  );
}
