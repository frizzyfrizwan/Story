import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms, privacy and cookies",
  description: "How Kestrel handles your data, what the award information means, and the terms of use.",
};

const SECTIONS = [
  {
    id: "terms",
    title: "Terms of use",
    body: [
      "Kestrel is an information service. Award prices, availability, transfer ratios and valuations are gathered from loyalty programs, partner APIs and editorial research, and can change at any moment. Confirm every redemption with the program before transferring points; transfers are irreversible and Kestrel is not a party to any booking.",
      "Results marked DEMO DATA or simulated come from a deterministic model built on published award charts and real route networks. They illustrate how the product works and are not live inventory.",
      "You may use Kestrel for personal, non-commercial travel planning. Automated scraping of the service, reselling its data, or using it to broker miles is not permitted. Community posts must not contain referral links, confirmation numbers or other people's personal details.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      "We store what you give us: your sign-in email, profile, point balances you enter, alerts, saved trips and anything you post to Finds. Balances are private to your account and are never shown to other members.",
      "Kestrel never asks for loyalty program passwords and does not log in to programs on your behalf. Live availability comes from licensed data partners, not from your accounts.",
      "When the AI concierge is enabled, the messages you send and a summary of your wallet are sent to Anthropic to generate a reply. Usage is logged as token counts only. Email delivery uses Resend; payments use Stripe, which holds your card details, not Kestrel.",
      "You can export or delete your data by contacting support from the Settings page. Deleting your account removes your profile, balances, alerts, trips and posts.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and storage",
    body: [
      "Kestrel sets a session cookie to keep you signed in and a CSRF token to protect forms. There are no advertising or cross-site tracking cookies.",
      "Your browser's local storage remembers conveniences only: theme, dismissed banners, the last concierge conversation and recent searches. Clearing site data resets them.",
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Legal</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Terms, privacy and cookies</h1>
      <p className="mt-4 text-fg-muted">Last updated October 2026. Written to be read, not skimmed.</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-panel-border px-3 py-1 text-sm text-fg-muted hover:text-fg">
            {s.title}
          </a>
        ))}
      </nav>
      <div className="mt-10 space-y-12">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="font-display text-2xl tracking-tight">{s.title}</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-fg-muted">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
