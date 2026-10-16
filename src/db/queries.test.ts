import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setDbForTests } from "./index";
import {
  getSettings,
  insertSchedule,
  insertScrapedPost,
  listApprovedUnscheduledIds,
  listPosts,
  listSchedule,
  occupiedTimes,
  saveSettings,
  setPostStatus,
  unschedule,
  unschedulePendingForPost,
} from "./queries";
import * as schema from "./schema";

const client = new PGlite();
const db = drizzle(client, { schema });

const post = (n: number) => ({
  redditId: `r${n}`,
  subreddit: "memes",
  title: `t${n}`,
  permalink: `https://reddit.com/${n}`,
  cloudinaryUrl: `https://res.cloudinary.com/x/${n}.jpg`,
  cloudinaryPublicId: `memes/${n}`,
  imageHash: `h${n}`,
});

async function idOf(redditId: string) {
  const all = await db.select().from(schema.scrapedPosts);
  return all.find((p) => p.redditId === redditId)!.id;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  setDbForTests(db);
});

beforeEach(async () => {
  await db.delete(schema.scheduledPosts);
  await db.delete(schema.scrapedPosts);
  await db.delete(schema.settings);
});

describe("settings", () => {
  it("creates defaults on first read and persists updates", async () => {
    expect((await getSettings()).postSlots).toEqual(["09:00", "14:00", "20:00"]);
    await saveSettings({ subreddits: ["a"], scrapeCount: 5, postSlots: ["10:00"], timezone: "UTC" });
    expect(await getSettings()).toMatchObject({ subreddits: ["a"], scrapeCount: 5, timezone: "UTC" });
  });
});

describe("scheduling queries", () => {
  it("lists only approved posts without a schedule, oldest first", async () => {
    for (const n of [1, 2, 3]) await insertScrapedPost(post(n));
    await setPostStatus(await idOf("r1"), "approved");
    await setPostStatus(await idOf("r2"), "approved");
    await insertSchedule([{ scrapedPostId: await idOf("r1"), scheduledAt: new Date("2030-01-01T10:00:00Z") }]);
    expect(await listApprovedUnscheduledIds()).toEqual([await idOf("r2")]);
  });

  it("rejects scheduling the same post twice", async () => {
    await insertScrapedPost(post(1));
    const id = await idOf("r1");
    await insertSchedule([{ scrapedPostId: id, scheduledAt: new Date("2030-01-01T10:00:00Z") }]);
    await expect(
      insertSchedule([{ scrapedPostId: id, scheduledAt: new Date("2030-01-02T10:00:00Z") }]),
    ).rejects.toThrow();
  });

  it("rejects two posts in the same slot, and the failed batch inserts nothing", async () => {
    await insertScrapedPost(post(1));
    await insertScrapedPost(post(2));
    await insertScrapedPost(post(3));
    const at = new Date("2030-01-01T10:00:00Z");
    await insertSchedule([{ scrapedPostId: await idOf("r1"), scheduledAt: at }]);
    await expect(
      insertSchedule([
        { scrapedPostId: await idOf("r2"), scheduledAt: new Date("2030-01-01T11:00:00Z") },
        { scrapedPostId: await idOf("r3"), scheduledAt: at },
      ]),
    ).rejects.toThrow();
    expect(await db.select().from(schema.scheduledPosts)).toHaveLength(1);
  });

  it("reports occupied times from a cutoff onward", async () => {
    await insertScrapedPost(post(1));
    await insertScrapedPost(post(2));
    await insertSchedule([
      { scrapedPostId: await idOf("r1"), scheduledAt: new Date("2030-01-01T10:00:00Z") },
      { scrapedPostId: await idOf("r2"), scheduledAt: new Date("2030-01-03T10:00:00Z") },
    ]);
    expect(await occupiedTimes(new Date("2030-01-02T00:00:00Z"))).toEqual([
      new Date("2030-01-03T10:00:00Z").getTime(),
    ]);
  });

  it("joins schedule onto the approved list and the schedule view", async () => {
    await insertScrapedPost(post(1));
    const id = await idOf("r1");
    await setPostStatus(id, "approved");
    const at = new Date(Date.now() + 3_600_000);
    await insertSchedule([{ scrapedPostId: id, scheduledAt: at }]);
    const [p] = await listPosts("approved");
    expect(p.scheduledAt?.getTime()).toBe(at.getTime());
    const items = await listSchedule();
    expect(items).toHaveLength(1);
    expect(items[0].post.redditId).toBe("r1");
  });

  it("unschedule removes pending rows but never publishing ones", async () => {
    await insertScrapedPost(post(1));
    await insertScrapedPost(post(2));
    await insertSchedule([
      { scrapedPostId: await idOf("r1"), scheduledAt: new Date("2030-01-01T10:00:00Z") },
      { scrapedPostId: await idOf("r2"), scheduledAt: new Date("2030-01-01T11:00:00Z") },
    ]);
    const rows = await db.select().from(schema.scheduledPosts);
    const [a, b] = rows;
    await db.update(schema.scheduledPosts).set({ status: "publishing" }).where(eq(schema.scheduledPosts.id, b.id));
    await unschedule(a.id);
    await unschedule(b.id);
    const left = await db.select().from(schema.scheduledPosts);
    expect(left.map((r) => r.id)).toEqual([b.id]);
  });

  it("unschedulePendingForPost frees the post's slot", async () => {
    await insertScrapedPost(post(1));
    const id = await idOf("r1");
    await insertSchedule([{ scrapedPostId: id, scheduledAt: new Date("2030-01-01T10:00:00Z") }]);
    await unschedulePendingForPost(id);
    expect(await db.select().from(schema.scheduledPosts)).toHaveLength(0);
  });
});
