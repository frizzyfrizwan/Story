"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BedDouble,
  Bell,
  Compass,
  Luggage,
  Moon,
  PlaneTakeoff,
  Radar,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { menuItem, menuLabel } from "@/components/ui/tokens";
import { useTheme } from "@/components/ui/use-theme";

/** Fire from anywhere (a hero search box, a hint) to open the palette. */
export const COMMAND_PALETTE_EVENT = "kestrel:command-palette";
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
}

const NAVIGATE: NavEntry[] = [
  { href: "/search", label: "Search awards", icon: Search, keywords: ["flights", "seats", "miles"] },
  { href: "/explore", label: "Explore routes", icon: Compass, keywords: ["map", "globe", "destinations"] },
  { href: "/hotels", label: "Hotel awards", icon: BedDouble, keywords: ["hyatt", "marriott", "hilton"] },
  { href: "/live", label: "Live flights", icon: Radar, keywords: ["tracker", "status", "radar"] },
  { href: "/wallet", label: "Wallet", icon: Wallet, keywords: ["points", "balances", "transfer"] },
  { href: "/finds", label: "Community finds", icon: Users, keywords: ["deals", "feed"] },
  { href: "/concierge", label: "AI concierge", icon: Sparkles, keywords: ["chat", "ask", "assistant"] },
  { href: "/alerts", label: "Alerts", icon: Bell, keywords: ["notifications", "watch"] },
  { href: "/trips", label: "Trips", icon: Luggage, keywords: ["bookings", "itineraries"] },
  { href: "/settings", label: "Settings", icon: Settings, keywords: ["integrations", "api keys", "account"] },
];

const QUICK: { label: string; href: string; keywords?: string[] }[] = [
  {
    label: "Search JFK → LHR in business",
    href: "/search?from=JFK&to=LHR&cabin=business",
    keywords: ["london", "new york"],
  },
  { label: "Search NYC → TYO in first", href: "/search?from=NYC&to=TYO&cabin=first", keywords: ["tokyo"] },
  { label: "Search LAX → SYD in business", href: "/search?from=LAX&to=SYD&cabin=business", keywords: ["sydney"] },
  { label: "Open wallet", href: "/wallet" },
  { label: "Create an alert", href: "/alerts/new", keywords: ["watch", "notify"] },
  { label: "Ask the concierge", href: "/concierge", keywords: ["ai", "chat"] },
];

const ROUTE_RE = /^\s*([a-z]{3})\s*(?:->|→|–|-|to\s+|\s)\s*([a-z]{3})(?:\s+(economy|premium|business|first))?\s*$/i;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ⌘K palette: navigation, quick searches, route parsing ("jfk lhr business"), theme toggle. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState("");

  // ⌘K / Ctrl+K toggles; a custom event opens from elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    const onEvent = () => onOpenChange(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onEvent);
    };
  }, [open, onOpenChange]);

  const route = useMemo(() => {
    const m = ROUTE_RE.exec(query);
    if (!m) return null;
    const [, from, to, cabin] = m;
    return { from: from.toUpperCase(), to: to.toUpperCase(), cabin: cabin?.toLowerCase() ?? "business" };
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent
        bare
        grain={false}
        title="Command palette"
        size="md"
        className="sm:max-w-xl sm:self-start sm:mt-[12vh]"
      >
        <Command label="Command palette" loop className="flex max-h-[72dvh] flex-col">
          <div className="flex items-center gap-3 border-b border-panel-border px-4">
            <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, routes, actions…"
              className="h-14 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            />
            <Kbd keys={["esc"]} className="hidden sm:inline-flex" />
          </div>

          <Command.List className="flex-1 overflow-y-auto overscroll-contain p-2 scrollbar-thin">
            <Command.Empty className="px-4 py-10 text-center text-sm text-fg-subtle">
              Nothing found. Try an airport pair like <span className="font-mono text-fg-muted">JFK LHR</span>.
            </Command.Empty>

            {route && (
              <Command.Group>
                <Heading>Route</Heading>
                <Item
                  value={query}
                  forceMount
                  icon={<PlaneTakeoff />}
                  onSelect={() => go(`/search?from=${route.from}&to=${route.to}&cabin=${route.cabin}`)}
                  trailing={<ArrowRight className="size-4 text-fg-subtle" aria-hidden="true" />}
                >
                  Search{" "}
                  <span className="font-mono font-semibold">
                    {route.from} → {route.to}
                  </span>{" "}
                  in {route.cabin}
                </Item>
              </Command.Group>
            )}

            <Command.Group>
              <Heading>Navigate</Heading>
              {NAVIGATE.map((n) => (
                <Item key={n.href} value={n.label} keywords={n.keywords} icon={<n.icon />} onSelect={() => go(n.href)}>
                  {n.label}
                </Item>
              ))}
            </Command.Group>

            <Command.Group>
              <Heading>Quick actions</Heading>
              {QUICK.map((q) => (
                <Item
                  key={q.href}
                  value={q.label}
                  keywords={q.keywords}
                  icon={<PlaneTakeoff />}
                  onSelect={() => go(q.href)}
                >
                  {q.label}
                </Item>
              ))}
            </Command.Group>

            <Command.Group>
              <Heading>Preferences</Heading>
              <Item
                value="Toggle theme light dark"
                icon={theme === "dark" ? <Sun /> : <Moon />}
                onSelect={() => {
                  toggle();
                  onOpenChange(false);
                }}
              >
                Switch to {theme === "dark" ? "light" : "dark"} theme
              </Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center gap-4 border-t border-panel-border px-4 py-2 text-[11px] text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Kbd keys={["up"]} />
              <Kbd keys={["down"]} /> navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd keys={["enter"]} /> open
            </span>
            <span className="ml-auto font-mono uppercase tracking-[0.18em]">Kestrel</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <div className={menuLabel} aria-hidden="true">
      {children}
    </div>
  );
}

interface ItemProps {
  value: string;
  keywords?: string[];
  icon?: ReactNode;
  trailing?: ReactNode;
  onSelect: () => void;
  forceMount?: boolean;
  children: ReactNode;
}

function Item({ value, keywords, icon, trailing, onSelect, forceMount, children }: ItemProps) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      forceMount={forceMount}
      className={cn(menuItem, "group cursor-pointer")}
    >
      {icon && (
        <span className="grid size-5 shrink-0 place-items-center text-fg-subtle transition-colors group-data-[selected=true]:text-signal [&_svg]:size-4">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </Command.Item>
  );
}
