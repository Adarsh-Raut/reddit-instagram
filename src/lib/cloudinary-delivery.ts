// Pure URL building for images shown in the app (not the ones sent to Instagram: see cloudinary.ts).
// Cloudinary resizes and re-encodes on its own CDN, so the browser fetches small files directly
// instead of routing every image through the Next.js optimizer (which downloads the full original).

const UPLOAD_URL = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
const MAX_WIDTH = 2000;

/**
 * `f_auto,q_auto` lets Cloudinary pick the best format and quality for the browser; `c_limit`
 * never upscales. Each distinct width is one billed transformation the first time it is requested
 * (then cached), which is why `next.config.ts` allows only a handful of widths.
 */
export function deliveryUrl(src: string, width: number): string {
  const m = UPLOAD_URL.exec(src);
  if (!m) return src; // not a Cloudinary upload URL: leave it alone
  const w = Math.min(MAX_WIDTH, Math.max(1, Math.round(width)));
  return `${m[1]}f_auto,q_auto,c_limit,w_${w}/${m[2]}`;
}
