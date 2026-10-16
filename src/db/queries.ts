import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { getDb } from "./index";
import { scheduledPosts, scrapedPosts, settings } from "./schema";

export type ScrapedPost = typeof scrapedPosts.$inferSelect;
export type PostStatus = ScrapedPost["status"];
export type AppSettings = typeof settings.$inferSelect;

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row;
}

export type PostWithSchedule = ScrapedPost & { scheduledAt: Date | null };

export async function listPosts(status: PostStatus): Promise<PostWithSchedule[]> {
  const rows = await getDb()
    .select({ post: scrapedPosts, scheduledAt: scheduledPosts.scheduledAt })
    .from(scrapedPosts)
    .leftJoin(scheduledPosts, eq(scheduledPosts.scrapedPostId, scrapedPosts.id))
    .where(eq(scrapedPosts.status, status))
    .orderBy(desc(scrapedPosts.scrapedAt))
    .limit(100);
  return rows.map((r) => ({ ...r.post, scheduledAt: r.scheduledAt }));
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
}) {
  await getDb()
    .insert(settings)
    .values({ id: 1, ...v })
    .onConflictDoUpdate({ target: settings.id, set: v });
}

export async function countByStatus(): Promise<Record<PostStatus, number>> {
  const rows = await getDb()
    .select({ status: scrapedPosts.status })
    .from(scrapedPosts);
  const counts: Record<PostStatus, number> = { new: 0, approved: 0, rejected: 0, posted: 0 };
  for (const r of rows) counts[r.status]++;
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
