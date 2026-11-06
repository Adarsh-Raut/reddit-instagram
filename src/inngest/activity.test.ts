import { describe, expect, it } from "vitest";
import { describeCaptionRun, describeCleanup, describePublishRun, describeRefresh } from "./activity";

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

describe("describeCaptionRun", () => {
  const run = (over = {}) => ({ skipped: null, generated: [], failed: 0, failures: [], ...over });
  it("says nothing when there was nothing to do or the feature is off", () => {
    expect(describeCaptionRun(run())).toEqual([]);
    expect(describeCaptionRun(run({ skipped: "off" }))).toEqual([]);
    expect(describeCaptionRun(run({ skipped: "no-keys" }))).toEqual([]);
  });
  it("records written captions with the providers used", () => {
    const [e] = describeCaptionRun(run({ generated: ["gemini", "groq", "gemini"] }));
    expect(e).toMatchObject({ level: "info", kind: "caption.generated" });
    expect(e.message).toBe("Wrote 3 AI captions (gemini, groq)");
  });
  it("notes a fallback (Gemini failed, Groq covered) as info with the reason", () => {
    const events = describeCaptionRun(run({ generated: ["groq"], failures: ["gemini: HTTP 429"] }));
    expect(events.map((e) => e.kind)).toEqual(["caption.generated", "caption.fallback"]);
    expect(events[1]).toMatchObject({ level: "info", meta: { failures: ["gemini: HTTP 429"] } });
  });
  it("warns when no provider could write a caption", () => {
    const [e] = describeCaptionRun(run({ failed: 1, failures: ["gemini: HTTP 429", "groq: HTTP 500"] }));
    expect(e).toMatchObject({ level: "warn", kind: "caption.failed" });
    expect(e.message).toContain("default caption");
  });
});
