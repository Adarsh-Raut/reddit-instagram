import { describe, expect, it } from "vitest";
import { describeCleanup, describePublishRun, describeRefresh } from "./activity";

describe("describePublishRun", () => {
  it("says nothing for an ordinary run (per-post results are logged by the publisher)", () => {
    expect(describePublishRun({ stuck: 0, missed: 0, results: [{ id: "a", ok: true }] })).toEqual([]);
  });

  it("warns about stuck and missed posts", () => {
    const events = describePublishRun({ stuck: 1, missed: 2, results: [] });
    expect(events.map((e) => e.kind)).toEqual(["job.stuck_posts", "job.missed_posts"]);
    expect(events.every((e) => e.level === "warn")).toBe(true);
    expect(events[0].message).toMatch(/1 post got stuck/);
    expect(events[1].message).toMatch(/2 posts missed/);
  });
});

describe("describeRefresh", () => {
  it("records a refresh, flags an expired token as an error, ignores the rest", () => {
    expect(describeRefresh("refreshed")[0]).toMatchObject({ level: "info", kind: "instagram.token_refreshed" });
    expect(describeRefresh("expired")[0]).toMatchObject({ level: "error", kind: "instagram.token_expired" });
    expect(describeRefresh("not-needed")).toEqual([]);
    expect(describeRefresh("no-account")).toEqual([]);
  });
});

describe("describeCleanup", () => {
  it("is quiet when nothing happened", () => {
    expect(describeCleanup({ deleted: 0, errors: [] }, 0)).toEqual([]);
  });

  it("reports deletions, failures and pruning", () => {
    const events = describeCleanup({ deleted: 3, errors: ["x: nope"] }, 10);
    expect(events[0]).toMatchObject({ level: "warn", kind: "cleanup.images" });
    expect(events[0].message).toBe("Removed 3 old images from Cloudinary, 1 failed");
    expect(events[1]).toMatchObject({ kind: "cleanup.activity", meta: { pruned: 10 } });
    expect(describeCleanup({ deleted: 1, errors: [] }, 0)[0]).toMatchObject({ level: "info" });
  });
});
