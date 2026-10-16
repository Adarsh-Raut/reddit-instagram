import { decrypt, encrypt } from "@/lib/crypto";
import { refreshLongLived } from "@/lib/instagram/api";
import { daysUntil } from "@/lib/instagram/token";
import {
  failMissed,
  getIgAccount,
  listDueScheduleIds,
  saveIgAccount,
  type IgAccount,
} from "@/db/queries";
import { publishScheduledPost, type PublishResult } from "@/lib/instagram/publish";

/** Posts later than this after their slot are not auto-published. */
export const MAX_LATE_MS = 6 * 60 * 60 * 1000;
/** At most one post per run (runs are 5 minutes apart), so catch-up posts are spaced out. */
export const PUBLISH_PER_RUN = 1;
/** Refresh the Instagram token once it has fewer than this many days left. */
export const REFRESH_WHEN_DAYS_LEFT = 15;

export type PublishJobDeps = {
  now: () => Date;
  failMissed: (before: Date) => Promise<number>;
  listDue: (now: Date, notBefore: Date, limit: number) => Promise<string[]>;
  publish: (id: string) => Promise<PublishResult>;
};

const realPublishDeps: PublishJobDeps = {
  now: () => new Date(),
  failMissed,
  listDue: listDueScheduleIds,
  publish: (id) => publishScheduledPost(id),
};

export async function runPublishDue(deps: PublishJobDeps = realPublishDeps) {
  const now = deps.now();
  const cutoff = new Date(now.getTime() - MAX_LATE_MS);
  const missed = await deps.failMissed(cutoff);
  const ids = await deps.listDue(now, cutoff, PUBLISH_PER_RUN);
  const results: { id: string; ok: boolean; message?: string }[] = [];
  for (const id of ids) {
    const r = await deps.publish(id);
    results.push(r.ok ? { id, ok: true } : { id, ok: false, message: r.message });
  }
  return { missed, results };
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
