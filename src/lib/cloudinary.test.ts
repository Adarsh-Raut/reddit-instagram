import { describe, expect, it } from "vitest";
import { instagramImageUrl } from "./cloudinary";

describe("instagramImageUrl", () => {
  const url = instagramImageUrl("memes/abc", "democloud");

  it("serves a JPEG from the configured cloud over https", () => {
    expect(url.startsWith("https://res.cloudinary.com/democloud/image/upload/")).toBe(true);
    expect(url).toContain("/memes/abc.jpg");
  });

  it("pads only images outside 4:5 to 1.91:1, each condition in its own URL segment", () => {
    expect(url).toContain("/if_ar_gt_1.91/ar_1.91,b_auto,c_pad/if_end/");
    expect(url).toContain("/if_ar_lt_0.8/ar_4:5,b_auto,c_pad/if_end/");
  });

  it("never joins a condition to its transformation with a comma (Cloudinary rejects that with a 400)", () => {
    expect(url).not.toMatch(/if_ar_[a-z]+_[\d.]+,/);
  });

  it("caps the width at 1080 without upscaling, after any padding", () => {
    expect(url).toContain("/c_limit,w_1080/");
    expect(url.indexOf("c_limit,w_1080")).toBeGreaterThan(url.indexOf("ar_4:5"));
  });

  it("does not force every image onto a 4:5 canvas", () => {
    // the old behaviour: an unconditional pad as the very first step
    expect(url).not.toContain("/upload/ar_4:5");
  });
});
