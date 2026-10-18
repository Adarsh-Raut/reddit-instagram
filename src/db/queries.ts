import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "./index";
import { activityLog, igAccounts, scheduledPosts, scrapedPosts, settings } from "./schema";

export type ScrapedPost = typeof scrapedPosts.$inferSelect;
export type PostStatus = ScrapedPost["status"];
export type AppSettings = typeof settings.$inferSelect;

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  const [existing] = await db.select().from(settings).where(eq(settings.id, 1));
  if (existing) return existing; // the normal case is a plain read: no write on every page view
  // first run only: create the row (a concurrent request may have just done it)
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row;
}

/** `scheduleCaption` is the caption edited on the schedule row ("" = use the default), null when unscheduled. */
export type PostWithSchedule = ScrapedPost & { scheduledAt: Date | null; scheduleCaption: string | null };

export const PAGE_SIZE = 24;

/** Title/author search term -> filter. `%`, `_` and `\\` are escaped so they match literally. */
function searchFilter(q?: string) {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return or(ilike(scrapedPosts.title, pattern), ilike(scrapedPosts.author, pattern));
}

export async function listPosts(status: PostStatus, page = 1, q?: string): Promise<PostWithSchedule[]> {
  const rows = await getDb()
    .select({ post: scrapedPosts, scheduledAt: scheduledPosts.scheduledAt, scheduleCaption: scheduledPosts.caption })
    .from(scrapedPosts)
    .leftJoin(scheduledPosts, eq(scheduledPosts.scrapedPostId, scrapedPosts.id))
    .where(and(eq(scrapedPosts.status, status), searchFilter(q)))
    .orderBy(desc(scrapedPosts.scrapedAt), asc(scrapedPosts.id))
    .limit(PAGE_SIZE)
    .offset((Math.max(1, page) - 1) * PAGE_SIZE);
  return rows.map((r) => ({ ...r.post, scheduledAt: r.scheduledAt, scheduleCaption: r.scheduleCaption }));
}

/** How many posts match, for pagination while a search is active. */
export async function countPosts(status: PostStatus, q?: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(scrapedPosts)
    .where(and(eq(scrapedPosts.status, status), searchFilter(q)));
  return row?.n ?? 0;
}

/** Approved posts that have no schedule row yet, oldest first. */
export async function listApprovedUnscheduledIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: scrapedPosts.id })
    .from(scrapedPosts)
    .leftJoin(scheduledPosts, eq(scheduledPosts.scrapedPostId, scrapedPosts.id))
    .where(and(eq(scrapedPosts.status, "approved"), isNull(scheduledPosts.id)))
    .orderBy(asc(scrapedPosts.scrapedAt));
  return rows.map((r) => r.id);
}

/** Epoch ms of every scheduled time from `from` onward (slots already taken). */
export async function occupiedTimes(from: Date): Promise<number[]> {
  const rows = await getDb()
    .select({ at: scheduledPosts.scheduledAt })
    .from(scheduledPosts)
    .where(gte(scheduledPosts.scheduledAt, from));
  return rows.map((r) => r.at.getTime());
}

export async function insertSchedule(rows: { scrapedPostId: string; scheduledAt: Date }[]) {
  if (rows.length === 0) return;
  await getDb().insert(scheduledPosts).values(rows);
}

export type ScheduleItem = {
  id: string;
  scheduledAt: Date;
  status: (typeof scheduledPosts.$inferSelect)["status"];
  error: string | null;
  caption: string;
  post: ScrapedPost;
};

/** Everything scheduled in the last 24h or later, soonest first. */
export async function listSchedule(): Promise<ScheduleItem[]> {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select({ s: scheduledPosts, post: scrapedPosts })
    .from(scheduledPosts)
    .innerJoin(scrapedPosts, eq(scrapedPosts.id, scheduledPosts.scrapedPostId))
    .where(gte(scheduledPosts.scheduledAt, from))
    .orderBy(asc(scheduledPosts.scheduledAt))
    .limit(300);
  return rows.map((r) => ({
    id: r.s.id,
    scheduledAt: r.s.scheduledAt,
    status: r.s.status,
    error: r.s.error,
    caption: r.s.caption,
    post: r.post,
  }));
}

