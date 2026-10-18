import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setDbForTests } from "./index";
import {
  claimForPublishing,
  failMissed,
  listDueScheduleIds,
  deleteIgAccounts,
  getIgAccount,
  getSettings,
  markFailed,
  markPosted,
  saveIgAccount,
  insertSchedule,
  countPosts,
  insertScrapedPost,
  listApprovedUnscheduledIds,
  listPosts,
  lastPendingAt,
  listSchedule,
  listScheduleBetween,
  occupiedTimes,
  saveSettings,
  setPostStatus,
  setPostsStatus,
  unschedulePendingForPosts,
  unschedule,
  unschedulePendingForPost,
  updateScheduleCaption,
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
  it("only writes when the settings row doesn't exist yet", async () => {
    await db.delete(schema.settings);
    const insert = vi.spyOn(db, "insert");
    await getSettings(); // first run: creates the row
    expect(insert).toHaveBeenCalledTimes(1);
    insert.mockClear();
    await getSettings();
    await getSettings();
    expect(insert).not.toHaveBeenCalled(); // normal page views are plain reads
    insert.mockRestore();
  });

  it("creates defaults on first read and persists updates", async () => {
    expect((await getSettings()).postSlots).toEqual(["09:00", "14:00", "20:00"]);
    await saveSettings({ subreddits: ["a"], scrapeCount: 5, postSlots: ["10:00"], timezone: "UTC", autoScrape: false, autoSchedule: true, autoScheduleDays: 3 });
    expect(await getSettings()).toMatchObject({ subreddits: ["a"], scrapeCount: 5, timezone: "UTC", autoScrape: false, autoSchedule: true, autoScheduleDays: 3 });
  });
});

describe("schedule ranges", () => {
  async function scheduled(n: number, iso: string) {
    await insertScrapedPost(post(n));
    await insertSchedule([{ scrapedPostId: await idOf(`r${n}`), scheduledAt: new Date(iso) }]);
  }

  it("returns posts in [from, to), earliest first, including past ones that listSchedule hides", async () => {
    await scheduled(1, "2020-01-05T10:00:00Z"); // long ago
    await scheduled(2, "2020-01-03T10:00:00Z");
    await scheduled(3, "2020-01-31T23:59:59Z");
    await scheduled(4, "2020-02-01T00:00:00Z"); // exactly at the end: excluded
    const items = await listScheduleBetween(new Date("2020-01-01T00:00:00Z"), new Date("2020-02-01T00:00:00Z"));
    expect(items.map((i) => i.post.redditId)).toEqual(["r2", "r1", "r3"]);
    expect(await listSchedule()).toHaveLength(0); // the old list only looks 24h back
  });

  it("includes the start boundary and returns nothing for an empty range", async () => {
    await scheduled(1, "2020-03-01T00:00:00Z");
    expect(await listScheduleBetween(new Date("2020-03-01T00:00:00Z"), new Date("2020-03-02T00:00:00Z"))).toHaveLength(1);
    expect(await listScheduleBetween(new Date("2021-01-01T00:00:00Z"), new Date("2021-02-01T00:00:00Z"))).toEqual([]);
  });

  it("reports the last pending time, ignoring posted and failed rows, and null when none", async () => {
    expect(await lastPendingAt()).toBeNull();
    await scheduled(1, "2030-01-01T10:00:00Z");
    await scheduled(2, "2030-03-01T10:00:00Z");
    await scheduled(3, "2030-09-01T10:00:00Z");
    const rows = await db.select().from(schema.scheduledPosts);
    const latest = rows.find((r) => r.scheduledAt.toISOString().startsWith("2030-09"))!;
    await db.update(schema.scheduledPosts).set({ status: "failed" }).where(eq(schema.scheduledPosts.id, latest.id));
    expect((await lastPendingAt())?.toISOString()).toBe("2030-03-01T10:00:00.000Z");
  });
});

