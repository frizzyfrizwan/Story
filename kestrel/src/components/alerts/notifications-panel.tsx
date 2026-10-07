"use client";

import Link from "next/link";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { SkeletonCard } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { relativeTime } from "@/components/explore/format";
import { cn } from "@/lib/utils";
import { useMarkRead, useNotifications, type NotificationItem } from "./use-alerts";

function NotificationRow({ n, now, onRead }: { n: NotificationItem; now: number; onRead: () => void }) {
  const body = (
    <>
      <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center" aria-hidden="true">
        {!n.read && <span className="size-2 rounded-full bg-signal" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-snug", n.read ? "text-fg-muted" : "font-medium text-fg")}>{n.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-fg-subtle">{n.body}</span>
      </span>
      <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{relativeTime(n.createdAt, now)}</span>
    </>
  );
  const classes = cn("flex w-full items-start gap-3 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors hover:bg-fg/[0.04]", focusRing);
  return n.href ? (
    <Link href={n.href} className={classes} onClick={onRead} aria-label={`${n.title}${n.read ? "" : " (unread)"}`}>
      {body}
    </Link>
  ) : (
    <button type="button" className={classes} onClick={onRead} aria-label={`${n.title}${n.read ? "" : " (unread)"} — mark read`}>
      {body}
    </button>
  );
}

export function NotificationsPanel({ enabled = true, now, limit = 8 }: { enabled?: boolean; now: number; limit?: number }) {
  const q = useNotifications(enabled);
  const markRead = useMarkRead();
  const unread = q.data?.unread ?? 0;
  const items = q.data?.notifications ?? [];

  return (
    <Panel
      padding="sm"
      eyebrow="Inbox"
      title={
        <span className="flex items-center gap-2">
          Notifications
          {unread > 0 && (
            <Badge variant="signal" size="sm" dot>
              {unread} new
            </Badge>
          )}
        </span>
      }
      actions={
        <Button size="sm" variant="ghost" leading={<CheckCheck />} disabled={unread === 0 || markRead.isPending} onClick={() => markRead.mutate(undefined)}>
          Mark all read
        </Button>
      }
    >
      {q.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} variant="row" className="border-0 bg-transparent px-2" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState compact illustration="none" icon={<Bell />} title="You're all caught up" description="Alert hits and account updates show up here." className="py-6" />
      ) : (
        <ul className="-mx-2 flex flex-col" aria-label="Notifications">
          {items.slice(0, limit).map((n) => (
            <li key={n.id}>
              <NotificationRow n={n} now={now} onRead={() => !n.read && markRead.mutate([n.id])} />
            </li>
          ))}
          {items.length > limit && (
            <li className="px-2 pt-2 text-xs text-fg-subtle">
              <BellRing className="mr-1 inline size-3" aria-hidden="true" />
              {items.length - limit} older
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}