/** Only pending schedules can be removed; anything publishing/posted is left alone. */
export async function unschedule(scheduleId: string) {
  await getDb()
    .delete(scheduledPosts)
    .where(and(eq(scheduledPosts.id, scheduleId), eq(scheduledPosts.status, "pending")));
}

export async function unschedulePendingForPost(postId: string) {
  await getDb()
    .delete(scheduledPosts)
    .where(and(eq(scheduledPosts.scrapedPostId, postId), eq(scheduledPosts.status, "pending")));
}

export async function saveSettings(v: {
  subreddits: string[];
  scrapeCount: number;
  postSlots: string[];
  timezone: string;
  autoScrape: boolean;
  autoSchedule: boolean;
  autoScheduleDays: number;
}) {
  await getDb()
    .insert(settings)
    .values({ id: 1, ...v })
    .onConflictDoUpdate({ target: settings.id, set: v });
}

export async function countByStatus(): Promise<Record<PostStatus, number>> {
  const rows = await getDb()
    .select({ status: scrapedPosts.status, n: sql<number>`count(*)::int` })
    .from(scrapedPosts)
    .groupBy(scrapedPosts.status);
  const counts: Record<PostStatus, number> = { new: 0, approved: 0, rejected: 0, posted: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export async function setPostStatus(id: string, status: PostStatus) {
  await getDb().update(scrapedPosts).set({ status }).where(eq(scrapedPosts.id, id));
}

export async function existingRedditIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await getDb()
    .select({ id: scrapedPosts.redditId })
    .from(scrapedPosts)
    .where(inArray(scrapedPosts.redditId, ids));
  return new Set(rows.map((r) => r.id));
}

export async function hashExists(hash: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: scrapedPosts.id })
    .from(scrapedPosts)
    .where(eq(scrapedPosts.imageHash, hash))
    .limit(1);
  return rows.length > 0;
}

export async function insertScrapedPost(post: typeof scrapedPosts.$inferInsert) {
  await getDb().insert(scrapedPosts).values(post);
}

export type IgAccount = typeof igAccounts.$inferSelect;

/** This app connects a single Instagram account. */
export async function getIgAccount(): Promise<IgAccount | null> {
  const [row] = await getDb().select().from(igAccounts).orderBy(desc(igAccounts.createdAt)).limit(1);
  return row ?? null;
}

export async function saveIgAccount(a: {
  igUserId: string;
  username: string | null;
  encryptedToken: string;
  tokenExpiresAt: Date;
}) {
  await getDb()
    .insert(igAccounts)
    .values(a)
    .onConflictDoUpdate({
      target: igAccounts.igUserId,
      set: { username: a.username, encryptedToken: a.encryptedToken, tokenExpiresAt: a.tokenExpiresAt },
    });
}

export async function deleteIgAccounts() {
  await getDb().delete(igAccounts);
}

export type PublishClaim = {
  scheduleId: string;
  postId: string;
  caption: string;
  post: ScrapedPost;
};

/**
 * Atomically move a pending/failed schedule to "publishing".
 * Returns null if it was already claimed or is already posted, which prevents double posts.
 */
export async function claimForPublishing(scheduleId: string): Promise<PublishClaim | null> {
  const db = getDb();
  const [claimed] = await db
    .update(scheduledPosts)
    .set({
      status: "publishing",
      error: null,
      attempts: sql`${scheduledPosts.attempts} + 1`,
      claimedAt: sql`now()`,
    })
    .where(and(eq(scheduledPosts.id, scheduleId), inArray(scheduledPosts.status, ["pending", "failed"])))
    .returning();
  if (!claimed) return null;
  const [post] = await db.select().from(scrapedPosts).where(eq(scrapedPosts.id, claimed.scrapedPostId));
  return { scheduleId: claimed.id, postId: claimed.scrapedPostId, caption: claimed.caption, post };
}

