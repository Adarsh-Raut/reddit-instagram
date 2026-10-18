import { describe, expect, it } from "vitest";
import { automationPatch, settingsFormInput, settingsInput } from "./settings";

const ok = {
  subreddits: "memes, r/dankmemes /r/memes",
  scrapeCount: "15",
  postSlots: "20:00, 09:00 14:00",
  timezone: "Asia/Kolkata",
  autoScrape: "on",
  autoScheduleDays: "7",
};

describe("settingsInput", () => {
  it("normalises lists: strips r/, dedupes, sorts slots, coerces count", () => {
    const r = settingsInput.parse(ok);
    expect(r.subreddits).toEqual(["memes", "dankmemes"]);
    expect(r.postSlots).toEqual(["09:00", "14:00", "20:00"]);
    expect(r.scrapeCount).toBe(15);
  });

  it("treats checkboxes as on only when ticked", () => {
    const r = settingsInput.parse(ok);
    expect(r).toMatchObject({ autoScrape: true, autoSchedule: false, autoScheduleDays: 7 });
    expect(settingsInput.parse({ ...ok, autoSchedule: "on" }).autoSchedule).toBe(true);
  });

  it.each([
    ["bad slot", { postSlots: "9am" }],
    ["no slots", { postSlots: "" }],
    ["bad subreddit", { subreddits: "not valid!" }],
    ["no subreddits", { subreddits: " " }],
    ["bad timezone", { timezone: "Nowhere/Land" }],
    ["count too high", { scrapeCount: "500" }],
    ["count zero", { scrapeCount: "0" }],
    ["auto-schedule days 0", { autoScheduleDays: "0" }],
    ["auto-schedule days 500", { autoScheduleDays: "500" }],
  ])("rejects %s", (_n, over) => {
    expect(settingsInput.safeParse({ ...ok, ...over }).success).toBe(false);
  });
});

describe("settingsFormInput", () => {
  it("only reads the form fields and ignores automation values", () => {
    const r = settingsFormInput.parse({ ...ok, autoSchedule: "on", autoScheduleDays: "99" });
    expect(Object.keys(r).sort()).toEqual(["postSlots", "scrapeCount", "subreddits", "timezone"]);
  });

  it("still rejects bad form values", () => {
    expect(settingsFormInput.safeParse({ ...ok, timezone: "Mars/Base" }).success).toBe(false);
  });
});

describe("automationPatch", () => {
  it("accepts a single changed field", () => {
    expect(automationPatch.parse({ autoScrape: true })).toEqual({ autoScrape: true });
    expect(automationPatch.parse({ autoScheduleDays: 30 })).toEqual({ autoScheduleDays: 30 });
  });

  it("rejects out-of-range days, wrong types and unknown keys", () => {
    expect(automationPatch.safeParse({ autoScheduleDays: 0 }).success).toBe(false);
    expect(automationPatch.safeParse({ autoScheduleDays: 91 }).success).toBe(false);
    expect(automationPatch.safeParse({ autoScheduleDays: 2.5 }).success).toBe(false);
    expect(automationPatch.safeParse({ autoScrape: "yes" }).success).toBe(false);
    expect(automationPatch.safeParse({ timezone: "UTC" }).success).toBe(false);
  });
});
