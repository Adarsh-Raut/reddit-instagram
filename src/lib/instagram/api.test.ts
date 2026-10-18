import { describe, expect, it, vi } from "vitest";
import {
  buildAuthUrl,
  buildCaption,
  exchangeCode,
  getProfile,
  publishImage,
  refreshLongLived,
  toLongLived,
  waitForContainer,
} from "./api";

const cfg = { appId: "app", appSecret: "sec", redirectUri: "https://x.test/cb" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("auth", () => {
  it("builds the authorize URL with publish scope and state", () => {
    const u = new URL(buildAuthUrl(cfg, "st8"));
    expect(u.origin + u.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(u.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
    expect(u.searchParams.get("state")).toBe("st8");
    expect(u.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
  });

  it.each([
    ["flat", { access_token: "t", user_id: 1 }],
    ["data array", { data: [{ access_token: "t", user_id: 1 }] }],
  ])("exchanges a code (%s response)", async (_n, body) => {
    const fetchFn = vi.fn().mockResolvedValue(json(body));
    const r = await exchangeCode(cfg, "abc#_", fetchFn);
    expect(r).toEqual({ accessToken: "t", userId: "1" });
    const sent = fetchFn.mock.calls[0][1].body as URLSearchParams;
    expect(sent.get("code")).toBe("abc"); // trailing #_ stripped
    expect(sent.get("grant_type")).toBe("authorization_code");
  });

  it("surfaces Instagram's error message", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error_message: "Invalid code" }, 400));
    await expect(exchangeCode(cfg, "x", fetchFn)).rejects.toThrow(/Invalid code/);
  });

  it("gets and refreshes long-lived tokens", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => json({ access_token: "L", expires_in: 5183944 }));
    expect(await toLongLived(cfg, "short", fetchFn)).toEqual({ accessToken: "L", expiresInSeconds: 5183944 });
    expect(String(fetchFn.mock.calls[0][0])).toContain("grant_type=ig_exchange_token");
    await refreshLongLived("L", fetchFn);
    expect(String(fetchFn.mock.calls[1][0])).toContain("grant_type=ig_refresh_token");
  });

  it("reads the profile id and username", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ user_id: "17841", username: "memes" }));
    expect(await getProfile({}, "t", fetchFn)).toEqual({ userId: "17841", username: "memes" });
  });
});

describe("publishing", () => {
  const noSleep = async () => {};

  it("creates a container, waits for FINISHED, then publishes", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "C1" })) // create
      .mockResolvedValueOnce(json({ status_code: "IN_PROGRESS" }))
      .mockResolvedValueOnce(json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(json({ id: "M1" })); // publish
    const id = await publishImage(
      { apiVersion: "v23.0" },
      { igUserId: "U", token: "T", imageUrl: "https://img/x.jpg", caption: "hi" },
      { fetchFn, sleep: noSleep },
    );
    expect(id).toBe("M1");
    const [createUrl, createInit] = fetchFn.mock.calls[0];
    expect(createUrl).toBe("https://graph.instagram.com/v23.0/U/media");
    expect((createInit.body as URLSearchParams).get("image_url")).toBe("https://img/x.jpg");
    expect(createInit.headers.Authorization).toBe("Bearer T");
    expect(fetchFn.mock.calls[3][0]).toBe("https://graph.instagram.com/v23.0/U/media_publish");
  });

  it("never publishes when the container errors", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ id: "C1" }))
      .mockResolvedValueOnce(json({ status_code: "ERROR" }));
    await expect(
      publishImage({}, { igUserId: "U", token: "T", imageUrl: "u", caption: "" }, { fetchFn, sleep: noSleep }),
    ).rejects.toThrow(/ERROR/);
    expect(fetchFn).toHaveBeenCalledTimes(2); // no media_publish call
  });

  it("times out if the container never finishes", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => json({ status_code: "IN_PROGRESS" }));
    await expect(waitForContainer({}, "C", "T", { fetchFn, attempts: 3, sleep: noSleep })).rejects.toThrow(/still processing/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("propagates API errors from container creation", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: { message: "Media URL unreachable" } }, 400));
    await expect(
      publishImage({}, { igUserId: "U", token: "T", imageUrl: "u", caption: "" }, { fetchFn, sleep: noSleep }),
    ).rejects.toThrow(/Media URL unreachable/);
  });
});

describe("buildCaption", () => {
  it("credits the author", () => {
    expect(buildCaption({ title: "Lol", author: "bob", subreddit: "memes" })).toBe(
      "Lol\n\nCredit: u/bob on Reddit (r/memes)",
    );
  });
  it("falls back to the subreddit when the author is unknown", () => {
    expect(buildCaption({ title: "Lol", author: null, subreddit: "memes" })).toContain("r/memes");
  });

  it("uses just the title for memes the admin uploaded", () => {
    expect(buildCaption({ title: "My own meme", author: null, subreddit: "manual" })).toBe("My own meme");
  });
});
