import { describe, expect, it, vi } from "vitest";
import type { IgAccount } from "@/db/queries";
import {
  MAX_LATE_MS,
  REJECTED_IMAGE_TTL_MS,
  STUCK_AFTER_MS,
  runAutoScrape,
  runImageCleanup,
  runPublishDue,
  runRefreshToken,
  shouldRefresh,
  type CleanupJobDeps,
  type PublishJobDeps,
  type ScrapeJobDeps,
  type RefreshJobDeps,
} from "./jobs";

const NOW = new Date("2026-10-16T12:00:00Z");

function pubDeps(over: Partial<PublishJobDeps> = {}): PublishJobDeps {
  return {
    now: () => NOW,
    failMissed: vi.fn().mockResolvedValue(0),
    failStuck: vi.fn().mockResolvedValue(0),
    listDue: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue({ ok: true, mediaId: "M" }),
    ...over,
  };
}

describe("runPublishDue", () => {
  it("fails stale posts first, then looks for due ones within the lateness window", async () => {
    const d = pubDeps();
    await runPublishDue(d);
    const cutoff = new Date(NOW.getTime() - MAX_LATE_MS);
    expect(d.failMissed).toHaveBeenCalledWith(cutoff);
    expect(d.failStuck).toHaveBeenCalledWith(new Date(NOW.getTime() - STUCK_AFTER_MS));
    expect(d.listDue).toHaveBeenCalledWith(NOW, cutoff, 1);
  });

  it("publishes each due post and reports results", async () => {
    const d = pubDeps({ listDue: vi.fn().mockResolvedValue(["a"]), failMissed: vi.fn().mockResolvedValue(2) });
    expect(await runPublishDue(d)).toEqual({ stuck: 0, missed: 2, results: [{ id: "a", ok: true }] });
    expect(d.publish).toHaveBeenCalledWith("a");
  });

  it("reports a failed publish without throwing (so Inngest doesn't retry and double post)", async () => {
    const d = pubDeps({
      listDue: vi.fn().mockResolvedValue(["a"]),
      publish: vi.fn().mockResolvedValue({ ok: false, message: "nope" }),
    });
    expect((await runPublishDue(d)).results).toEqual([{ id: "a", ok: false, message: "nope" }]);
  });

  it("does nothing when nothing is due", async () => {
    const d = pubDeps();
    expect(await runPublishDue(d)).toEqual({ stuck: 0, missed: 0, results: [] });
    expect(d.publish).not.toHaveBeenCalled();
  });
});

const account = (expiresInDays: number): IgAccount => ({
  id: "a",
  igUserId: "IG1",
  username: "me",
  encryptedToken: "enc",
  tokenExpiresAt: new Date(NOW.getTime() + expiresInDays * 86_400_000 + 3_600_000),
  createdAt: NOW,
});

describe("shouldRefresh", () => {
  it.each([
    [60, false],
    [16, false],
    [14, true],
    [1, true],
    [-1, false],
  ])("%i days left -> %s", (days, expected) => {
    expect(shouldRefresh(account(days), NOW)).toBe(expected);
  });
});

function refDeps(acc: IgAccount | null, over: Partial<RefreshJobDeps> = {}): RefreshJobDeps {
  return {
    now: () => NOW,
    getAccount: vi.fn().mockResolvedValue(acc),
    refresh: vi.fn().mockResolvedValue({ accessToken: "NEW", expiresInSeconds: 5_184_000 }),
    save: vi.fn().mockResolvedValue(undefined),
    decryptToken: (e) => `dec(${e})`,
    encryptToken: (p) => `enc(${p})`,
    ...over,
  };
}

