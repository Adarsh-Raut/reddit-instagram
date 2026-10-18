import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { autoScheduleIfEnabled, scheduleApprovedPosts } from "@/lib/schedule/service";
import {
  ACTIVITY_PAGE_SIZE,
  countActivity,
  insertActivity,
  listActivity,
  pruneActivity,
  claimForPublishing,
  clearImage,
  countByStatus,
  failStuck,
  getScheduleCaptionInfo,
  insertSchedule,
  insertScrapedPost,
  saveIgAccount,
  listPosts,
  listStaleRejected,
  PAGE_SIZE,
  rescheduleTo,
  saveSettings,
  setPostStatus,
  updateScheduleCaption,
  getAlertInputs,
} from "./queries";
import * as schema from "./schema";
import { createTestDb, resetTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;

const post = (n: number) => ({
  redditId: `r${n}`,
  subreddit: "memes",
  title: `t${n}`,
  permalink: `https://reddit.com/${n}`,
  cloudinaryUrl: `https://res.cloudinary.com/x/${n}.jpg`,
  cloudinaryPublicId: `memes/${n}`,
  imageHash: `h${n}`,
});
const idOf = async (redditId: string) =>
  (await db.select().from(schema.scrapedPosts)).find((p) => p.redditId === redditId)!.id;
const at = (iso: string) => new Date(iso);

async function approved(...ns: number[]) {
  for (const n of ns) {
    await insertScrapedPost(post(n));
    await setPostStatus(await idOf(`r${n}`), "approved");
  }
}
async function scheduledRow(n: number, when: string) {
  await insertScrapedPost(post(n));
  await insertSchedule([{ scrapedPostId: await idOf(`r${n}`), scheduledAt: at(when) }]);
  return (await db.select().from(schema.scheduledPosts).where(eq(schema.scheduledPosts.scrapedPostId, await idOf(`r${n}`))))[0];
}
const settings = (over = {}) =>
  saveSettings({
    subreddits: ["memes"], scrapeCount: 15, postSlots: ["09:00", "14:00", "20:00"], timezone: "UTC",
    autoScrape: true, autoSchedule: false, autoScheduleDays: 7, ...over,
  });

beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  await settings();
});

describe("scheduleApprovedPosts", () => {
  it("gives approved posts the next free slots, oldest first", async () => {
    await approved(1, 2, 3, 4);
    const r = await scheduleApprovedPosts(7, at("2026-10-16T10:00:00Z"));
    expect(r).toMatchObject({ ok: true, scheduled: 4 });
    const rows = await db.select().from(schema.scheduledPosts);
    expect(rows.map((x) => x.scheduledAt.toISOString()).sort()).toEqual([
      "2026-10-16T14:00:00.000Z",
      "2026-10-16T20:00:00.000Z",
      "2026-10-17T09:00:00.000Z",
      "2026-10-17T14:00:00.000Z",
    ]);
  });

  it("does not double-book slots across runs, and says so when nothing is left to schedule", async () => {
    await approved(1);
    await scheduleApprovedPosts(7, at("2026-10-16T10:00:00Z"));
    await approved(2);
    await scheduleApprovedPosts(7, at("2026-10-16T10:00:00Z"));
    const times = (await db.select().from(schema.scheduledPosts)).map((x) => x.scheduledAt.toISOString()).sort();
    expect(times).toEqual(["2026-10-16T14:00:00.000Z", "2026-10-16T20:00:00.000Z"]);
    expect(await scheduleApprovedPosts(7, at("2026-10-16T10:00:00Z"))).toMatchObject({ ok: false, scheduled: 0 });
  });

  it("leaves posts that don't fit in the horizon approved and reports it", async () => {
    await approved(1, 2, 3, 4, 5);
    const r = await scheduleApprovedPosts(1, at("2026-10-16T10:00:00Z")); // only 2 slots left today
    expect(r.scheduled).toBe(2);
    expect(r.message).toMatch(/3 left unscheduled/);
  });
});

describe("autoScheduleIfEnabled", () => {
  it("does nothing when the option is off", async () => {
    await approved(1);
    expect(await autoScheduleIfEnabled(at("2026-10-16T10:00:00Z"))).toBeNull();
    expect(await db.select().from(schema.scheduledPosts)).toHaveLength(0);
  });

  it("schedules approved posts when the option is on, using the configured horizon", async () => {
    await settings({ autoSchedule: true, autoScheduleDays: 1 });
    await approved(1, 2, 3, 4);
    const r = await autoScheduleIfEnabled(at("2026-10-16T10:00:00Z"));
    expect(r?.scheduled).toBe(2);
  });
});

