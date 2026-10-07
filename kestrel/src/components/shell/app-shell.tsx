"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Compass, BedDouble, Radar, Wallet, Users, Sparkles, Sun, Moon, Menu, X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { KestrelWordmark } from "@/components/brand/logo";
import type { IntegrationStatus } from "@/env";

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

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "light" || t === "dark") setTheme(t);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("kestrel.theme", next);
    } catch {}
  };
  return { theme, toggle };
}

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
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-panel-border bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Kestrel home">
            <KestrelWordmark />
          </Link>

          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-fg/10 text-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {status.demoMode && (
              <span
                className="hidden rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[11px] font-medium tracking-wide text-gold md:inline-flex"
                title="Running with the built-in simulator. Add API keys to go live."
              >
                DEMO DATA
              </span>
            )}
            <button
              type="button"
              onClick={toggle}
              className="grid size-9 place-items-center rounded-full text-fg-muted transition hover:bg-fg/5 hover:text-fg"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {user ? (
              <>
                <Link href="/alerts" className="grid size-9 place-items-center rounded-full text-fg-muted hover:bg-fg/5 hover:text-fg" aria-label="Alerts">
                  <Bell className="size-4" />
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded-full border border-panel-border bg-bg-elev-2 py-1 pl-1 pr-3 text-sm text-fg hover:border-panel-border-strong"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-signal to-violet text-[11px] font-semibold text-signal-fg">
                    {(user.name ?? user.email ?? "K").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[10ch] truncate sm:inline">{user.name?.split(" ")[0] ?? "Account"}</span>
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-full text-fg-muted hover:bg-fg/5 lg:hidden"
              aria-label="Menu"
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-panel-border bg-bg-elev-1 px-4 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-xl border border-panel-border px-3 py-2.5 text-sm text-fg-muted hover:text-fg"
                >
                  <item.icon className="size-4" /> {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className={cn("flex-1", !isHome && "pb-20 lg:pb-0")}>{children}</main>

      {!isHome && (
        <footer className="hidden border-t border-panel-border py-8 text-center text-xs text-fg-subtle lg:block">
          Kestrel · Award data is informational; confirm with the program before booking.
        </footer>
      )}

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-panel-border bg-bg/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobile"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium tracking-wide",
                    active ? "text-signal" : "text-fg-subtle",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
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
