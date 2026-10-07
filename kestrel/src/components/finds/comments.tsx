"use client";

/**
 * Comment thread + composer for a find. The list comes from the detail query so a posted comment
 * appears instantly; the composer sends signed-out viewers to sign in and back.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { cn, pluralize } from "@/lib/utils";
import type { FindComment } from "@/lib/types";
import { loginHref } from "@/lib/client/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { RelativeTime } from "./find-card";
import { useAddComment } from "./use-finds";
import { useViewer } from "./viewer";
import Link from "next/link";
import { focusRing } from "@/components/ui/tokens";

const MAX = 2000;

export function Comments({ findId, comments, className }: { findId: string; comments: FindComment[]; className?: string }) {
  const { signedIn } = useViewer();
  const router = useRouter();
  const add = useAddComment(findId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      toast.info("Sign in to join the conversation");
      router.push(loginHref());
      return;
    }
    const text = body.trim();
    if (!text) {
      setError("Write something first.");
      return;
    }
    if (text.length > MAX) {
      setError(`Keep it under ${MAX} characters.`);
      return;
    }
    setError(null);
    add.mutate(text, {
      onSuccess: () => {
        setBody("");
        toast.success("Comment posted");
      },
    });
  };

  return (
    <section id="comments" className={cn("scroll-mt-24", className)} aria-labelledby="comments-title">
      <h2 id="comments-title" className="flex items-center gap-2 font-display text-xl tracking-tight text-fg sm:text-2xl">
        <MessageCircle className="size-5 text-signal" aria-hidden="true" />
        {comments.length ? pluralize(comments.length, "comment") : "Comments"}
      </h2>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No comments yet. Ask how they found it, or say congrats.</p>
      ) : (
        <ol className="mt-5 flex flex-col gap-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3 animate-rise">
              <Link href={`/u/${c.author.handle}`} className={cn("shrink-0 rounded-full", focusRing)} aria-label={`${c.author.name}'s profile`}>
                <Avatar seed={c.author.avatarSeed} name={c.author.name} size="sm" status={c.author.plan === "pro" ? "pro" : undefined} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <Link href={`/u/${c.author.handle}`} className={cn("rounded-[4px] font-medium text-fg hover:underline underline-offset-4", focusRing)}>
                    {c.author.name}
                  </Link>
                  <span className="font-mono text-xs text-fg-subtle">@{c.author.handle}</span>
                  {c.author.plan === "pro" && (
                    <Badge variant="gold" size="sm" caps>
                      Pro
                    </Badge>
                  )}
                  <span className="text-xs text-fg-subtle">
                    · <RelativeTime iso={c.createdAt} />
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-fg/90 pretty-text">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="mt-6 rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1/60 p-4 sm:p-5">
        <Field
          label={signedIn ? "Add a comment" : "Add a comment"}
          hint={signedIn ? undefined : "You'll be asked to sign in when you post."}
          error={error}
          labelAction={
            <span className={cn("font-mono tnum", body.length > MAX ? "text-rose" : "")}>
              {body.length}/{MAX}
            </span>
          }
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="How did you find the space? What would you do differently?"
            rows={3}
            autoResize
            maxLength={MAX + 200}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
            }}
          />
        </Field>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="hidden text-xs text-fg-subtle sm:block">⌘↵ to post</p>
          <Button type="submit" size="sm" loading={add.isPending} className="ml-auto">
            Post comment
          </Button>
        </div>
      </form>
    </section>
  );
}
