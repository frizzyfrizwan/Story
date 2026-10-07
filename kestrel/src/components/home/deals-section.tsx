import type { Deal } from "@/lib/types";
import { Accent, HomeSection } from "./home-section";
import { LiveBoard } from "./live-board";

export function DealsSection({ deals }: { deals: Deal[] }) {
  const source = deals[0]?.source ?? "simulated";
  return (
    <HomeSection
      id="board"
      className="pt-16 sm:pt-20"
      eyebrow="On the board"
      title={
        <>
          Seats that are open <Accent className="text-aurora">right now.</Accent>
        </>
      }
      description="Kestrel scans flagship city pairs every day and flags the fares worth moving points for: sweet spots, wide-open dates and rare premium cabins."
    >
      <LiveBoard deals={deals} source={source} />
    </HomeSection>
  );
}