describe("stuck publishing recovery", () => {
  it("fails only posts that have been publishing too long, with a check-Instagram warning", async () => {
    const a = await scheduledRow(1, "2030-01-01T10:00:00Z");
    const b = await scheduledRow(2, "2030-01-01T11:00:00Z");
    await claimForPublishing(a.id);
    await claimForPublishing(b.id);
    await db.update(schema.scheduledPosts).set({ claimedAt: at("2026-10-16T09:00:00Z") }).where(eq(schema.scheduledPosts.id, a.id));
    expect(await failStuck(at("2026-10-16T09:30:00Z"))).toBe(1);
    const rows = await db.select().from(schema.scheduledPosts);
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ status: "failed", error: expect.stringMatching(/Check Instagram/) });
    expect(rows.find((r) => r.id === b.id)?.status).toBe("publishing");
  });

  it("records when publishing started", async () => {
    const a = await scheduledRow(1, "2030-01-01T10:00:00Z");
    await claimForPublishing(a.id);
    expect((await db.select().from(schema.scheduledPosts))[0].claimedAt).toBeInstanceOf(Date);
  });
});

describe("editing scheduled posts", () => {
  it("updates the caption of a pending post but never a publishing one", async () => {
    const a = await scheduledRow(1, "2030-01-01T10:00:00Z");
    expect(await updateScheduleCaption(a.id, "hello #memes")).toBe(true);
    expect((await getScheduleCaptionInfo(a.id))?.caption).toBe("hello #memes");
    await claimForPublishing(a.id);
    expect(await updateScheduleCaption(a.id, "too late")).toBe(false);
    expect((await getScheduleCaptionInfo(a.id))?.caption).toBe("hello #memes");
  });

  it("reschedules, turning a failed/missed post back into pending", async () => {
    const a = await scheduledRow(1, "2030-01-01T10:00:00Z");
    await db.update(schema.scheduledPosts).set({ status: "failed", error: "Missed" }).where(eq(schema.scheduledPosts.id, a.id));
    expect(await rescheduleTo(a.id, at("2030-02-01T10:00:00Z"))).toBe(true);
    expect((await db.select().from(schema.scheduledPosts))[0]).toMatchObject({ status: "pending", error: null });
    expect((await getScheduleCaptionInfo(a.id))?.scheduledAt.toISOString()).toBe("2030-02-01T10:00:00.000Z");
  });

  it("refuses to move a posted post and rejects a clashing slot", async () => {
    const a = await scheduledRow(1, "2030-01-01T10:00:00Z");
    const b = await scheduledRow(2, "2030-01-01T11:00:00Z");
    await expect(rescheduleTo(b.id, at("2030-01-01T10:00:00Z"))).rejects.toThrow();
    await db.update(schema.scheduledPosts).set({ status: "posted" }).where(eq(schema.scheduledPosts.id, a.id));
    expect(await rescheduleTo(a.id, at("2031-01-01T10:00:00Z"))).toBe(false);
  });
});

describe("alert inputs (one query for the whole banner)", () => {
  it("returns every number the banner needs", async () => {
    const failed = await scheduledRow(1, "2026-10-17T10:00:00Z");
    await db.update(schema.scheduledPosts).set({ status: "failed" }).where(eq(schema.scheduledPosts.id, failed.id));
    await scheduledRow(2, "2026-10-18T10:00:00Z"); // pending and still ahead
    await scheduledRow(3, "2026-10-10T10:00:00Z"); // pending but already in the past
    await approved(4, 5); // approved with no time yet
    await settings({ postSlots: ["10:00", "16:00"], autoSchedule: true });
    const expires = at("2030-01-01T00:00:00Z");
    await saveIgAccount({ igUserId: "1", username: "u", encryptedToken: "x", tokenExpiresAt: expires });

    expect(await getAlertInputs(at("2026-10-16T00:00:00Z"))).toEqual({
      failedCount: 1,
      upcomingCount: 1,
      approvedUnscheduled: 2,
      hasAccount: true,
      tokenExpiresAt: expires,
      slotsPerDay: 2,
      autoSchedule: true,
    });
    // the same data seen from a later time: nothing is upcoming any more
    expect((await getAlertInputs(at("2030-01-01T00:00:00Z"))).upcomingCount).toBe(0);
  });

  it("reports zeros and no account when there is nothing yet", async () => {
    expect(await getAlertInputs(at("2026-10-16T00:00:00Z"))).toEqual({
      failedCount: 0,
      upcomingCount: 0,
      approvedUnscheduled: 0,
      hasAccount: false,
      tokenExpiresAt: null,
      slotsPerDay: 3,
      autoSchedule: false,
    });
  });

  it("uses the newest connected account's token expiry", async () => {
    await saveIgAccount({ igUserId: "1", username: "old", encryptedToken: "x", tokenExpiresAt: at("2027-01-01T00:00:00Z") });
    await db.update(schema.igAccounts).set({ createdAt: at("2026-01-01T00:00:00Z") });
    await saveIgAccount({ igUserId: "2", username: "new", encryptedToken: "x", tokenExpiresAt: at("2028-06-01T00:00:00Z") });
    expect((await getAlertInputs(at("2026-10-16T00:00:00Z"))).tokenExpiresAt?.toISOString()).toBe("2028-06-01T00:00:00.000Z");
  });

  it("creates the settings row and uses the defaults on a fresh install", async () => {
    await db.delete(schema.settings);
    const r = await getAlertInputs(at("2026-10-16T00:00:00Z"));
    expect(r).toMatchObject({ slotsPerDay: 3, autoSchedule: false });
    expect(await db.select().from(schema.settings)).toHaveLength(1);
  });
});

