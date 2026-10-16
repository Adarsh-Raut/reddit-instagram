"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setPostStatus, unschedulePendingForPost } from "@/db/queries";
import { runScrape } from "@/lib/reddit/run";

// TODO(auth): dashboard auth is not built yet. Before deploying, every action
// here must verify an authenticated admin (see CLAUDE.md build order).

export type ScrapeState = { message: string; ok: boolean } | null;

export async function scrapeNow(): Promise<ScrapeState> {
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
  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;
  await setPostStatus(parsed.data.id, parsed.data.status);
  // un-approving also frees its time slot
  if (parsed.data.status !== "approved") await unschedulePendingForPost(parsed.data.id);
  revalidatePath("/", "layout");
}
