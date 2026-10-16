import {
  existingRedditIds,
  getSettings,
  hashExists,
  insertScrapedPost,
} from "@/db/queries";
import { uploadRemoteImage } from "@/lib/cloudinary";
import { getEnv } from "@/lib/env";
import { fetchSubredditImages, getAccessToken } from "./client";
import { scrapeMemes, type ScrapeResult } from "./scrape";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Wires the scraper to the real Reddit, Cloudinary and database. */
export async function runScrape(): Promise<ScrapeResult> {
  const env = getEnv();
  const { subreddits, scrapeCount } = await getSettings();
  const token = await getAccessToken({
    clientId: env.REDDIT_CLIENT_ID,
    clientSecret: env.REDDIT_CLIENT_SECRET,
    userAgent: env.REDDIT_USER_AGENT,
  });

  return scrapeMemes(subreddits, scrapeCount, {
    fetchSubreddit: (sub, limit) =>
      fetchSubredditImages(sub, limit, token, env.REDDIT_USER_AGENT),
    existingRedditIds,
    hashExists,
    downloadImage: async (url) => {
      const res = await fetch(url, { headers: { "User-Agent": env.REDDIT_USER_AGENT } });
      if (!res.ok) throw new Error(`download failed: ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image larger than 10MB");
      return { bytes, contentType: res.headers.get("content-type") ?? "image/jpeg" };
    },
    upload: uploadRemoteImage,
    insert: insertScrapedPost,
  });
}