describe("runRefreshToken", () => {
  it("refreshes a token that is close to expiry and stores the new encrypted token", async () => {
    const d = refDeps(account(10));
    expect(await runRefreshToken(d)).toBe("refreshed");
    expect(d.refresh).toHaveBeenCalledWith("dec(enc)");
    expect(d.save).toHaveBeenCalledWith({
      igUserId: "IG1",
      username: "me",
      encryptedToken: "enc(NEW)",
      tokenExpiresAt: new Date(NOW.getTime() + 5_184_000_000),
    });
  });

  it("leaves a healthy token alone", async () => {
    const d = refDeps(account(40));
    expect(await runRefreshToken(d)).toBe("not-needed");
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("reports no account and expired tokens without calling Instagram", async () => {
    expect(await runRefreshToken(refDeps(null))).toBe("no-account");
    const d = refDeps(account(-3));
    expect(await runRefreshToken(d)).toBe("expired");
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("throws when Instagram rejects the refresh and keeps the old token", async () => {
    const d = refDeps(account(5), { refresh: vi.fn().mockRejectedValue(new Error("bad token")) });
    await expect(runRefreshToken(d)).rejects.toThrow("bad token");
    expect(d.save).not.toHaveBeenCalled();
  });
});

describe("runAutoScrape", () => {
  const result = (over = {}) => ({ added: 5, skippedDuplicates: 2, errors: [] as string[], ...over });
  const deps = (autoScrape: boolean, scrape = vi.fn().mockResolvedValue(result())): ScrapeJobDeps => ({
    getSettings: async () => ({ autoScrape }),
    scrape,
  });

  it("skips when auto-scrape is off, without touching Reddit", async () => {
    const d = deps(false);
    expect(await runAutoScrape(d)).toEqual({ skipped: true });
    expect(d.scrape).not.toHaveBeenCalled();
  });

  it("scrapes when on and reports counts", async () => {
    expect(await runAutoScrape(deps(true))).toEqual({ skipped: false, added: 5, duplicates: 2, errors: 0 });
  });

  it("does not throw on a partial failure (no pointless retry)", async () => {
    const d = deps(true, vi.fn().mockResolvedValue(result({ added: 3, errors: ["r/x 403"] })));
    expect((await runAutoScrape(d)) as { added: number }).toMatchObject({ added: 3, errors: 1 });
  });

  it("throws when nothing was added and there were errors, so Inngest retries", async () => {
    const d = deps(true, vi.fn().mockResolvedValue(result({ added: 0, errors: ["Reddit auth failed: 401"] })));
    await expect(runAutoScrape(d)).rejects.toThrow(/401/);
  });

  it("does not throw when nothing new was found and nothing failed", async () => {
    const d = deps(true, vi.fn().mockResolvedValue(result({ added: 0 })));
    await expect(runAutoScrape(d)).resolves.toMatchObject({ added: 0 });
  });
});

describe("runImageCleanup", () => {
  const mk = (over: Partial<CleanupJobDeps> = {}): CleanupJobDeps => ({
    now: () => NOW,
    listStale: vi.fn().mockResolvedValue([
      { id: "1", publicId: "memes/a" },
      { id: "2", publicId: "memes/b" },
    ]),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...over,
  });

  it("deletes each stale image and clears the row, using the TTL cutoff", async () => {
    const d = mk();
    expect(await runImageCleanup(d)).toEqual({ deleted: 2, errors: [] });
    expect(d.listStale).toHaveBeenCalledWith(new Date(NOW.getTime() - REJECTED_IMAGE_TTL_MS), 100);
    expect(d.clear).toHaveBeenCalledTimes(2);
  });

  it("keeps the row (does not clear) when Cloudinary deletion fails, and carries on", async () => {
    const del = vi.fn().mockRejectedValueOnce(new Error("rate limited")).mockResolvedValue(undefined);
    const d = mk({ deleteImage: del });
    const r = await runImageCleanup(d);
    expect(r.deleted).toBe(1);
    expect(r.errors[0]).toMatch(/memes\/a: rate limited/);
    expect(d.clear).toHaveBeenCalledTimes(1);
    expect(d.clear).toHaveBeenCalledWith("2");
  });
});
