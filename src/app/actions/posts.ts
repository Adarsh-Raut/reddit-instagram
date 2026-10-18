"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setPostStatus, setPostsStatus, unschedulePendingForPost, unschedulePendingForPosts } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import { autoScheduleIfEnabled } from "@/lib/schedule/service";
import { runScrape } from "@/lib/reddit/run";

const log = getLogger("actions");

export type ScrapeState = { message: string; ok: boolean } | null;

export async function scrapeNow(): Promise<ScrapeState> {
  await requireAdmin();
  try {
    const r = await runScrape();
    revalidatePath("/");
    const parts = [`Added ${r.added} new meme${r.added === 1 ? "" : "s"}`];
    if (r.skippedDuplicates) parts.push(`${r.skippedDuplicates} duplicates skipped`);
    if (r.errors.length) parts.push(`${r.errors.length} errors: ${r.errors[0]}`);
    return { ok: r.errors.length === 0 || r.added > 0, message: parts.join(", ") };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Scrape failed" };
  }
}

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "approved", "rejected"]),
});

export async function reviewPost(formData: FormData) {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;
  await setPostStatus(parsed.data.id, parsed.data.status);
  // un-approving also frees its time slot
  if (parsed.data.status !== "approved") await unschedulePendingForPost(parsed.data.id);
  else {
    try {
      await autoScheduleIfEnabled();
    } catch (e) {
      log.error({ err: e }, "auto-schedule failed"); // the post stays approved; the user can schedule manually
    }
  }
  revalidatePath("/", "layout");
}

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["new", "approved", "rejected"]),
});

export type BulkReviewResult = { ok: boolean; changed: number; message?: string };

/** Review several memes at once (the board's multi-select and Undo). Posted memes are skipped. */
export async function reviewPosts(ids: string[], status: "new" | "approved" | "rejected"): Promise<BulkReviewResult> {
  await requireAdmin();
  const parsed = bulkSchema.safeParse({ ids, status });
  if (!parsed.success) return { ok: false, changed: 0, message: "Choose between 1 and 100 memes." };
  const changed = await setPostsStatus(parsed.data.ids, parsed.data.status);
  // un-approving also frees the time slots
  if (parsed.data.status !== "approved") await unschedulePendingForPosts(changed);
  else {
    try {
      await autoScheduleIfEnabled();
    } catch (e) {
      log.error({ err: e }, "auto-schedule failed"); // they stay approved; the user can schedule manually
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, changed: changed.length };
}
