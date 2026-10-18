"use client";

import { CheckIcon, LoaderCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { reviewPost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import type { PostStatus } from "@/db/queries";

type Review = "new" | "approved" | "rejected";

const DONE: Record<Review, string> = {
  approved: "Approved",
  rejected: "Rejected",
  new: "Moved back to New",
};

async function send(id: string, status: Review) {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("status", status);
  await reviewPost(fd);
}

/** Approve / reject / restore for one meme, with an Undo toast so a misclick costs nothing. */
export function ReviewActions({ id, status, title }: { id: string; status: PostStatus; title: string }) {
  const [pending, startTransition] = useTransition();

  function change(next: Review) {
    startTransition(async () => {
      try {
        await send(id, next);
        toast(DONE[next], {
          description: title.length > 70 ? `${title.slice(0, 70)}…` : title,
          action: {
            label: "Undo",
            onClick: () => {
              send(id, status as Review).catch(() =>
                toast.error("We couldn’t undo that. Move the meme back from its tab."),
              );
            },
          },
        });
      } catch {
        toast.error("We couldn’t update this meme. Check your connection and try again.");
      }
    });
  }

  const spinner = <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />;

  if (status === "new") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => change("approved")} disabled={pending} aria-busy={pending}>
          {pending ? spinner : <CheckIcon data-icon="inline-start" />}
          Approve
        </Button>
        <Button variant="outline" onClick={() => change("rejected")} disabled={pending}>
          <XIcon data-icon="inline-start" />
          Reject
        </Button>
      </div>
    );
  }
  if (status === "approved" || status === "rejected") {
    return (
      <Button variant="outline" className="w-full" onClick={() => change("new")} disabled={pending} aria-busy={pending}>
        {pending ? spinner : <RotateCcwIcon data-icon="inline-start" />}
        {status === "approved" ? "Move back to New" : "Restore to New"}
      </Button>
    );
  }
  return null;
}
