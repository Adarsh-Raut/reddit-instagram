import { inngest } from "./client";

/**
 * Runs every 10 minutes. Will publish due `scheduled_posts` to Instagram
 * (step 5 of the build order). Currently a no-op placeholder.
 */
export const publishDuePosts = inngest.createFunction(
  { id: "publish-due-posts", triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step }) => {
    await step.run("noop", async () => ({ published: 0 }));
  },
);

export const functions = [publishDuePosts];
