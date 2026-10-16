import { describe, expect, it, vi } from "vitest";
import type { IgAccount } from "@/db/queries";
import {
  MAX_LATE_MS,
  runPublishDue,
  runRefreshToken,
  shouldRefresh,
  type PublishJobDeps,
  type RefreshJobDeps,
} from "./jobs";

const NOW = new Date("2026-10-16T12:00:00Z");

function pubDeps(over: Partial<PublishJobDeps> = {}): PublishJobDeps {
  return {
    now: () => NOW,
    failMissed: vi.fn().mockResolvedValue(0),
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
    expect(d.listDue).toHaveBeenCalledWith(NOW, cutoff, 1);
  });

  it("publishes each due post and reports results", async () => {
    const d = pubDeps({ listDue: vi.fn().mockResolvedValue(["a"]), failMissed: vi.fn().mockResolvedValue(2) });
    expect(await runPublishDue(d)).toEqual({ missed: 2, results: [{ id: "a", ok: true }] });
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
    expect(await runPublishDue(d)).toEqual({ missed: 0, results: [] });
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
