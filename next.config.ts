import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  // pino loads files at runtime, so keep it out of the bundle
  serverExternalPackages: ["pino", "pino-pretty"],
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
