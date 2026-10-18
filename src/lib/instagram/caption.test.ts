import { describe, expect, it } from "vitest";
import {
  analyzeCaption,
  buildCaption,
  CAPTION_FEED_PREVIEW_LENGTH,
  CAPTION_MAX_HASHTAGS,
  CAPTION_MAX_LENGTH,
  pickCaption,
} from "./caption";

describe("buildCaption", () => {
  it("credits the author and subreddit for scraped memes", () => {
    expect(buildCaption({ title: "Hi", author: "bob", subreddit: "memes" })).toBe("Hi\n\nCredit: u/bob on Reddit (r/memes)");
  });
  it("falls back to the source line without an author", () => {
    expect(buildCaption({ title: "Hi", author: null, subreddit: "memes" })).toBe("Hi\n\nSource: r/memes on Reddit");
  });
  it("uses just the title for uploaded memes", () => {
    expect(buildCaption({ title: "Mine", author: null, subreddit: "manual" })).toBe("Mine");
  });
});

describe("pickCaption", () => {
  it("uses the edited caption as-is", () => {
    expect(pickCaption("My own #caption", "default")).toBe("My own #caption");
  });
  it("falls back to the default when the edit is empty or only whitespace", () => {
    expect(pickCaption("", "default")).toBe("default");
    expect(pickCaption("  \n ", "default")).toBe("default");
  });
});

describe("analyzeCaption", () => {
  it("counts characters, hashtags and mentions", () => {
    const text = "Great day #sun #fun_times (#ok) @someone and @a.b_c email me@x.com";
    const a = analyzeCaption(text);
    expect(a.hashtags).toBe(3);
    expect(a.mentions).toBe(2); // the address in me@x.com is not a mention
    expect(a.length).toBe(text.length);
    expect(a.issues).toEqual([]);
  });

  it("does not count URL fragments or HTML entities as hashtags", () => {
    expect(analyzeCaption("see https://x.com/page#section and &#39; done").hashtags).toBe(0);
  });

  it("flags more than 30 hashtags as an error", () => {
    const tags = Array.from({ length: CAPTION_MAX_HASHTAGS + 1 }, (_, i) => `#t${i}`).join(" ");
    const a = analyzeCaption(tags);
    expect(a.hashtags).toBe(31);
    expect(a.issues).toEqual([expect.objectContaining({ level: "error", text: expect.stringContaining("30 hashtags") })]);
    expect(analyzeCaption(tags.split(" ").slice(0, 30).join(" ")).issues).toEqual([]);
  });

  it("flags captions over 2,200 characters as an error but allows exactly 2,200", () => {
    expect(analyzeCaption("a".repeat(CAPTION_MAX_LENGTH)).issues).toEqual([]);
    const over = analyzeCaption("a".repeat(CAPTION_MAX_LENGTH + 1));
    expect(over.issues[0]).toMatchObject({ level: "error" });
    expect(over.issues[0].text).toContain("2,201");
  });

  it("warns about more than 20 mentions", () => {
    const a = analyzeCaption(Array.from({ length: 21 }, (_, i) => `@user${i}`).join(" "));
    expect(a.issues).toEqual([expect.objectContaining({ level: "warn" })]);
  });

  it("shows no cut for a short caption", () => {
    expect(analyzeCaption("short").feedCut).toBeNull();
    expect(analyzeCaption("x".repeat(CAPTION_FEED_PREVIEW_LENGTH)).feedCut).toBeNull();
  });

  it("cuts a long caption on a word boundary within the feed length", () => {
    const text = "word ".repeat(60).trim();
    const cut = analyzeCaption(text).feedCut;
    expect(cut).not.toBeNull();
    expect(cut!.shown.length).toBeLessThanOrEqual(CAPTION_FEED_PREVIEW_LENGTH);
    expect(cut!.shown.endsWith("word")).toBe(true);
    expect(text.startsWith(cut!.shown)).toBe(true);
  });

  it("hard-cuts a single very long word instead of showing nothing", () => {
    const cut = analyzeCaption("x".repeat(300)).feedCut;
    expect(cut!.shown).toHaveLength(CAPTION_FEED_PREVIEW_LENGTH);
  });
});