describe("old rejected images", () => {
  it("lists only old rejected posts that still have an image, and clearing hides them", async () => {
    for (const n of [1, 2, 3]) await insertScrapedPost(post(n));
    await db.update(schema.scrapedPosts).set({ status: "rejected", scrapedAt: at("2026-09-01T00:00:00Z") }).where(eq(schema.scrapedPosts.redditId, "r1"));
    await db.update(schema.scrapedPosts).set({ status: "rejected", scrapedAt: at("2026-10-15T00:00:00Z") }).where(eq(schema.scrapedPosts.redditId, "r2")); // recent
    await db.update(schema.scrapedPosts).set({ scrapedAt: at("2026-09-01T00:00:00Z") }).where(eq(schema.scrapedPosts.redditId, "r3")); // old but not rejected
    const stale = await listStaleRejected(at("2026-10-01T00:00:00Z"), 10);
    expect(stale).toEqual([{ id: await idOf("r1"), publicId: "memes/1" }]);
    await clearImage(stale[0].id);
    expect(await listStaleRejected(at("2026-10-01T00:00:00Z"), 10)).toEqual([]);
    // the row stays, so the reddit id still blocks a re-scrape
    expect((await db.select().from(schema.scrapedPosts).where(eq(schema.scrapedPosts.redditId, "r1")))[0].cloudinaryUrl).toBe("");
  });
});

describe("pagination and counts", () => {
  it("pages through new posts without gaps or repeats, and counts by status", async () => {
    const total = PAGE_SIZE + 5;
    for (let n = 1; n <= total; n++) await insertScrapedPost(post(n));
    await setPostStatus(await idOf("r1"), "approved");
    const p1 = await listPosts("new", 1);
    const p2 = await listPosts("new", 2);
    expect(p1).toHaveLength(PAGE_SIZE);
    expect(p2).toHaveLength(total - 1 - PAGE_SIZE);
    expect(new Set([...p1, ...p2].map((p) => p.id)).size).toBe(total - 1);
    expect(await countByStatus()).toEqual({ new: total - 1, approved: 1, rejected: 0, posted: 0 });
  });
});

describe("activity log", () => {
  beforeEach(async () => {
    await db.delete(schema.activityLog);
  });

  it("stores events with json meta, newest first, and filters to problems", async () => {
    // spaced out: rows written in the same millisecond have no defined order
    const pause = () => new Promise((r) => setTimeout(r, 5));
    await insertActivity({ level: "info", kind: "a", message: "one", meta: { x: 1 } });
    await pause();
    await insertActivity({ level: "warn", kind: "b", message: "two" });
    await pause();
    await insertActivity({ level: "error", kind: "c", message: "three" });
    const all = await listActivity();
    expect(all.map((r) => r.message)).toEqual(["three", "two", "one"]);
    expect(all[2].meta).toEqual({ x: 1 });
    expect(all[1].meta).toBeNull();
    expect((await listActivity(1, true)).map((r) => r.message)).toEqual(["three", "two"]);
    expect(await countActivity()).toBe(3);
    expect(await countActivity(true)).toBe(2);
  });

  it("pages without gaps or repeats", async () => {
    for (let i = 0; i < ACTIVITY_PAGE_SIZE + 3; i++) await insertActivity({ level: "info", kind: "k", message: `m${i}` });
    const [p1, p2] = [await listActivity(1), await listActivity(2)];
    expect(p1).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(p2).toHaveLength(3);
    expect(new Set([...p1, ...p2].map((r) => r.id)).size).toBe(ACTIVITY_PAGE_SIZE + 3);
  });

  it("prunes only entries older than the cutoff", async () => {
    await insertActivity({ level: "info", kind: "new", message: "recent" });
    await db.insert(schema.activityLog).values({ level: "info", kind: "old", message: "ancient", at: new Date("2020-01-01T00:00:00Z") });
    expect(await pruneActivity(new Date("2025-01-01T00:00:00Z"))).toBe(1);
    expect((await listActivity()).map((r) => r.message)).toEqual(["recent"]);
  });

  it("records an event when scheduling, so the activity page shows it", async () => {
    await settings();
    await approved(1);
    await scheduleApprovedPosts(7, at("2026-10-16T10:00:00Z"));
    const rows = await listActivity();
    expect(rows[0]).toMatchObject({ level: "info", kind: "schedule.created" });
    expect(rows[0].meta).toMatchObject({ count: 1 });
  });
});
