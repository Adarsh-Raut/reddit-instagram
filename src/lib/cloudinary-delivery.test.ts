import { describe, expect, it } from "vitest";
import { deliveryUrl } from "./cloudinary-delivery";

const stored = "https://res.cloudinary.com/mycloud/image/upload/v1700000000/memes/abc123.jpg";

describe("deliveryUrl", () => {
  it("inserts format, quality and width right after /upload/, keeping the version and path", () => {
    expect(deliveryUrl(stored, 480)).toBe(
      "https://res.cloudinary.com/mycloud/image/upload/f_auto,q_auto,c_limit,w_480/v1700000000/memes/abc123.jpg",
    );
  });

  it("works for URLs without a version segment", () => {
    expect(deliveryUrl("https://res.cloudinary.com/demo/image/upload/sample.jpg", 96)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_96/sample.jpg",
    );
  });

  it("never upscales (c_limit) and rounds odd widths", () => {
    const url = deliveryUrl(stored, 479.6);
    expect(url).toContain("c_limit,w_480");
  });

  it("clamps absurd widths", () => {
    expect(deliveryUrl(stored, 99999)).toContain("w_2000");
    expect(deliveryUrl(stored, 0)).toContain("w_1");
  });

  it("leaves anything that isn't a Cloudinary https upload URL untouched", () => {
    for (const src of [
      "https://example.com/pic.jpg",
      "http://res.cloudinary.com/mycloud/image/upload/v1/x.jpg",
      "https://res.cloudinary.com/mycloud/video/upload/v1/x.mp4",
      "https://res.cloudinary.com/mycloud/image/fetch/https://example.com/x.jpg",
      "/local.png",
    ]) {
      expect(deliveryUrl(src, 480)).toBe(src);
    }
  });
});
