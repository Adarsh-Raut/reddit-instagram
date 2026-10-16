import { describe, expect, it, vi } from "vitest";
import type { RedditImagePost } from "./client";
import { scrapeMemes, type NewScrapedPost, type ScrapeDeps } from "./scrape";

const mk = (id: string, score = 1, sub = "memes"): RedditImagePost => ({
  redditId: id,
  subreddit: sub,
  title: id,
  author: "u",
  permalink: `https://www.reddit.com/${id}`,
  imageUrl: `https://i.redd.it/${id}.jpg`,
  score,
});

function deps(over: Partial<ScrapeDeps> & { posts?: Record<string, RedditImagePost[]> } = {}) {
  const inserted: NewScrapedPost[] = [];
  const { posts = { memes: [] }, ...rest } = over;
  const d: ScrapeDeps = {
    fetchSubreddit: async (sub) => posts[sub] ?? [],
    existingRedditIds: async () => new Set(),
    hashExists: async () => false,
    // bytes derived from the url so each image has a distinct hash
    downloadImage: async (url) => ({ bytes: Buffer.from(url), contentType: "image/jpeg" }),
    upload: async (_uri, id) => ({ url: `https://res.cloudinary.com/x/${id}.jpg`, publicId: `memes/${id}` }),
    insert: async (p) => void inserted.push(p),
    ...rest,
  };
  return { d, inserted };
}

describe("scrapeMemes", () => {
  it("adds up to `count` posts, highest score first", async () => {
    const { d, inserted } = deps({ posts: { memes: [mk("a", 1), mk("b", 9), mk("c", 5)] } });
    const r = await scrapeMemes(["memes"], 2, d);
    expect(r.added).toBe(2);
    expect(inserted.map((p) => p.redditId)).toEqual(["b", "c"]);
  });

  it("skips posts already stored", async () => {
    const { d, inserted } = deps({
      posts: { memes: [mk("a"), mk("b")] },
      existingRedditIds: async () => new Set(["a"]),
    });
    const r = await scrapeMemes(["memes"], 5, d);
    expect(inserted.map((p) => p.redditId)).toEqual(["b"]);
    expect(r.skippedDuplicates).toBe(1);
  });

  it("skips byte-identical images via hash", async () => {
    const { d, inserted } = deps({
      posts: { memes: [mk("a"), mk("b")] },
      hashExists: async () => true,
    });
    const r = await scrapeMemes(["memes"], 5, d);
    expect(inserted).toEqual([]);
    expect(r.skippedDuplicates).toBe(2);
  });

  it("dedupes the same post returned by two subreddits", async () => {
    const { d, inserted } = deps({ posts: { a: [mk("x", 1, "a")], b: [mk("x", 1, "b")] } });
    await scrapeMemes(["a", "b"], 5, d);
    expect(inserted).toHaveLength(1);
  });

  it("records a failing subreddit but still scrapes the others", async () => {
    const { d, inserted } = deps({
      posts: { good: [mk("g")] },
      fetchSubreddit: async (sub) => {
        if (sub === "bad") throw new Error("Reddit r/bad failed: 403");
        return [mk("g")];
      },
    });
    const r = await scrapeMemes(["bad", "good"], 5, d);
    expect(inserted).toHaveLength(1);
    expect(r.errors[0]).toMatch(/403/);
  });

  it("continues past a failing upload and counts only successes", async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error("cloudinary down"))
      .mockResolvedValue({ url: "https://res.cloudinary.com/x/b.jpg", publicId: "memes/b" });
    const { d, inserted } = deps({ posts: { memes: [mk("a", 2), mk("b", 1)] }, upload });
    const r = await scrapeMemes(["memes"], 2, d);
    expect(r.added).toBe(1);
    expect(inserted[0].redditId).toBe("b");
    expect(r.errors[0]).toMatch(/a: cloudinary down/);
  });

  it("stores the sha256 hash and cloudinary ids", async () => {
    const { d, inserted } = deps({ posts: { memes: [mk("a")] } });
    await scrapeMemes(["memes"], 1, d);
    expect(inserted[0].imageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted[0].cloudinaryPublicId).toBe("memes/a");
  });
});
