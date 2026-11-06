import { describe, expect, it, vi } from "vitest";
import { generateCaption, loadImage } from "./generate";
import { AiProviderError, type CaptionProvider } from "./providers";

const post = { title: "Cat vs Monday", author: "cat_person", subreddit: "memes" };
const GOOD = '{"caption":"Mondays are unpurr-acceptable","hashtags":["cats","monday"]}';
const provider = (name: CaptionProvider["name"], impl: CaptionProvider["complete"]): CaptionProvider => ({ name, complete: vi.fn(impl) });

describe("generateCaption fallback chain", () => {
  it("uses the first provider and never calls the second when it works", async () => {
    const gemini = provider("gemini", async () => GOOD);
    const groq = provider("groq", async () => GOOD);
    const r = await generateCaption([gemini, groq], post, null);
    expect(r).toMatchObject({ ok: true, provider: "gemini", failures: [] });
    expect(groq.complete).not.toHaveBeenCalled();
  });
  it("falls back to Groq when Gemini is rate limited, and says why", async () => {
    const gemini = provider("gemini", async () => {
      throw new AiProviderError("HTTP 429: quota", 429);
    });
    const groq = provider("groq", async () => GOOD);
    const r = await generateCaption([gemini, groq], post, null);
    expect(r).toMatchObject({ ok: true, provider: "groq" });
    expect(r.failures).toEqual(["gemini: HTTP 429: quota"]);
  });
  it("falls back when a reply is not usable", async () => {
    const r = await generateCaption([provider("gemini", async () => "sorry, I can't"), provider("groq", async () => GOOD)], post, null);
    expect(r).toMatchObject({ ok: true, provider: "groq", failures: ["gemini: reply was not usable"] });
  });
  it("returns ok:false with every reason when all providers fail, and never throws", async () => {
    const boom = (m: string) => async () => {
      throw new Error(m);
    };
    const r = await generateCaption([provider("gemini", boom("a")), provider("groq", boom("b"))], post, null);
    expect(r).toEqual({ ok: false, failures: ["gemini: a", "groq: b"] });
  });
  it("returns ok:false with no providers", async () => {
    expect(await generateCaption([], post, null)).toEqual({ ok: false, failures: [] });
  });
  it("passes the same prompt and image to each provider, composing the final caption with credit and tags", async () => {
    const image = { mime: "image/png", base64: "QQ==" };
    const gemini = provider("gemini", async () => GOOD);
    const r = await generateCaption([gemini], post, image);
    expect(gemini.complete).toHaveBeenCalledWith({ prompt: expect.stringContaining("attached meme"), image });
    expect(r.ok && r.caption).toBe("Mondays are unpurr-acceptable\n\nCredit: u/cat_person on Reddit (r/memes)\n\n#cats #monday");
  });
});

describe("loadImage", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const res = (type: string, body: Uint8Array = bytes, status = 200) => new Response(body as BodyInit, { status, headers: { "content-type": type } });
  it("returns the mime type and base64 of an image", async () => {
    expect(await loadImage("https://x/y.jpg", vi.fn().mockResolvedValue(res("image/jpeg; charset=x")))).toEqual({ mime: "image/jpeg", base64: "AQID" });
  });
  it.each([
    ["a non-image type", () => res("text/html")],
    ["an HTTP error", () => res("image/jpeg", bytes, 404)],
    ["an empty body", () => res("image/jpeg", new Uint8Array())],
    ["a file over 4 MB", () => res("image/jpeg", new Uint8Array(4 * 1024 * 1024 + 1))],
  ])("returns null for %s", async (_n, make) => {
    expect(await loadImage("https://x/y", vi.fn().mockResolvedValue(make()))).toBeNull();
  });
  it("returns null when the download fails", async () => {
    expect(await loadImage("https://x/y", vi.fn().mockRejectedValue(new Error("down")))).toBeNull();
  });
});
