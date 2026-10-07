import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { trendingTags } from "@/lib/repo/finds";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { focusRing } from "@/components/ui/tokens";
import { ComposeForm } from "@/components/finds/compose-form";

export const metadata: Metadata = {
  title: "Share a find",
  description: "Post a redemption you booked — route, cabin, program, miles and the story behind it.",
};

export default async function NewFindPage() {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=${encodeURIComponent("/finds/new")}`);
  const tags = await trendingTags(10);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/finds" className={cn("inline-flex items-center gap-1 rounded-full text-sm text-fg-muted transition-colors hover:text-fg", focusRing)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          All finds
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <div className="min-w-0 max-w-3xl">
          <header>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Community</p>
            <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl">Share a find</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-muted pretty-text">
              The redemption you&apos;re proud of. Tell people what you booked and how, so they can do it too.
            </p>
          </header>
          <div className="mt-8">
            <ComposeForm suggestedTags={tags.map((t) => t.tag)} />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5">
            <Panel eyebrow="Tips" title="A great find has" padding="sm" grain>
              <ul className="flex flex-col gap-3 text-[13px] leading-relaxed text-fg-muted">
                {[
                  ["The ticket", "Route, cabin, program, miles and taxes. It becomes searchable."],
                  ["The trick", "The alert, the transfer bonus, the day-of-week pattern that made it work."],
                  ["The verdict", "Was it worth it? Would you do it again?"],
                  ["Tags", "Program and sweet-spot names so others can find it later."],
                ].map(([h, body]) => (
                  <li key={h} className="flex gap-2.5">
                    <Sparkles className="mt-1 size-3.5 shrink-0 text-signal" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-fg">{h}.</span> {body}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel eyebrow="House rules" padding="sm">
              <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-fg-muted">
                <li>No referral links or affiliate codes.</li>
                <li>No buying, selling or brokering miles.</li>
                <li>Keep confirmation numbers and names out of screenshots.</li>
                <li>Be kind — everyone was new once.</li>
              </ul>
            </Panel>
          </div>
        </aside>
      </div>
    </div>
  );
}
