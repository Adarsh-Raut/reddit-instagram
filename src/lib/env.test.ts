import { afterEach, describe, expect, it, vi } from "vitest";
import { getCloudinaryEnv, getRedditEnv } from "./env";

const CLOUDINARY = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
const REDDIT = ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"];

afterEach(() => vi.unstubAllEnvs());

describe("integration env", () => {
  it("names the integration and the missing variables", () => {
    for (const k of [...CLOUDINARY, ...REDDIT]) vi.stubEnv(k, "");
    expect(() => getCloudinaryEnv()).toThrow(/Cloudinary isn.t configured.*CLOUDINARY_CLOUD_NAME/);
    expect(() => getRedditEnv()).toThrow(/Reddit isn.t configured.*REDDIT_CLIENT_ID/);
  });

  it("Cloudinary works without any Reddit variables (uploads must not need Reddit)", () => {
    for (const k of REDDIT) vi.stubEnv(k, "");
    for (const k of CLOUDINARY) vi.stubEnv(k, "x");
    expect(getCloudinaryEnv().CLOUDINARY_CLOUD_NAME).toBe("x");
    expect(() => getRedditEnv()).toThrow();
  });

  it("Reddit works without Cloudinary variables", () => {
    for (const k of CLOUDINARY) vi.stubEnv(k, "");
    for (const k of REDDIT) vi.stubEnv(k, "y");
    expect(getRedditEnv().REDDIT_USER_AGENT).toBe("y");
  });

  it("reports only what is actually missing", () => {
    for (const k of CLOUDINARY) vi.stubEnv(k, "x");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    expect(() => getCloudinaryEnv()).toThrow(/CLOUDINARY_API_SECRET$/);
  });
});
