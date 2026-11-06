import { deliveryUrl } from "@/lib/cloudinary-delivery";
import { generateCaption, loadImage, type GenerateResult } from "./generate";
import { providersFromEnv } from "./providers";

export const hasAiProviders = () => providersFromEnv().length > 0;

/** Write a caption for one post with the configured providers (the real wiring, used by the job and the button). */
export async function generateCaptionFor(post: {
  title: string;
  author: string | null;
  subreddit: string;
  cloudinaryUrl: string;
}): Promise<GenerateResult> {
  const providers = providersFromEnv();
  if (providers.length === 0) return { ok: false, failures: ["No AI key is set (GEMINI_API_KEY or GROQ_API_KEY)"] };
  // 960px is one of the widths the app already asks Cloudinary for, so this adds no new transformation
  const image = await loadImage(deliveryUrl(post.cloudinaryUrl, 960));
  return generateCaption(providers, post, image);
}
