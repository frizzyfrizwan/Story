import type { Metadata } from "next";
import { integrationStatus } from "@/env";
import { getDeals } from "@/lib/providers";
import { countFinds, listFinds } from "@/lib/repo/finds";
import type { Deal, Find } from "@/lib/types";
import { todayISO } from "@/lib/utils";
import { Community } from "@/components/home/community";
import { Coverage } from "@/components/home/coverage";
import { DealsSection } from "@/components/home/deals-section";
import { FeatureTour } from "@/components/home/feature-tour";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { PricingTeaser } from "@/components/home/pricing-teaser";

export const metadata: Metadata = {
  title: { absolute: "Kestrel — See every seat. Spend fewer points." },
};

// Deals roll over daily and the finds feed is live; render per request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const status = integrationStatus();
  const today = todayISO();

  const [dealsR, findsR, countR] = await Promise.allSettled([
    getDeals({ limit: 8 }),
    listFinds({ limit: 6, sort: "top" }),
    countFinds(),
  ]);

  const deals: Deal[] = dealsR.status === "fulfilled" ? dealsR.value.slice(0, 8) : [];
  const finds: Find[] = findsR.status === "fulfilled" ? findsR.value.items : [];
  const findCount = countR.status === "fulfilled" ? countR.value : finds.length;

  return (
    <>
      <Hero demoMode={status.demoMode} />
      <DealsSection deals={deals} />
      <HowItWorks />
      <Coverage finds={findCount} />
      <FeatureTour today={today} />
      <Community finds={finds.slice(0, 3)} />
      <PricingTeaser />
      <FinalCta />
    </>
  );
}
