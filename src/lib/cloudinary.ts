import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryEnv } from "./env";

function configure() {
  const env = getCloudinaryEnv();
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

/** Upload a remote image (e.g. a Reddit URL) into the memes folder. */
export async function uploadRemoteImage(sourceUrl: string, publicId: string) {
  const res = await configure().uploader.upload(sourceUrl, {
    folder: "memes",
    public_id: publicId,
    overwrite: false,
    resource_type: "image",
  });
  return { url: res.secure_url, publicId: res.public_id };
}

/**
 * Instagram needs a public JPEG with an aspect ratio between 4:5 and 1.91:1. Images already in
 * that range are only converted and capped at 1080px wide; only images outside it are padded
 * (taller than 4:5 -> 4:5, wider than 1.91:1 -> 1.91:1) so memes keep their full size.
 *
 * Each condition MUST be its own array entry: Cloudinary needs `if_ar_gt_1.91/` as a separate URL
 * segment and answers 400 "Cannot find matching if" when it is joined to the transformation.
 */
export const INSTAGRAM_TRANSFORMATION = [
  { if: "ar > 1.91" },
  { aspect_ratio: "1.91", crop: "pad", background: "auto" },
  { if: "end" },
  { if: "ar < 0.8" },
  { aspect_ratio: "4:5", crop: "pad", background: "auto" },
  { if: "end" },
  { width: 1080, crop: "limit" },
];

/** The Instagram-ready URL for an image. `cloudName` overrides the configured one (used by tests). */
export function instagramImageUrl(publicId: string, cloudName?: string) {
  return cloudinary.url(publicId, {
    ...(cloudName ? { cloud_name: cloudName } : {}),
    secure: true,
    format: "jpg",
    transformation: INSTAGRAM_TRANSFORMATION,
  });
}

export function instagramReadyUrl(publicId: string) {
  configure();
  return instagramImageUrl(publicId);
}

/** Remove an image from Cloudinary. Throws if Cloudinary reports anything but ok/not found. */
export async function deleteImage(publicId: string) {
  const res = await configure().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  if (res.result !== "ok" && res.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${res.result}`);
  }
}
