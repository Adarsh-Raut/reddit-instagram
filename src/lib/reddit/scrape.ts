import { createHash } from "node:crypto";
import type { RedditImagePost } from "./client";

export type NewScrapedPost = {
  redditId: string;
  subreddit: string;
  title: string;
  author: string | null;
  permalink: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  imageHash: string;
};

export type ScrapeDeps = {
  fetchSubreddit: (subreddit: string, limit: number) => Promise<RedditImagePost[]>;
  /** Returns the subset of these Reddit ids already stored. */
  existingRedditIds: (ids: string[]) => Promise<Set<string>>;
  hashExists: (hash: string) => Promise<boolean>;
  downloadImage: (url: string) => Promise<{ bytes: Buffer; contentType: string }>;
  upload: (
    dataUri: string,
    publicId: string,
  ) => Promise<{ url: string; publicId: string }>;
  insert: (post: NewScrapedPost) => Promise<void>;
};

export type ScrapeResult = {
  added: number;
  skippedDuplicates: number;
  errors: string[];
};

/**
 * Scrape up to `count` new image posts across subreddits.
 * Skips known Reddit ids and byte-identical images (reposts/crossposts).
 * One failing subreddit or image never aborts the whole run.
 */
export async function scrapeMemes(
  subreddits: string[],
  count: number,
  deps: ScrapeDeps,
): Promise<ScrapeResult> {
  const result: ScrapeResult = { added: 0, skippedDuplicates: 0, errors: [] };

  // Over-fetch because many hot posts are filtered out (videos, NSFW, links).
  const perSub = Math.min(100, Math.max(count * 3, 25));
  const candidates: RedditImagePost[] = [];
  for (const sub of subreddits) {
    try {
      candidates.push(...(await deps.fetchSubreddit(sub, perSub)));
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const seen = new Set<string>();
  const unique = candidates
    .sort((a, b) => b.score - a.score)
    .filter((p) => (seen.has(p.redditId) ? false : (seen.add(p.redditId), true)));

  const known = await deps.existingRedditIds(unique.map((p) => p.redditId));
  const fresh = unique.filter((p) => !known.has(p.redditId));
  result.skippedDuplicates += unique.length - fresh.length;

  for (const post of fresh) {
    if (result.added >= count) break;
    try {
      const { bytes, contentType } = await deps.downloadImage(post.imageUrl);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (await deps.hashExists(hash)) {
        result.skippedDuplicates++;
        continue;
      }
      const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
      const uploaded = await deps.upload(dataUri, post.redditId);
      await deps.insert({
        redditId: post.redditId,
        subreddit: post.subreddit,
        title: post.title,
        author: post.author,
        permalink: post.permalink,
        cloudinaryUrl: uploaded.url,
        cloudinaryPublicId: uploaded.publicId,
        imageHash: hash,
      });
      result.added++;
    } catch (e) {
      result.errors.push(
        `${post.redditId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return result;
}
