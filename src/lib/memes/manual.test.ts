import { describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_BYTES, addManualMeme, isManual, sniffImage, sourceLabel, type ManualMemeDeps } from "./manual";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(10)]);

function deps(over: Partial<ManualMemeDeps> = {}): ManualMemeDeps {
  return {
    hashExists: vi.fn().mockResolvedValue(false),
    upload: vi.fn().mockImplementation(async (_uri: string, id: string) => ({ url: `https://res.cloudinary.com/x/${id}.jpg`, publicId: `memes/${id}` })),
    insert: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("sniffImage", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
  });

  it.each([
    ["GIF", Buffer.from("GIF89a....")],
    ["text", Buffer.from("hello world, not an image")],
    ["HTML disguised as an image", Buffer.from("<html><script>alert(1)</script></html>")],
    ["RIFF but not WebP (e.g. WAV)", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")])],
    ["empty", Buffer.alloc(0)],
    ["truncated", Buffer.from([0xff, 0xd8])],
  ])("rejects %s", (_n, bytes) => expect(sniffImage(bytes)).toBeNull());
});

describe("addManualMeme", () => {
  it("uploads and stores an approved manual post with the hash and cloudinary ids", async () => {
    const d = deps();
    const r = await addManualMeme({ bytes: JPEG, title: "  My meme  " }, d);
    expect(r.ok).toBe(true);
    const row = vi.mocked(d.insert).mock.calls[0][0];
    expect(row).toMatchObject({ subreddit: "manual", title: "My meme", author: null, permalink: "", status: "approved" });
    expect(row.redditId).toMatch(/^manual-[0-9a-f]{12}$/);
    expect(row.imageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.cloudinaryPublicId).toBe(`memes/${row.redditId}`);
    const [uri] = vi.mocked(d.upload).mock.calls[0];
    expect(uri.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("uses the sniffed type, not whatever the file claims", async () => {
    const d = deps();
    await addManualMeme({ bytes: PNG, title: "x" }, d);
    expect(vi.mocked(d.upload).mock.calls[0][0].startsWith("data:image/png;")).toBe(true);
  });

  it.each([
    ["empty title", { bytes: JPEG, title: "   " }, /title/],
    ["too-long title", { bytes: JPEG, title: "a".repeat(201) }, /title/],
    ["no file", { bytes: Buffer.alloc(0), title: "x" }, /Choose an image/],
    ["not an image", { bytes: Buffer.from("just text"), title: "x" }, /JPEG, PNG or WebP/],
    ["too big", { bytes: Buffer.concat([JPEG, Buffer.alloc(MAX_UPLOAD_BYTES)]), title: "x" }, /10 MB/],
  ])("rejects %s without touching Cloudinary or the database", async (_n, input, msg) => {
    const d = deps();
    const r = await addManualMeme(input, d);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(msg) });
    expect(d.upload).not.toHaveBeenCalled();
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("rejects an image that was already added, before uploading", async () => {
    const d = deps({ hashExists: vi.fn().mockResolvedValue(true) });
    const r = await addManualMeme({ bytes: JPEG, title: "x" }, d);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/already been added/) });
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("stores nothing if the upload fails", async () => {
    const d = deps({ upload: vi.fn().mockRejectedValue(new Error("cloudinary down")) });
    await expect(addManualMeme({ bytes: JPEG, title: "x" }, d)).rejects.toThrow("cloudinary down");
    expect(d.insert).not.toHaveBeenCalled();
  });
});

describe("labels", () => {
  it("labels uploads and scraped posts", () => {
    expect(isManual({ subreddit: "manual" })).toBe(true);
    expect(sourceLabel({ subreddit: "manual" })).toBe("Uploaded");
    expect(sourceLabel({ subreddit: "memes" })).toBe("r/memes");
  });
});
