import { createHash, randomBytes } from "node:crypto";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MANUAL_SUBREDDIT = "manual";

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Identify the real image type from the first bytes (the browser-supplied type can't be trusted). */
export function sniffImage(b: Buffer): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export type ManualMemeDeps = {
  hashExists: (hash: string) => Promise<boolean>;
  upload: (dataUri: string, publicId: string) => Promise<{ url: string; publicId: string }>;
  insert: (post: {
    redditId: string;
    subreddit: string;
    title: string;
    author: null;
    permalink: string;
    cloudinaryUrl: string;
    cloudinaryPublicId: string;
    imageHash: string;
    status: "approved";
  }) => Promise<void>;
};

export type ManualMemeResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * Add an image the admin uploaded themselves. It skips scraping and review (the admin
 * chose it), so it starts out approved. Duplicates are caught by the image hash.
 */
export async function addManualMeme(
  input: { bytes: Buffer; title: string },
  deps: ManualMemeDeps,
): Promise<ManualMemeResult> {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 200) return { ok: false, message: "Give the meme a title of 1 to 200 characters." };
  if (input.bytes.length === 0) return { ok: false, message: "Choose an image file." };
  if (input.bytes.length > MAX_UPLOAD_BYTES) return { ok: false, message: "That image is larger than 10 MB." };
  const mime = sniffImage(input.bytes);
  if (!mime) return { ok: false, message: "Only JPEG, PNG or WebP images are supported." };

  const hash = createHash("sha256").update(input.bytes).digest("hex");
  if (await deps.hashExists(hash)) return { ok: false, message: "That exact image has already been added." };

  const id = `manual-${randomBytes(6).toString("hex")}`;
  const uploaded = await deps.upload(`data:${mime};base64,${input.bytes.toString("base64")}`, id);
  await deps.insert({
    redditId: id,
    subreddit: MANUAL_SUBREDDIT,
    title,
    author: null,
    permalink: "",
    cloudinaryUrl: uploaded.url,
    cloudinaryPublicId: uploaded.publicId,
    imageHash: hash,
    status: "approved",
  });
  return { ok: true, id };
}

export const isManual = (post: { subreddit: string }) => post.subreddit === MANUAL_SUBREDDIT;
/** "r/memes" for scraped posts, "Uploaded" for the admin's own. */
export const sourceLabel = (post: { subreddit: string }) => (isManual(post) ? "Uploaded" : `r/${post.subreddit}`);
