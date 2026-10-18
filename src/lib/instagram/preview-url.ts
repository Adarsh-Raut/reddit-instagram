import "server-only";
import { instagramReadyUrl } from "@/lib/cloudinary";

/**
 * The exact image URL publishing sends to Instagram (same function), or null when Cloudinary
 * isn't configured so a missing env var can't break a whole page.
 */
export function previewImageUrl(publicId: string): string | null {
  try {
    return instagramReadyUrl(publicId);
  } catch {
    return null;
  }
}
