"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewPosts } from "@/app/actions/posts";

export type Review = "new" | "approved" | "rejected";

const ONE: Record<Review, string> = {
  approved: "Approved",
  rejected: "Rejected",
  new: "Moved back to New",
};

function bulkLabel(next: Review, n: number) {
  const memes = `${n} ${n === 1 ? "meme" : "memes"}`;
  if (next === "approved") return `Approved ${memes}`;
  if (next === "rejected") return `Rejected ${memes}`;
  return `Moved ${memes} back to New`;
}

/**
 * Approve, reject or restore one or many memes with an Undo toast, so a misclick or a wrong
 * shortcut costs nothing. `previous` is the status they all have now (the tab being viewed).
 */
export function useReview(previous: Review) {
  const [pending, startTransition] = useTransition();
  const [actingIds, setActingIds] = useState<ReadonlySet<string>>(new Set());

  function undo(ids: string[]) {
    reviewPosts(ids, previous).then(
      (r) => {
        if (!r.ok) toast.error("We couldn’t undo that. Move the memes back from their tabs.");
      },
      () => toast.error("We couldn’t undo that. Move the memes back from their tabs."),
    );
  }

  function review(items: { id: string; title: string }[], next: Review) {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return;
    setActingIds(new Set(ids));
    startTransition(async () => {
      try {
        const r = await reviewPosts(ids, next);
        if (!r.ok) {
          toast.error(r.message ?? "We couldn’t update these memes. Try again.");
          return;
        }
        if (r.changed === 0) {
          toast("Nothing to change", { description: "Those memes have already been published." });
          return;
        }
        const single = items.length === 1;
        toast(single ? ONE[next] : bulkLabel(next, r.changed), {
          description: single ? (items[0].title.length > 70 ? `${items[0].title.slice(0, 70)}…` : items[0].title) : undefined,
          action: { label: "Undo", onClick: () => undo(ids) },
        });
      } catch {
        toast.error("We couldn’t update these memes. Check your connection and try again.");
      } finally {
        setActingIds(new Set());
      }
    });
  }

  return { review, busy: pending, actingIds };
}
