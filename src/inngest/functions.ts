import { pruneActivity } from "@/db/queries";
import { recordActivity, type ActivityEvent } from "@/lib/activity";
import { describeCleanup, describePublishRun, describeRefresh } from "./activity";
import { inngest } from "./client";
import { runAutoScrape, runImageCleanup, runPublishDue, runRefreshToken } from "./jobs";

const ACTIVITY_KEEP_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Run a job, record what it did, and on failure record the error and rethrow so
 * Inngest still shows the run as failed and retries it.
 */
async function tracked<T>(job: string, fn: () => Promise<T>, describe: (result: T) => ActivityEvent[] | Promise<ActivityEvent[]>): Promise<T> {
  try {
    const result = await fn();
    for (const event of await describe(result)) await recordActivity(event);
    return result;
  } catch (err) {
    await recordActivity({
      level: "error",
      kind: `job.${job}_failed`,
      message: `The ${job} job failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    throw err;
  }
}

/**
 * Every 5 minutes: publish the next due post (one per run, so catch-up posts are
 * spaced out) and mark posts that missed their slot by too long as failed.
 * `concurrency: 1` stops overlapping runs; the DB claim in publishScheduledPost
 * is the real guard against double posting.
 */
export const publishDuePosts = inngest.createFunction(
  { id: "publish-due-posts", retries: 1, concurrency: 1, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => step.run("publish-due", () => tracked("publish", runPublishDue, describePublishRun)),
);

/** Daily: renew the Instagram token when it has under 15 days left. */
export const refreshInstagramToken = inngest.createFunction(
  { id: "refresh-instagram-token", retries: 3, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => step.run("refresh", () => tracked("token-refresh", runRefreshToken, describeRefresh)),
);

/** Daily at 06:00 UTC: fetch new memes into the review queue (if enabled in Settings). */
export const scrapeMemesDaily = inngest.createFunction(
  { id: "scrape-memes-daily", retries: 2, triggers: [{ cron: "0 6 * * *" }] },
  // runScrape records its own "scrape.completed" entry; this only adds failures
  async ({ step }) => step.run("scrape", () => tracked("scrape", runAutoScrape, () => [])),
);

/** Daily: delete Cloudinary images of memes rejected more than 14 days ago, and prune old activity. */
export const cleanupImages = inngest.createFunction(
  { id: "cleanup-rejected-images", retries: 1, triggers: [{ cron: "30 3 * * *" }] },
  async ({ step }) =>
    step.run("cleanup", async () => {
      let pruned = 0;
      return tracked(
        "cleanup",
        async () => {
          pruned = await pruneActivity(new Date(Date.now() - ACTIVITY_KEEP_MS));
          return runImageCleanup();
        },
        (r) => describeCleanup(r, pruned),
      );
    }),
);

export const functions = [publishDuePosts, refreshInstagramToken, scrapeMemesDaily, cleanupImages];
