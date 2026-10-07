import type { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: { default: "Settings", template: "%s · Settings · Kestrel" } };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Account</p>
          <h1 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight text-fg sm:text-4xl">Settings</h1>
        </div>
        <SettingsNav />
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}
