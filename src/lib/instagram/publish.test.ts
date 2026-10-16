import { describe, expect, it, vi } from "vitest";
import type { IgAccount, PublishClaim } from "@/db/queries";
import { publishScheduledPost, type PublishDeps } from "./publish";

const claim: PublishClaim = {
  scheduleId: "s1",
  postId: "p1",
  caption: "",
  post: {
    id: "p1", redditId: "r1", subreddit: "memes", title: "Lol", author: "bob", permalink: "x",
    cloudinaryUrl: "u", cloudinaryPublicId: "memes/r1", imageHash: null, status: "approved", scrapedAt: new Date(),
  },
};
const account: IgAccount = {
  id: "a", igUserId: "IG1", username: "me", encryptedToken: "enc",
  tokenExpiresAt: new Date("2030-01-01"), createdAt: new Date(),
};

function deps(over: Partial<PublishDeps> = {}): PublishDeps {
  return {
    claim: vi.fn().mockResolvedValue(claim),
    getAccount: vi.fn().mockResolvedValue(account),
    markPosted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    decryptToken: (e) => `dec(${e})`,
    imageUrl: (id) => `https://cdn/${id}.jpg`,
    publish: vi.fn().mockResolvedValue("MEDIA1"),
    now: () => new Date("2026-10-16"),
    record: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("publishScheduledPost", () => {
  it("publishes with decrypted token, jpg url and a credit caption, then records it", async () => {
    const d = deps();
    const r = await publishScheduledPost("s1", d);
    expect(r).toEqual({ ok: true, mediaId: "MEDIA1" });
    expect(d.publish).toHaveBeenCalledWith({
      igUserId: "IG1",
      token: "dec(enc)",
      imageUrl: "https://cdn/memes/r1.jpg",
      caption: "Lol\n\nCredit: u/bob on Reddit (r/memes)",
    });
    expect(d.markPosted).toHaveBeenCalledWith("s1", "p1", "MEDIA1");
    expect(d.markFailed).not.toHaveBeenCalled();
    expect(d.record).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info", kind: "publish.posted", meta: expect.objectContaining({ mediaId: "MEDIA1", redditId: "r1" }) }),
    );
  });

  it("uses a stored caption when present", async () => {
    const d = deps({ claim: vi.fn().mockResolvedValue({ ...claim, caption: "Custom" }) });
    await publishScheduledPost("s1", d);
    expect(vi.mocked(d.publish).mock.calls[0][0].caption).toBe("Custom");
  });

  it("does nothing if the post was already claimed", async () => {
    const d = deps({ claim: vi.fn().mockResolvedValue(null) });
    const r = await publishScheduledPost("s1", d);
    expect(r.ok).toBe(false);
    expect(d.publish).not.toHaveBeenCalled();
    expect(d.markFailed).not.toHaveBeenCalled();
    expect(d.record).not.toHaveBeenCalled();
  });

  it("fails cleanly when Instagram isn't connected", async () => {
    const d = deps({ getAccount: vi.fn().mockResolvedValue(null) });
    const r = await publishScheduledPost("s1", d);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/isn.t connected/) });
    expect(d.markFailed).toHaveBeenCalledWith("s1", expect.stringMatching(/connected/));
    expect(d.publish).not.toHaveBeenCalled();
  });

  it("fails without calling Instagram when the token has expired", async () => {
    const d = deps({ getAccount: vi.fn().mockResolvedValue({ ...account, tokenExpiresAt: new Date("2026-01-01") }) });
    const r = await publishScheduledPost("s1", d);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/expired/) });
    expect(d.publish).not.toHaveBeenCalled();
  });

  it("marks failed with Instagram's error so it can be retried", async () => {
    const d = deps({ publish: vi.fn().mockRejectedValue(new Error("Media URL unreachable")) });
    const r = await publishScheduledPost("s1", d);
    expect(r).toEqual({ ok: false, message: "Media URL unreachable" });
    expect(d.markFailed).toHaveBeenCalledWith("s1", "Media URL unreachable");
    expect(d.markPosted).not.toHaveBeenCalled();
    expect(d.record).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", kind: "publish.failed", message: expect.stringContaining("Media URL unreachable") }),
    );
    expect(d.record).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "publish.posted" }));
  });

  it("still reports success if recording the post fails after Instagram accepted it", async () => {
    const d = deps({ markPosted: vi.fn().mockRejectedValue(new Error("db down")) });
    const r = await publishScheduledPost("s1", d);
    expect(r).toEqual({ ok: true, mediaId: "MEDIA1" });
    expect(d.markFailed).not.toHaveBeenCalled(); // must not become retryable
    expect(d.record).toHaveBeenCalledWith(expect.objectContaining({ level: "error", kind: "publish.record_failed" }));
  });
});
