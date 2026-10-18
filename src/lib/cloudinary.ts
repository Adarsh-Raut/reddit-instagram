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
 * Instagram needs a public JPEG with aspect ratio between 4:5 and 1.91:1.
 * Cloudinary converts to JPEG and pads to fit on the fly.
 */
export function instagramReadyUrl(publicId: string) {
  return configure().url(publicId, {
    secure: true,
    format: "jpg",
    transformation: [
      { aspect_ratio: "4:5", crop: "pad", background: "auto" },
      { width: 1080, crop: "limit" },
    ],
  });
}

/** Remove an image from Cloudinary. Throws if Cloudinary reports anything but ok/not found. */
export async function deleteImage(publicId: string) {
  const res = await configure().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  if (res.result !== "ok" && res.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${res.result}`);
  }
}
