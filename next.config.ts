import type { NextConfig } from "next";

// When the app is opened through a tunnel (ngrok etc.), the dev server must accept that hostname.
const appHost = (() => {
  try {
    return new URL(process.env.APP_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  // Images are served straight from Cloudinary's CDN, resized there (see src/lib/cloudinary-delivery.ts).
  // Every distinct width is one billed Cloudinary transformation, so keep this list short:
  // 96 for thumbnails, then 480 / 960 / 1280 for cards on phones, laptops and large screens.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    imageSizes: [96],
    deviceSizes: [480, 960, 1280],
  },
  // pino loads files at runtime, so keep it out of the bundle
  serverExternalPackages: ["pino", "pino-pretty"],
  allowedDevOrigins: appHost && appHost !== "localhost" ? [appHost] : [],
  // image uploads from the dashboard (the app limits files to 4MB; Vercel allows 4.5MB bodies)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