export async function markPosted(scheduleId: string, postId: string, igMediaId: string) {
  const db = getDb();
  await db
    .update(scheduledPosts)
    .set({ status: "posted", igMediaId, error: null })
    .where(eq(scheduledPosts.id, scheduleId));
  await db.update(scrapedPosts).set({ status: "posted" }).where(eq(scrapedPosts.id, postId));
}

/** Oldest pending posts whose time has come and that aren't too late to publish. */
export async function listDueScheduleIds(now: Date, notBefore: Date, limit: number): Promise<string[]> {
  const rows = await getDb()
    .select({ id: scheduledPosts.id })
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, "pending"),
        lte(scheduledPosts.scheduledAt, now),
        gte(scheduledPosts.scheduledAt, notBefore),
      ),
    )
    .orderBy(asc(scheduledPosts.scheduledAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

/**
 * Pending posts that missed their slot by too long (e.g. the server was offline)
 * become "failed" so a human decides whether to post them late. Returns the count.
 */
export async function failMissed(before: Date): Promise<number> {
  const rows = await getDb()
    .update(scheduledPosts)
    .set({ status: "failed", error: "Missed its time slot. Use Retry to post it now." })
    .where(and(eq(scheduledPosts.status, "pending"), lt(scheduledPosts.scheduledAt, before)))
    .returning({ id: scheduledPosts.id });
  return rows.length;
}

export async function markFailed(scheduleId: string, error: string) {
  await getDb()
    .update(scheduledPosts)
    .set({ status: "failed", error: error.slice(0, 500) })
    .where(eq(scheduledPosts.id, scheduleId));
}

/**
 * Posts stuck in "publishing" (the server died mid-publish) become "failed" with a
 * warning. We can't know whether Instagram accepted the post, so a human must check
 * the account before using Retry.
 */
export async function failStuck(claimedBefore: Date): Promise<number> {
  const rows = await getDb()
    .update(scheduledPosts)
    .set({
      status: "failed",
      error: "Publishing was interrupted. Check Instagram for this post before using Retry.",
    })
    .where(and(eq(scheduledPosts.status, "publishing"), lt(scheduledPosts.claimedAt, claimedBefore)))
    .returning({ id: scheduledPosts.id });
  return rows.length;
}

/** Edit a caption that hasn't been published yet. Returns false if it can't be edited. */
export async function updateScheduleCaption(scheduleId: string, caption: string): Promise<boolean> {
  const rows = await getDb()
    .update(scheduledPosts)
    .set({ caption })
    .where(and(eq(scheduledPosts.id, scheduleId), inArray(scheduledPosts.status, ["pending", "failed"])))
    .returning({ id: scheduledPosts.id });
  return rows.length > 0;
}

/**
 * Move an unpublished post to a new time; a failed/missed post becomes pending again.
 * Throws on a slot clash (unique constraint). Returns false if it can't be moved.
 */
export async function rescheduleTo(scheduleId: string, at: Date): Promise<boolean> {
  const rows = await getDb()
    .update(scheduledPosts)
    .set({ scheduledAt: at, status: "pending", error: null })
    .where(and(eq(scheduledPosts.id, scheduleId), inArray(scheduledPosts.status, ["pending", "failed"])))
    .returning({ id: scheduledPosts.id });
  return rows.length > 0;
}

export async function getScheduleCaptionInfo(scheduleId: string) {
  const [row] = await getDb()
    .select({ caption: scheduledPosts.caption, scheduledAt: scheduledPosts.scheduledAt })
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, scheduleId));
  return row ?? null;
}

export type AlertInputs = {
  failedCount: number;
  /** Pending posts still ahead of `now`. */
  upcomingCount: number;
  approvedUnscheduled: number;
  hasAccount: boolean;
  tokenExpiresAt: Date | null;
  slotsPerDay: number;
  autoSchedule: boolean;
};

/**
 * Everything the alerts banner needs, in ONE round trip (it runs on every page, and on Neon each
 * query is a separate HTTP request). Scalar subqueries keep it a single statement.
 */
