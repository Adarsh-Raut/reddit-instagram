import type { ActivityEvent } from "@/lib/activity";
import type { RefreshOutcome, runImageCleanup, runPublishDue } from "./jobs";

/** What each cron job should leave in the activity log. Pure so it is easy to test. */

export function describePublishRun(r: Awaited<ReturnType<typeof runPublishDue>>): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  // posted/failed per post are recorded by publishScheduledPost itself
  if (r.stuck > 0) {
    out.push({
      level: "warn",
      kind: "job.stuck_posts",
      message: `${r.stuck} post${r.stuck === 1 ? "" : "s"} got stuck while publishing. Check Instagram before retrying.`,
      meta: { count: r.stuck },
    });
  }
  if (r.missed > 0) {
    out.push({
      level: "warn",
      kind: "job.missed_posts",
      message: `${r.missed} post${r.missed === 1 ? "" : "s"} missed their slot and were not posted.`,
      meta: { count: r.missed },
    });
  }
  return out;
}

export function describeRefresh(outcome: RefreshOutcome): ActivityEvent[] {
  if (outcome === "refreshed") {
    return [{ level: "info", kind: "instagram.token_refreshed", message: "Instagram token refreshed" }];
  }
  if (outcome === "expired") {
    return [{ level: "error", kind: "instagram.token_expired", message: "The Instagram token has expired. Reconnect in Settings." }];
  }
  return []; // no account / not due yet: nothing worth recording
}

export function describeCleanup(r: Awaited<ReturnType<typeof runImageCleanup>>, pruned: number): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  if (r.deleted > 0 || r.errors.length > 0) {
    out.push({
      level: r.errors.length > 0 ? "warn" : "info",
      kind: "cleanup.images",
      message: `Removed ${r.deleted} old image${r.deleted === 1 ? "" : "s"} from Cloudinary` + (r.errors.length ? `, ${r.errors.length} failed` : ""),
      meta: { deleted: r.deleted, errors: r.errors.slice(0, 5) },
    });
  }
  if (pruned > 0) {
    out.push({ level: "info", kind: "cleanup.activity", message: `Pruned ${pruned} activity entries older than 90 days`, meta: { pruned } });
  }
  return out;
}
