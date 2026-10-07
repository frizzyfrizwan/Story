"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CalendarDays, Compass, Tag, X } from "lucide-react";
import { AirportCombobox } from "@/components/ui/airport-combobox";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Section } from "@/components/ui/panel";
import { CabinPicker } from "@/components/ui/segmented";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Cabin } from "@/lib/types";
import { fetchAirports, POPULAR_ORIGINS } from "./airports";
import { CalendarTab } from "./calendar-tab";
import { DealsTab } from "./deals-tab";
import type { DealSort, ExploreView } from "./format";
import { ReachTab } from "./reach-tab";

export interface ExploreState {
  view: ExploreView;
  from: string;
  to: string;
  cabin: Cabin;
  sort: DealSort;
  mine: boolean;
}

export interface ExploreExperienceProps {
  initial: ExploreState;
  signedIn: boolean;
  /** Home airport from the profile — used as the default origin. */
  homeAirport?: string | null;
}

const DEFAULTS: Pick<ExploreState, "view" | "cabin" | "sort" | "mine"> = { view: "deals", cabin: "business", sort: "value", mine: false };

function toQuery(state: ExploreState): string {
  const sp = new URLSearchParams();
  if (state.view !== DEFAULTS.view) sp.set("view", state.view);
  if (state.from) sp.set("from", state.from);
  if (state.to) sp.set("to", state.to);
  if (state.cabin !== DEFAULTS.cabin) sp.set("cabin", state.cabin);
  if (state.sort !== DEFAULTS.sort) sp.set("sort", state.sort);
  if (state.mine) sp.set("mine", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Explore — three tabs on one URL: `view=deals|calendar|reach`, `from`, `to`, `cabin`, `sort`, `mine`.
 * Local state is the source of truth; the URL is kept in sync with `router.replace` so links are shareable.
 */
export function ExploreExperience({ initial, signedIn, homeAirport }: ExploreExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<ExploreState>(() => ({ ...initial, from: initial.from || homeAirport || "" }));

  const update = useCallback(
    (patch: Partial<ExploreState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        router.replace(`${pathname}${toQuery(next)}`, { scroll: false });
        return next;
      });
    },
    [router, pathname],
  );

  return (
    <div className="flex flex-col">
      <div className="aurora-bg">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
          <Section
            eyebrow="Explore"
            title="Where can your points take you?"
            description="Curated award deals, 90-day availability calendars for any route, and a map of everything your balances can already reach."
          />
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <Field label="From" labelHidden className="w-full min-w-[220px] sm:w-80">
              <AirportCombobox
                value={state.from ? [state.from] : []}
                onChange={(codes) => update({ from: codes[0] ?? "" })}
                fetcher={fetchAirports}
                placeholder="Any origin"
                recent={Array.from(new Set([homeAirport, ...POPULAR_ORIGINS].filter((c): c is string => Boolean(c))))}
                label="Origin airport"
              />
            </Field>
            <CabinPicker value={state.cabin} onChange={(cabin) => update({ cabin })} size="md" />
            {state.from && (
              <Button variant="ghost" size="sm" onClick={() => update({ from: "" })} leading={<X />} className="text-fg-muted">
                Any origin
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <Tabs value={state.view} onValueChange={(v) => update({ view: v as ExploreView })}>
          <TabsList variant="underline" aria-label="Explore views">
            <TabsTrigger value="deals" icon={<Tag />}>
              Deals
            </TabsTrigger>
            <TabsTrigger value="calendar" icon={<CalendarDays />}>
              Calendar
            </TabsTrigger>
            <TabsTrigger value="reach" icon={<Compass />}>
              Where can I go
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deals">
            <DealsTab
              origin={state.from}
              cabin={state.cabin}
              sort={state.sort}
              onSortChange={(sort) => update({ sort })}
              mine={state.mine}
              onMineChange={(mine) => update({ mine })}
              onClearOrigin={() => update({ from: "" })}
              signedIn={signedIn}
            />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarTab origin={state.from} destination={state.to} cabin={state.cabin} onRouteChange={(from, to) => update({ from, to })} />
          </TabsContent>
          <TabsContent value="reach">
            <ReachTab origin={state.from} cabin={state.cabin} signedIn={signedIn} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