describe("bulk review", () => {
  it("changes several posts at once and never touches posted ones", async () => {
    for (const n of [1, 2, 3, 4]) await insertScrapedPost(post(n));
    await setPostStatus(await idOf("r4"), "posted");
    const ids = [await idOf("r1"), await idOf("r2"), await idOf("r4")];
    const changed = await setPostsStatus(ids, "approved");
    expect(changed.sort()).toEqual([await idOf("r1"), await idOf("r2")].sort());
    const all = await db.select().from(schema.scrapedPosts);
    expect(Object.fromEntries(all.map((p) => [p.redditId, p.status]))).toEqual({ r1: "approved", r2: "approved", r3: "new", r4: "posted" });
  });

  it("does nothing for an empty list", async () => {
    expect(await setPostsStatus([], "rejected")).toEqual([]);
    await unschedulePendingForPosts([]); // must not throw
  });

  it("unschedules only pending rows for the given posts", async () => {
    for (const n of [1, 2, 3]) await insertScrapedPost(post(n));
    await insertSchedule([
      { scrapedPostId: await idOf("r1"), scheduledAt: new Date("2030-01-01T10:00:00Z") },
      { scrapedPostId: await idOf("r2"), scheduledAt: new Date("2030-01-01T11:00:00Z") },
      { scrapedPostId: await idOf("r3"), scheduledAt: new Date("2030-01-01T12:00:00Z") },
    ]);
    const rows = await db.select().from(schema.scheduledPosts);
    await db.update(schema.scheduledPosts).set({ status: "publishing" }).where(eq(schema.scheduledPosts.id, rows[2].id));
    await unschedulePendingForPosts([await idOf("r1"), await idOf("r2"), await idOf("r3")]);
    const left = await db.select().from(schema.scheduledPosts);
    expect(left).toHaveLength(1); // the one already publishing stays
    expect(left[0].status).toBe("publishing");
  });
});

