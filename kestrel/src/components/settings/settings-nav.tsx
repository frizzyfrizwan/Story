"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Plug, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/tokens";

const ITEMS = [
  { href: "/settings", label: "Profile", icon: UserRound },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
] as const;

/** Settings sub-navigation: a pill track of links with a sliding active indicator. */
export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/settings" ? pathname === "/settings" : pathname.startsWith(href));

  return (
    <nav aria-label="Settings sections" className={className}>
      <ul className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-panel-border bg-bg-elev-1 p-1 scrollbar-none">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
                  active ? "text-fg" : "text-fg-muted hover:text-fg",
                  focusRing,
                )}
              >
                {active && (
                  <motion.span
                    layoutId="kestrel-settings-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-panel-border-strong bg-bg-elev-3 shadow-panel"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-2">
                  <item.icon className={cn("size-4", active ? "text-signal" : "opacity-70")} aria-hidden="true" />
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
