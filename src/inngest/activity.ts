import type { ActivityEvent } from "@/lib/activity";
import type { CaptionRunResult, RefreshOutcome, runImageCleanup, runPublishDue } from "./jobs";

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

export function describeCaptionRun(r: CaptionRunResult): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  if (r.generated.length > 0) {
    out.push({
      level: "info",
      kind: "caption.generated",
      message: `Wrote ${r.generated.length} AI caption${r.generated.length === 1 ? "" : "s"} (${[...new Set(r.generated)].join(", ")})`,
      meta: { providers: r.generated },
    });
  }
  // a provider that failed but was covered by the next one is still worth knowing about (limits, bad key)
  if (r.failures.length > 0) {
    out.push({
      level: r.failed > 0 ? "warn" : "info",
      kind: r.failed > 0 ? "caption.failed" : "caption.fallback",
      message:
        r.failed > 0
          ? `Couldn’t write ${r.failed} AI caption${r.failed === 1 ? "" : "s"}; they will use the default caption`
          : "An AI provider failed, so the next one wrote the caption",
      meta: { failures: r.failures.slice(0, 6) },
    });
  }
  return out;
}