describe("post search", () => {
  it("matches title or author case-insensitively, within one status, and counts the same rows", async () => {
    await insertScrapedPost({ ...post(1), title: "Monday Cat meme", author: "alice" });
    await insertScrapedPost({ ...post(2), title: "Dog photo", author: "CatLover" });
    await insertScrapedPost({ ...post(3), title: "Something else", author: "bob" });
    await setPostStatus(await idOf("r3"), "approved");

    const hits = await listPosts("new", 1, "cat");
    expect(hits.map((p) => p.redditId).sort()).toEqual(["r1", "r2"]);
    expect(await countPosts("new", "cat")).toBe(2);
    expect(await countPosts("approved", "cat")).toBe(0);
    expect(await countPosts("new")).toBe(2); // no search term: everything in the status
    expect((await listPosts("new", 1, "   ")).length).toBe(2); // blank search is ignored
  });

  it("treats % and _ in the search term literally", async () => {
    await insertScrapedPost({ ...post(1), title: "100% real" });
    await insertScrapedPost({ ...post(2), title: "1000 fake" });
    expect((await listPosts("new", 1, "100%")).map((p) => p.redditId)).toEqual(["r1"]);
    expect(await countPosts("new", "_")).toBe(0);
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
    expect(p.scheduleCaption).toBe(""); // default caption until it is edited
    const [row] = await db.select().from(schema.scheduledPosts);
    await updateScheduleCaption(row.id, "Edited #caption");
    expect((await listPosts("approved"))[0].scheduleCaption).toBe("Edited #caption");
    const items = await listSchedule();
    expect(items).toHaveLength(1);
    expect(items[0].post.redditId).toBe("r1");
  });

  it("reports no schedule caption for an unscheduled post", async () => {
    await insertScrapedPost(post(1));
    const [p] = await listPosts("new");
    expect(p.scheduledAt).toBeNull();
    expect(p.scheduleCaption).toBeNull();
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

describe("publishing state", () => {
  async function scheduled() {
    await insertScrapedPost(post(1));
    const postId = await idOf("r1");
    await setPostStatus(postId, "approved");
    await insertSchedule([{ scrapedPostId: postId, scheduledAt: new Date("2030-01-01T10:00:00Z") }]);
    const [row] = await db.select().from(schema.scheduledPosts);
    return { postId, scheduleId: row.id };
  }

  it("lets only one caller claim a pending post", async () => {
    const { scheduleId } = await scheduled();
    const [a, b] = await Promise.all([claimForPublishing(scheduleId), claimForPublishing(scheduleId)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const [row] = await db.select().from(schema.scheduledPosts);
    expect(row.status).toBe("publishing");
    expect(row.attempts).toBe(1);
  });

  it("markPosted updates both the schedule and the post; posted can't be claimed again", async () => {
    const { scheduleId, postId } = await scheduled();
    await claimForPublishing(scheduleId);
    await markPosted(scheduleId, postId, "M1");
    const [s] = await db.select().from(schema.scheduledPosts);
    const [p] = await db.select().from(schema.scrapedPosts);
    expect(s).toMatchObject({ status: "posted", igMediaId: "M1" });
    expect(p.status).toBe("posted");
    expect(await claimForPublishing(scheduleId)).toBeNull();
  });

  it("a failed post can be claimed again and counts attempts", async () => {
    const { scheduleId } = await scheduled();
    await claimForPublishing(scheduleId);
    await markFailed(scheduleId, "boom");
    expect((await db.select().from(schema.scheduledPosts))[0]).toMatchObject({ status: "failed", error: "boom" });
    expect(await claimForPublishing(scheduleId)).not.toBeNull();
    expect((await db.select().from(schema.scheduledPosts))[0]).toMatchObject({ status: "publishing", attempts: 2, error: null });
  });

  it("stores one Instagram account, updating it on reconnect", async () => {
    await db.delete(schema.igAccounts);
    const base = { igUserId: "1", username: "a", encryptedToken: "t1", tokenExpiresAt: new Date("2030-01-01") };
    await saveIgAccount(base);
    await saveIgAccount({ ...base, encryptedToken: "t2" });
    expect(await db.select().from(schema.igAccounts)).toHaveLength(1);
    expect((await getIgAccount())?.encryptedToken).toBe("t2");
    await deleteIgAccounts();
    expect(await getIgAccount()).toBeNull();
  });
});

describe("due and missed posts", () => {
  const at = (iso: string) => new Date(iso);

  async function seed(times: string[]) {
    for (let i = 0; i < times.length; i++) await insertScrapedPost(post(i + 1));
    const rows = [];
    for (let i = 0; i < times.length; i++) {
      rows.push({ scrapedPostId: await idOf(`r${i + 1}`), scheduledAt: at(times[i]) });
    }
    await insertSchedule(rows);
  }

  it("returns only pending posts that are due and not too late, oldest first, honouring the limit", async () => {
    await seed(["2026-10-16T05:00:00Z", "2026-10-16T09:00:00Z", "2026-10-16T10:00:00Z", "2026-10-16T13:00:00Z"]);
    const now = at("2026-10-16T12:00:00Z");
    const notBefore = at("2026-10-16T06:00:00Z");
    const ids = await listDueScheduleIds(now, notBefore, 5);
    const rows = await db.select().from(schema.scheduledPosts);
    const timeOf = (id: string) => rows.find((r) => r.id === id)!.scheduledAt.toISOString();
    expect(ids.map(timeOf)).toEqual(["2026-10-16T09:00:00.000Z", "2026-10-16T10:00:00.000Z"]);
    expect(await listDueScheduleIds(now, notBefore, 1)).toHaveLength(1);
  });

  it("failMissed flags only old pending posts and leaves others untouched", async () => {
    await seed(["2026-10-16T05:00:00Z", "2026-10-16T09:00:00Z"]);
    expect(await failMissed(at("2026-10-16T06:00:00Z"))).toBe(1);
    const rows = await db.select().from(schema.scheduledPosts);
    const old = rows.find((r) => r.scheduledAt.toISOString() === "2026-10-16T05:00:00.000Z")!;
    const recent = rows.find((r) => r.scheduledAt.toISOString() === "2026-10-16T09:00:00.000Z")!;
    expect(old).toMatchObject({ status: "failed", error: expect.stringMatching(/Missed/) });
    expect(recent.status).toBe("pending");
    expect(await failMissed(at("2026-10-16T06:00:00Z"))).toBe(0);
  });

  it("skips posts that are already publishing", async () => {
    await seed(["2026-10-16T09:00:00Z"]);
    const [row] = await db.select().from(schema.scheduledPosts);
    await claimForPublishing(row.id);
    expect(await listDueScheduleIds(at("2026-10-16T12:00:00Z"), at("2026-10-16T00:00:00Z"), 5)).toEqual([]);
  });
});
