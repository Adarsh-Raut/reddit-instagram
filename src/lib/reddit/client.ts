import { z } from "zod";

export type RedditImagePost = {
  redditId: string;
  subreddit: string;
  title: string;
  author: string | null;
  permalink: string;
  imageUrl: string;
  score: number;
};

const listingSchema = z.object({
  data: z.object({
    children: z.array(z.object({ data: z.record(z.string(), z.unknown()) })),
  }),
});

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

/** Keep only static, SFW, non-pinned images hosted on i.redd.it. */
export function parseImagePosts(json: unknown): RedditImagePost[] {
  const listing = listingSchema.safeParse(json);
  if (!listing.success) return [];

  const posts: RedditImagePost[] = [];
  for (const { data: d } of listing.data.data.children) {
    const url = typeof d.url === "string" ? d.url : "";
    let host = "";
    let path = "";
    try {
      const u = new URL(url);
      host = u.hostname;
      path = u.pathname;
    } catch {
      continue;
    }
    if (
      d.post_hint !== "image" ||
      host !== "i.redd.it" ||
      !IMAGE_EXT.test(path) ||
      d.over_18 === true ||
      d.stickied === true ||
      d.is_video === true ||
      d.is_gallery === true ||
      typeof d.id !== "string" ||
      typeof d.title !== "string" ||
      typeof d.subreddit !== "string" ||
      typeof d.permalink !== "string"
    ) {
      continue;
    }
    posts.push({
      redditId: d.id,
      subreddit: d.subreddit,
      title: d.title,
      author: typeof d.author === "string" ? d.author : null,
      permalink: `https://www.reddit.com${d.permalink}`,
      imageUrl: url,
      score: typeof d.score === "number" ? d.score : 0,
    });
  }
  return posts;
}

type Credentials = { clientId: string; clientSecret: string; userAgent: string };
type FetchFn = typeof fetch;

/** App-only OAuth (client_credentials) token. */
export async function getAccessToken(
  creds: Credentials,
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const res = await fetchFn("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "User-Agent": creds.userAgent,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status}`);
  const body = z.object({ access_token: z.string() }).safeParse(await res.json());
  if (!body.success) throw new Error("Reddit auth failed: no access_token in response");
  return body.data.access_token;
}

export async function fetchSubredditImages(
  subreddit: string,
  limit: number,
  token: string,
  userAgent: string,
  fetchFn: FetchFn = fetch,
): Promise<RedditImagePost[]> {
  const name = encodeURIComponent(subreddit);
  const res = await fetchFn(
    `https://oauth.reddit.com/r/${name}/hot?limit=${limit}&raw_json=1`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent } },
  );
  if (!res.ok) throw new Error(`Reddit r/${subreddit} failed: ${res.status}`);
  return parseImagePosts(await res.json());
}
