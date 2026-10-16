import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { scrapedPosts, settings } from "./schema";

export type ScrapedPost = typeof scrapedPosts.$inferSelect;
export type PostStatus = ScrapedPost["status"];
export type AppSettings = typeof settings.$inferSelect;

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row;
}

export async function listPosts(status: PostStatus): Promise<ScrapedPost[]> {
  return getDb()
    .select()
    .from(scrapedPosts)
    .where(eq(scrapedPosts.status, status))
    .orderBy(desc(scrapedPosts.scrapedAt))
    .limit(100);
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