export async function getAlertInputs(now: Date): Promise<AlertInputs> {
  const [row] = await getDb()
    .select({
      // Table/column names are written out with aliases on purpose: with no real table in FROM, drizzle
      // drops qualifiers and the join below becomes ambiguous. getAlertInputs tests pin these names.
      failed: sql<number>`(select count(*)::int from scheduled_posts sp where sp.status = 'failed')`,
      upcoming: sql<number>`(select count(*)::int from scheduled_posts sp where sp.status = 'pending' and sp.scheduled_at >= ${now.toISOString()}::timestamptz)`,
      unscheduled: sql<number>`(select count(*)::int from scraped_posts p left join scheduled_posts sp on sp.scraped_post_id = p.id where p.status = 'approved' and sp.id is null)`,
      accounts: sql<number>`(select count(*)::int from ig_accounts)`,
      tokenExpiresAt: sql<string | Date | null>`(select a.token_expires_at from ig_accounts a order by a.created_at desc limit 1)`,
      slotsPerDay: sql<number | null>`(select array_length(s.post_slots, 1) from settings s where s.id = 1)`,
      autoSchedule: sql<boolean | null>`(select s.auto_schedule from settings s where s.id = 1)`,
    })
    .from(sql`(select 1) as one`); // drizzle needs a source; every number above is its own scalar subquery
  // no settings row yet (fresh install): create it and use the defaults
  const fallback = row.slotsPerDay === null || row.autoSchedule === null ? await getSettings() : null;
  return {
    failedCount: row.failed,
    upcomingCount: row.upcoming,
    approvedUnscheduled: row.unscheduled,
    hasAccount: row.accounts > 0,
    tokenExpiresAt: row.tokenExpiresAt ? new Date(row.tokenExpiresAt) : null,
    slotsPerDay: row.slotsPerDay ?? fallback?.postSlots.length ?? 0,
    autoSchedule: row.autoSchedule ?? fallback?.autoSchedule ?? false,
  };
}

/** Rejected posts old enough that we can drop their image from Cloudinary. */
export async function listStaleRejected(before: Date, limit: number) {
  return getDb()
    .select({ id: scrapedPosts.id, publicId: scrapedPosts.cloudinaryPublicId })
    .from(scrapedPosts)
    .where(
      and(
        eq(scrapedPosts.status, "rejected"),
        lt(scrapedPosts.scrapedAt, before),
        sql`${scrapedPosts.cloudinaryUrl} <> ''`,
      ),
    )
    .limit(limit);
}

/** Keep the row (its reddit id and image hash still prevent re-scraping) but drop the image. */
export async function clearImage(id: string) {
  await getDb().update(scrapedPosts).set({ cloudinaryUrl: "" }).where(eq(scrapedPosts.id, id));
}

export type ActivityRow = typeof activityLog.$inferSelect;
export const ACTIVITY_PAGE_SIZE = 50;

export async function insertActivity(e: {
  level: string;
  kind: string;
  message: string;
  meta?: unknown;
}) {
  await getDb()
    .insert(activityLog)
    .values({ level: e.level, kind: e.kind, message: e.message, meta: e.meta ?? null });
}

const problemsOnly = inArray(activityLog.level, ["warn", "error"]);

export async function listActivity(page = 1, onlyProblems = false): Promise<ActivityRow[]> {
  return getDb()
    .select()
    .from(activityLog)
    .where(onlyProblems ? problemsOnly : undefined)
    .orderBy(desc(activityLog.at), desc(activityLog.id))
    .limit(ACTIVITY_PAGE_SIZE)
    .offset((Math.max(1, page) - 1) * ACTIVITY_PAGE_SIZE);
}

export async function countActivity(onlyProblems = false): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(activityLog)
    .where(onlyProblems ? problemsOnly : undefined);
  return row.n;
}

export async function pruneActivity(before: Date): Promise<number> {
  const rows = await getDb()
    .delete(activityLog)
    .where(lt(activityLog.at, before))
    .returning({ id: activityLog.id });
  return rows.length;
}
