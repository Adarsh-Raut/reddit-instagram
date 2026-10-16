import { inngest } from "./client";
import { runPublishDue, runRefreshToken } from "./jobs";

/**
 * Every 5 minutes: publish the next due post (one per run, so catch-up posts are
 * spaced out) and mark posts that missed their slot by too long as failed.
 * `concurrency: 1` stops overlapping runs; the DB claim in publishScheduledPost
 * is the real guard against double posting.
 */
export const publishDuePosts = inngest.createFunction(
  { id: "publish-due-posts", retries: 1, concurrency: 1, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => step.run("publish-due", () => runPublishDue()),
);

/** Daily: renew the Instagram token when it has under 15 days left. */
export const refreshInstagramToken = inngest.createFunction(
  { id: "refresh-instagram-token", retries: 3, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => step.run("refresh", () => runRefreshToken()),
);

export const functions = [publishDuePosts, refreshInstagramToken];
