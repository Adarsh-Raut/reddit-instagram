import type { IgConfig } from "./api";

/** Returns null when the Instagram app isn't configured, so the UI can say so. */
export function getIgConfig(): IgConfig | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) return null;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    appId,
    appSecret,
    redirectUri: `${appUrl}/api/instagram/callback`,
    apiVersion: process.env.INSTAGRAM_API_VERSION || undefined,
  };
}
