import { describe, expect, it, vi } from "vitest";
import { fetchSubredditImages, getAccessToken, parseImagePosts } from "./client";

const post = (over: Record<string, unknown> = {}) => ({
  data: {
    id: "abc",
    title: "funny",
    subreddit: "memes",
    author: "bob",
    permalink: "/r/memes/comments/abc/funny/",
    url: "https://i.redd.it/abc.jpg",
    post_hint: "image",
    score: 10,
    ...over,
  },
});
const listing = (...children: unknown[]) => ({ data: { children } });

describe("parseImagePosts", () => {
  it("keeps a valid image post and builds an absolute permalink", () => {
    const [p] = parseImagePosts(listing(post()));
    expect(p).toMatchObject({
      redditId: "abc",
      imageUrl: "https://i.redd.it/abc.jpg",
      permalink: "https://www.reddit.com/r/memes/comments/abc/funny/",
      score: 10,
    });
  });

  it.each([
    ["NSFW", { over_18: true }],
    ["stickied", { stickied: true }],
    ["video", { is_video: true }],
    ["gallery", { is_gallery: true }],
    ["gif", { url: "https://i.redd.it/abc.gif" }],
    ["external host", { url: "https://imgur.com/abc.jpg" }],
    ["link post", { post_hint: "link" }],
    ["bad url", { url: "not a url" }],
    ["missing title", { title: undefined }],
  ])("drops %s posts", (_name, over) => {
    expect(parseImagePosts(listing(post(over)))).toEqual([]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseImagePosts(null)).toEqual([]);
    expect(parseImagePosts({ nope: 1 })).toEqual([]);
  });
});

describe("Reddit HTTP", () => {
  it("gets an access token with basic auth", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }),
    );
    const token = await getAccessToken(
      { clientId: "id", clientSecret: "sec", userAgent: "ua" },
      fetchFn,
    );
    expect(token).toBe("tok");
    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("id:sec").toString("base64")}`);
  });

  it("throws when auth fails", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("no", { status: 401 }));
    await expect(
      getAccessToken({ clientId: "a", clientSecret: "b", userAgent: "c" }, fetchFn),
    ).rejects.toThrow(/401/);
  });

  it("fetches and parses a subreddit", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(listing(post())), { status: 200 }),
    );
    const posts = await fetchSubredditImages("memes", 25, "tok", "ua", fetchFn);
    expect(posts).toHaveLength(1);
    expect(fetchFn.mock.calls[0][0]).toContain("/r/memes/hot?limit=25");
  });

  it("throws on a non-OK subreddit response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    await expect(fetchSubredditImages("x", 5, "t", "ua", fetchFn)).rejects.toThrow(/403/);
  });
});
