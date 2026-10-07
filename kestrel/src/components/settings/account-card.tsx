"use client";

import { useState } from "react";
import { CreditCard, LogOut, Mail, TriangleAlert } from "lucide-react";
import { fmtDate, parseISODate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";

export interface AccountCardProps {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  handle: string;
  plan: "free" | "pro";
  /** ISO timestamp of profile creation. */
  memberSince: string;
  /** Mailbox that handles deletion requests in this build. */
  supportEmail?: string;
}

/** Who's signed in, which plan, since when — plus sign-out and the (honest) danger zone. */
export function AccountCard({
  userId,
  name,
  email,
  image,
  handle,
  plan,
  memberSince,
  supportEmail = "support@kestrel.travel",
}: AccountCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const since = fmtDate(parseISODate(memberSince), { weekday: undefined, year: "numeric" });
  const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent("Delete my Kestrel account")}&body=${encodeURIComponent(
    `Please delete the Kestrel account for ${email ?? "(no email on file)"} (@${handle}).\n\nI understand this removes my profile, wallet balances, alerts, trips and finds.`,
  )}`;

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <Panel as="div" eyebrow="Account" title="Signed in">
        <div className="flex items-center gap-3">
          <Avatar seed={userId} name={name ?? email} src={image} size="lg" status={plan === "pro" ? "pro" : undefined} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{name ?? "Traveler"}</p>
            {email && <p className="truncate text-[13px] text-fg-muted">{email}</p>}
            <p className="mt-0.5 font-mono text-[11px] text-fg-subtle">@{handle}</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">Plan</dt>
            <dd className="mt-1">
              {plan === "pro" ? (
                <Badge variant="gold" caps dot>
                  Pro
                </Badge>
              ) : (
                <Badge variant="outline" caps>
                  Free
                </Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">Member since</dt>
            <dd className="mt-1 font-mono tnum text-[13px] text-fg">{since}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          <Button href="/settings/billing" variant="secondary" size="sm" leading={<CreditCard />} className="justify-start">
            {plan === "pro" ? "Manage billing" : "Upgrade to Pro"}
          </Button>
          {/* A POST form rather than a link: Next would prefetch a GET /logout and sign the user out on hover. */}
          <form method="post" action="/logout">
            <Button type="submit" variant="outline" size="sm" leading={<LogOut />} className="w-full justify-start">
              Sign out
            </Button>
          </form>
        </div>
      </Panel>

      <Panel as="div" padding="sm" className="border-rose/25">
        <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-rose">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          Danger zone
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          Deleting your account removes your profile, balances, alerts, trips and finds. This can&apos;t be undone.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3 border-rose/40 text-rose hover:bg-rose-soft" onClick={() => setDeleteOpen(true)}>
          Delete account
        </Button>
      </Panel>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          size="sm"
          eyebrow="Delete account"
          title="Handled by a human, for now"
          description="Self-serve deletion isn't built yet. Email support from your account address and we'll erase everything tied to it within 7 days and confirm by reply."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button href={mailto} variant="danger" leading={<Mail />}>
                Email support
              </Button>
            </>
          }
        >
          <div className="rounded-[var(--radius-sm)] border border-panel-border bg-bg-elev-1 px-3.5 py-3 text-[13px] text-fg-muted">
            <p>
              To: <span className="font-mono text-fg">{supportEmail}</span>
            </p>
            <p className="mt-1">
              From: <span className="font-mono text-fg">{email ?? "your account email"}</span>
            </p>
            <p className="mt-2 text-fg-subtle">Nothing is deleted until support confirms. Signing out does not delete anything.</p>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
