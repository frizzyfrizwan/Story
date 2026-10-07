"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import {
  BedDouble,
  Bell,
  ChevronDown,
  Command as CommandIcon,
  Compass,
  LogIn,
  LogOut,
  Luggage,
  Menu,
  Moon,
  Radar,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrationStatus } from "@/env";
import { KestrelWordmark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Kbd } from "@/components/ui/kbd";
import { focusRing } from "@/components/ui/tokens";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/components/ui/use-theme";
import { CommandPalette } from "./command-palette";
import { DemoBanner } from "./demo-banner";
import { Footer } from "./footer";

export type ShellUser = { id: string; name?: string | null; email?: string | null; image?: string | null } | null;

const NAV = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/hotels", label: "Hotels", icon: BedDouble },
  { href: "/live", label: "Live", icon: Radar },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/finds", label: "Finds", icon: Users },
  { href: "/concierge", label: "Concierge", icon: Sparkles },
] as const;

const MOBILE_NAV = [NAV[0], NAV[1], NAV[3], NAV[5], NAV[6]];

const ACCOUNT_LINKS = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/trips", label: "Trips", icon: Luggage },
] as const;

export function AppShell({
  children,
  user,
  status,
}: {
  children: React.ReactNode;
  user: ShellUser;
  status: IntegrationStatus;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isHome = pathname === "/";
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const firstName = user?.name?.split(" ")[0] ?? "Account";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-signal-fg"
      >
        Skip to content
      </a>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Kestrel home" className={cn("flex shrink-0 items-center rounded-full", focusRing)}>
            <KestrelWordmark />
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
                    active ? "text-fg" : "text-fg-muted hover:text-fg",
                    focusRing,
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="kestrel-nav-pill"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-panel-border-strong bg-bg-elev-2 shadow-panel"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <item.icon
                      className={cn("hidden size-3.5 xl:block", active ? "text-signal" : "opacity-60")}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                "hidden h-9 items-center gap-2 rounded-full border border-panel-border bg-bg-elev-1 pl-3 pr-1.5 text-[13px] text-fg-subtle transition-colors hover:border-panel-border-strong hover:text-fg md:inline-flex",
                focusRing,
              )}
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap pr-3">Search or jump to…</span>
              <Kbd keys={["mod", "K"]} />
            </button>
            <IconButton
              label="Open command palette"
              size="sm"
              className="md:hidden"
              onClick={() => setPaletteOpen(true)}
            >
              <Search />
            </IconButton>

            {status.demoMode && (
              <Badge
                variant="gold"
                size="sm"
                dot
                caps
                className="mx-1 hidden xl:inline-flex"
                title="Running on the built-in simulator. Add API keys in Settings → Integrations to go live."
              >
                Demo data
              </Badge>
            )}

            <Tooltip content={theme === "dark" ? "Light theme" : "Dark theme"}>
              <IconButton label={themeLabel} size="sm" onClick={toggle}>
                <ThemeIcon />
              </IconButton>
            </Tooltip>

            {user ? (
              <>
                <Tooltip content="Alerts">
                  <IconButton label="Alerts" size="sm" href="/alerts" className="hidden sm:inline-flex">
                    <Bell />
                  </IconButton>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className={cn(
                        "ml-1 flex h-9 items-center gap-2 rounded-full border border-panel-border bg-bg-elev-1 py-0.5 pl-0.5 pr-2.5 text-sm text-fg transition-colors hover:border-panel-border-strong data-[state=open]:border-panel-border-strong",
                        focusRing,
                      )}
                    >
                      <Avatar seed={user.id} name={user.name ?? user.email} src={user.image} size="sm" />
                      <span className="hidden max-w-[10ch] truncate sm:inline">{firstName}</span>
                      <ChevronDown className="hidden size-3.5 text-fg-subtle sm:block" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="flex items-center gap-3 px-2.5 py-2">
                      <Avatar seed={user.id} name={user.name ?? user.email} src={user.image} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{user.name ?? "Traveler"}</p>
                        {user.email && <p className="truncate text-xs text-fg-subtle">{user.email}</p>}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {ACCOUNT_LINKS.map((l) => (
                      <DropdownMenuItem key={l.href} href={l.href} icon={<l.icon />}>
                        {l.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={<ThemeIcon />} onSelect={toggle}>
                      {theme === "dark" ? "Light theme" : "Dark theme"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      icon={<CommandIcon />}
                      shortcut={["mod", "K"]}
                      onSelect={() => setTimeout(() => setPaletteOpen(true), 10)}
                    >
                      Command palette
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem href="/logout" icon={<LogOut />} destructive>
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button href="/login" size="sm" className="ml-1">
                Sign in
              </Button>
            )}

            <IconButton
              label="Menu"
              size="sm"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
            >
              <Menu />
            </IconButton>
          </div>
        </div>
        <div className="hairline" aria-hidden="true" />
      </header>

      {status.demoMode && <DemoBanner />}

      {/* ── Mobile menu sheet ──────────────────────────────── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" title="Menu" eyebrow="Kestrel" flush>
          <nav aria-label="Mobile menu" className="px-3 pb-3">
            <ul className="grid grid-cols-2 gap-2">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-[var(--radius)] border px-3.5 text-sm font-medium transition-colors",
                        active
                          ? "border-signal/40 bg-signal-soft text-fg"
                          : "border-panel-border bg-bg-elev-1 text-fg-muted hover:border-panel-border-strong hover:text-fg",
                        focusRing,
                      )}
                    >
                      <item.icon className={cn("size-4", active && "text-signal")} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1">
              {user ? (
                <>
                  <div className="flex items-center gap-3 border-b border-panel-border px-3.5 py-3">
                    <Avatar seed={user.id} name={user.name ?? user.email} src={user.image} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{user.name ?? "Traveler"}</p>
                      {user.email && <p className="truncate text-xs text-fg-subtle">{user.email}</p>}
                    </div>
                  </div>
                  {ACCOUNT_LINKS.map((l) => (
                    <MenuRow key={l.href} href={l.href} icon={<l.icon />} onClick={() => setMenuOpen(false)}>
                      {l.label}
                    </MenuRow>
                  ))}
                </>
              ) : (
                <MenuRow href="/login" icon={<LogIn />} onClick={() => setMenuOpen(false)}>
                  Sign in
                </MenuRow>
              )}
              <MenuRow icon={<ThemeIcon />} onClick={toggle}>
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </MenuRow>
              {user && (
                <MenuRow href="/logout" icon={<LogOut />} onClick={() => setMenuOpen(false)} className="text-rose">
                  Sign out
                </MenuRow>
              )}
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <main id="main" className={cn("flex-1", !isHome && "pb-20 lg:pb-0")}>
        {children}
      </main>

      {!isHome && <Footer />}

      {/* ── Mobile tab bar ─────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-panel-border bg-bg/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-wide transition-colors",
                    active ? "text-signal" : "text-fg-subtle hover:text-fg",
                    focusRing,
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="kestrel-tab-indicator"
                      aria-hidden="true"
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-signal"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function MenuRow({
  href,
  icon,
  onClick,
  className,
  children,
}: {
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    "flex min-h-12 w-full items-center gap-3 border-b border-panel-border px-3.5 text-left text-sm text-fg-muted transition-colors last:border-b-0 hover:bg-fg/5 hover:text-fg [&_svg]:size-4 [&_svg]:text-fg-subtle",
    focusRing,
    className,
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {icon}
      {children}
    </button>
  );
}
