import { decrypt, encrypt } from "@/lib/crypto";
import { refreshLongLived } from "@/lib/instagram/api";
import { daysUntil } from "@/lib/instagram/token";
import {
  clearImage,
  failMissed,
  failStuck,
  getIgAccount,
  getSettings,
  listDueScheduleIds,
  listStaleRejected,
  saveIgAccount,
  type IgAccount,
} from "@/db/queries";
import { deleteImage } from "@/lib/cloudinary";
import { runScrape } from "@/lib/reddit/run";
import type { ScrapeResult } from "@/lib/reddit/scrape";
import { publishScheduledPost, type PublishResult } from "@/lib/instagram/publish";

/** Posts later than this after their slot are not auto-published. */
export const MAX_LATE_MS = 6 * 60 * 60 * 1000;
/** A post still "publishing" after this long was interrupted (a publish takes seconds). */
export const STUCK_AFTER_MS = 15 * 60 * 1000;
/** Rejected memes older than this lose their Cloudinary image. */
export const REJECTED_IMAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** At most one post per run (runs are 5 minutes apart), so catch-up posts are spaced out. */
export const PUBLISH_PER_RUN = 1;
/** Refresh the Instagram token once it has fewer than this many days left. */
export const REFRESH_WHEN_DAYS_LEFT = 15;

export type PublishJobDeps = {
  now: () => Date;
  failMissed: (before: Date) => Promise<number>;
  failStuck: (claimedBefore: Date) => Promise<number>;
  listDue: (now: Date, notBefore: Date, limit: number) => Promise<string[]>;
  publish: (id: string) => Promise<PublishResult>;
};

const realPublishDeps: PublishJobDeps = {
  now: () => new Date(),
  failMissed,
  failStuck,
  listDue: listDueScheduleIds,
  publish: (id) => publishScheduledPost(id),
};

export async function runPublishDue(deps: PublishJobDeps = realPublishDeps) {
  const now = deps.now();
  const cutoff = new Date(now.getTime() - MAX_LATE_MS);
  const stuck = await deps.failStuck(new Date(now.getTime() - STUCK_AFTER_MS));
  const missed = await deps.failMissed(cutoff);
  const ids = await deps.listDue(now, cutoff, PUBLISH_PER_RUN);
  const results: { id: string; ok: boolean; message?: string }[] = [];
  for (const id of ids) {
    const r = await deps.publish(id);
    results.push(r.ok ? { id, ok: true } : { id, ok: false, message: r.message });
  }
  return { stuck, missed, results };
}

export function shouldRefresh(account: Pick<IgAccount, "tokenExpiresAt">, now: Date) {
  const left = daysUntil(account.tokenExpiresAt, now);
  return left > 0 && left < REFRESH_WHEN_DAYS_LEFT; // an expired token can't be refreshed
}

export type RefreshJobDeps = {
  now: () => Date;
  getAccount: () => Promise<IgAccount | null>;
  refresh: (token: string) => Promise<{ accessToken: string; expiresInSeconds: number }>;
  save: (a: { igUserId: string; username: string | null; encryptedToken: string; tokenExpiresAt: Date }) => Promise<void>;
  decryptToken: (e: string) => string;
  encryptToken: (p: string) => string;
};

const realRefreshDeps: RefreshJobDeps = {
  now: () => new Date(),
  getAccount: getIgAccount,
  refresh: (t) => refreshLongLived(t),
  save: saveIgAccount,
  decryptToken: decrypt,
  encryptToken: encrypt,
};

export type RefreshOutcome = "no-account" | "not-needed" | "expired" | "refreshed";

/** Throws if Instagram rejects the refresh, so Inngest retries and the failure is visible. */
export async function runRefreshToken(deps: RefreshJobDeps = realRefreshDeps): Promise<RefreshOutcome> {
  const account = await deps.getAccount();
  if (!account) return "no-account";
  const now = deps.now();
  if (account.tokenExpiresAt <= now) return "expired";
  if (!shouldRefresh(account, now)) return "not-needed";

  const fresh = await deps.refresh(deps.decryptToken(account.encryptedToken));
  await deps.save({
    igUserId: account.igUserId,
    username: account.username,
    encryptedToken: deps.encryptToken(fresh.accessToken),
    tokenExpiresAt: new Date(now.getTime() + fresh.expiresInSeconds * 1000),
  });
  return "refreshed";
}

export type ScrapeJobDeps = {
  getSettings: () => Promise<{ autoScrape: boolean }>;
  scrape: () => Promise<ScrapeResult>;
};

const realScrapeDeps: ScrapeJobDeps = { getSettings, scrape: runScrape };

/** Daily scrape. Skipped when auto-scrape is switched off in Settings. */
export async function runAutoScrape(deps: ScrapeJobDeps = realScrapeDeps) {
  const { autoScrape } = await deps.getSettings();
  if (!autoScrape) return { skipped: true as const };
  const r = await deps.scrape();
  // Throw only when nothing worked, so Inngest retries a total failure but not a partial one.
  if (r.added === 0 && r.errors.length > 0) throw new Error(`Scrape failed: ${r.errors[0]}`);
  return { skipped: false as const, added: r.added, duplicates: r.skippedDuplicates, errors: r.errors.length };
}

export type CleanupJobDeps = {
  now: () => Date;
  listStale: (before: Date, limit: number) => Promise<{ id: string; publicId: string }[]>;
  deleteImage: (publicId: string) => Promise<void>;
  clear: (id: string) => Promise<void>;
};

const realCleanupDeps: CleanupJobDeps = {
  now: () => new Date(),
  listStale: listStaleRejected,
  deleteImage,
  clear: clearImage,
};

/** Free Cloudinary storage used by long-rejected memes. The DB rows stay, so they aren't re-scraped. */
export async function runImageCleanup(deps: CleanupJobDeps = realCleanupDeps) {
  const before = new Date(deps.now().getTime() - REJECTED_IMAGE_TTL_MS);
  const stale = await deps.listStale(before, 100);
  let deleted = 0;
  const errors: string[] = [];
  for (const { id, publicId } of stale) {
    try {
      await deps.deleteImage(publicId);
      await deps.clear(id);
      deleted++;
    } catch (e) {
      errors.push(`${publicId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { deleted, errors };
}
