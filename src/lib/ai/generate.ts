import { buildPrompt, composeCaption, parseAiCaption, type CaptionSubject } from "./prompt";
import type { CaptionImage, CaptionProvider } from "./providers";

export type GenerateResult =
  | { ok: true; caption: string; provider: CaptionProvider["name"]; failures: string[] }
  | { ok: false; failures: string[] };

/**
 * Try each provider in order (Gemini first, then Groq) and return the first usable caption.
 * Errors, rate limits and unusable replies move on to the next provider; the reasons are
 * returned so the activity log can say why a fallback happened. Never throws.
 */
export async function generateCaption(
  providers: CaptionProvider[],
  post: CaptionSubject,
  image: CaptionImage | null,
): Promise<GenerateResult> {
  const failures: string[] = [];
  const prompt = buildPrompt(post, image !== null);
  for (const provider of providers) {
    try {
      const raw = await provider.complete({ prompt, image });
      const parsed = parseAiCaption(raw);
      if (parsed) return { ok: true, caption: composeCaption(parsed, post), provider: provider.name, failures };
      failures.push(`${provider.name}: reply was not usable`);
    } catch (e) {
      failures.push(`${provider.name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  return { ok: false, failures };
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif)$/;

/** Download the meme so the model can see it. Returns null on any problem: the caption then goes by title. */
export async function loadImage(url: string, fetchFn: typeof fetch = fetch): Promise<CaptionImage | null> {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!IMAGE_MIME.test(mime)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { mime, base64: Buffer.from(bytes).toString("base64") };
  } catch {
    return null;
  }
}
