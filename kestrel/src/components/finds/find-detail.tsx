"use client";

/**
 * <FindDetail> — the main column of /finds/[id]. Hydrates the server-rendered find into the detail
 * query so likes and comments update in place; the Markdown body arrives as server-rendered
 * `children`.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronLeft, MessageCircle, Search, Trash2 } from "lucide-react";
import { cn, fmtInt } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { focusRing } from "@/components/ui/tokens";
import { Comments } from "./comments";
import { AuthorRow, CopyLinkButton, LikeButton, RedemptionStrip, TagChips } from "./find-card";
import { routeSearchHref } from "./format";
import { useDeleteFind, useFindDetail, type FindDetail as FindDetailData } from "./use-finds";
import { useViewer } from "./viewer";

export function FindDetail({ initial, children }: { initial: FindDetailData; children: ReactNode }) {
  const { data } = useFindDetail(initial.find.id, initial);
  const { id: viewerId } = useViewer();
  const find = data?.find ?? initial.find;
  const comments = data?.comments ?? initial.comments;
  const path = `/finds/${find.id}`;
  const searchHref = routeSearchHref(find);
  const mine = viewerId != null && viewerId === find.author.id;

  return (
    <article className="min-w-0" aria-labelledby="find-title">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/finds"
          className={cn("inline-flex items-center gap-1 rounded-full text-sm text-fg-muted transition-colors hover:text-fg", focusRing)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          All finds
        </Link>
      </nav>

      <AuthorRow author={find.author} createdAt={find.createdAt} size="md" trailing={mine ? <DeleteFind findId={find.id} /> : undefined} />

      <h1 id="find-title" className="mt-5 font-display text-3xl leading-[1.08] tracking-tight text-fg sm:text-4xl lg:text-[2.75rem] balance-text">
        {find.title}
      </h1>

      <RedemptionStrip find={find} size="lg" className="mt-6" />

      <div className="mt-7">{children}</div>

      <TagChips tags={find.tags} size="md" className="mt-6" />

      <div className="mt-6 flex flex-wrap items-center gap-1 border-y border-panel-border py-2">
        <LikeButton find={find} size="md" />
        <a
          href="#comments"
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg",
            focusRing,
          )}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          <span className="font-mono tnum">{fmtInt(comments.length)}</span>
        </a>
        <CopyLinkButton path={path} size="md" />
        {searchHref && (
          <Button href={searchHref} variant="ghost" size="md" leading={<Search />} className="ml-auto text-aurora hover:bg-aurora-soft hover:text-aurora">
            Search this route
          </Button>
        )}
      </div>

      <Comments findId={find.id} comments={comments} className="mt-10" />
    </article>
  );
}

function DeleteFind({ findId }: { findId: string }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteFind(findId);
  return (
    <>
      <Button variant="ghost" size="sm" leading={<Trash2 />} onClick={() => setOpen(true)} className="text-fg-subtle hover:text-rose">
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          title="Delete this find?"
          description="It disappears from the feed for everyone, along with its likes and comments."
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>
                Delete
              </Button>
            </>
          }
        />
      </Dialog>
    </>
  );
}
