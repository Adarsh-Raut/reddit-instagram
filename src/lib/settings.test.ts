import { describe, expect, it } from "vitest";
import { settingsInput } from "./settings";

const ok = {
  subreddits: "memes, r/dankmemes /r/memes",
  scrapeCount: "15",
  postSlots: "20:00, 09:00 14:00",
  timezone: "Asia/Kolkata",
};

describe("settingsInput", () => {
  it("normalises lists: strips r/, dedupes, sorts slots, coerces count", () => {
    const r = settingsInput.parse(ok);
    expect(r.subreddits).toEqual(["memes", "dankmemes"]);
    expect(r.postSlots).toEqual(["09:00", "14:00", "20:00"]);
    expect(r.scrapeCount).toBe(15);
  });

  it.each([
    ["bad slot", { postSlots: "9am" }],
    ["no slots", { postSlots: "" }],
    ["bad subreddit", { subreddits: "not valid!" }],
    ["no subreddits", { subreddits: " " }],
    ["bad timezone", { timezone: "Nowhere/Land" }],
    ["count too high", { scrapeCount: "500" }],
    ["count zero", { scrapeCount: "0" }],
  ])("rejects %s", (_n, over) => {
    expect(settingsInput.safeParse({ ...ok, ...over }).success).toBe(false);
  });
});
