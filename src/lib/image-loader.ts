"use client";

import { deliveryUrl } from "./cloudinary-delivery";

/** Global `next/image` loader (see `images.loaderFile` in next.config.ts). */
export default function cloudinaryLoader({ src, width }: { src: string; width: number; quality?: number }) {
  return deliveryUrl(src, width);
}
