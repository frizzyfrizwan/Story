"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeftRight, Search, Sparkles } from "lucide-react";
import { apiGet } from "@/lib/client/api";
import { addDays, cn, todayISO } from "@/lib/utils";
import type { Airport, Cabin } from "@/lib/types";
import { AirportCombobox, type AirportFetcher } from "@/components/ui/airport-combobox";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CabinPicker, SegmentedControl, type SegmentedOption } from "@/components/ui/segmented";
import { focusRing } from "@/components/ui/tokens";

const fetchAirports: AirportFetcher = (q) => apiGet<Airport[]>("/api/airports", { q });

const EXAMPLES = [
  "Business to Tokyo in May for two with Amex",
  "First class to Paris on Chase points",
  "Cheapest lie-flat to Lisbon in June",
];

type Mode = "route" | "ask";

const MODES: SegmentedOption<Mode>[] = [
  { value: "route", label: "Route", icon: <Search /> },
  { value: "ask", label: "Describe it", icon: <Sparkles />, accent: "violet" },
];

/** Hero quick search: from / to / cabin → /search, or a plain-English line → /search?q=. */
export function HeroSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("route");
  const [from, setFrom] = useState<string[]>([]);
  const [to, setTo] = useState<string[]>([]);
  const [cabin, setCabin] = useState<Cabin>("business");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const go = (href: string) => {
    setBusy(true);
    router.push(href);
  };

  const submitRoute = (e: FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (from[0]) sp.set("from", from[0]);
    if (to[0]) sp.set("to", to[0]);
    sp.set("cabin", cabin);
    sp.set("date", addDays(todayISO(), 45));
    go(`/search?${sp.toString()}`);
  };

  const submitAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    go(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className={cn("panel panel-strong p-2 sm:p-2.5", className)} role="search" aria-label="Quick award search">
      <div className="mb-2 flex items-center justify-between gap-3 px-1 pt-0.5">
        <SegmentedControl size="sm" value={mode} onChange={setMode} options={MODES} aria-label="Search mode" />
        <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle sm:inline">
          {mode === "route" ? "Departs in ~45 days · 1 traveler" : "Plain English works"}
        </span>
      </div>

      {mode === "route" ? (
        <form onSubmit={submitRoute} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <AirportCombobox
            label="From"
            placeholder="From"
            value={from}
            onChange={setFrom}
            fetcher={fetchAirports}
            recent={["JFK", "SFO", "LHR"]}
          />
          <IconButton
            label="Swap origin and destination"
            variant="secondary"
            className="hidden self-center sm:inline-flex"
            onClick={swap}
          >
            <ArrowLeftRight />
          </IconButton>
          <AirportCombobox
            label="To"
            placeholder="To"
            value={to}
            onChange={setTo}
            fetcher={fetchAirports}
            recent={["HND", "SIN", "CDG"]}
          />
          <div className="flex gap-2 sm:col-span-3">
            <CabinPicker value={cabin} onChange={setCabin} fullWidth className="min-w-0 flex-1" />
            <Button type="submit" variant="aurora" loading={busy} leading={<Search />}>
              Search
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitAsk} className="grid gap-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: 'business to Tokyo in May for two with Amex'"
              aria-label="Describe your trip"
              leading={<Sparkles className="text-violet" />}
              wrapperClassName="min-w-0 flex-1"
              autoComplete="off"
              enterKeyHint="search"
            />
            <Button type="submit" variant="aurora" loading={busy}>
              Ask
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-0.5 pb-0.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className={cn(
                  "rounded-full border border-panel-border bg-bg-elev-1 px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
                  focusRing,
                )}
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  );
}
