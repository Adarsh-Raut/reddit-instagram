import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = [
  "DATABASE_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "REDDIT_USER_AGENT",
];

describe("getEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws and names the missing variables", async () => {
    for (const k of KEYS) vi.stubEnv(k, "");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });

  it("returns parsed env when all variables are set", async () => {
    for (const k of KEYS) vi.stubEnv(k, "x");
    const { getEnv } = await import("./env");
    expect(getEnv().CLOUDINARY_CLOUD_NAME).toBe("x");
  });
});
