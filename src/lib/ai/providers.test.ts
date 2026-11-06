import { describe, expect, it, vi } from "vitest";
import {
  AiProviderError,
  createGeminiProvider,
  createGroqProvider,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  providersFromEnv,
} from "./providers";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const IMG = { mime: "image/jpeg", base64: "QUJD" };

describe("gemini provider", () => {
  it("sends the key in a header (not the URL), asks for JSON, and attaches the image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: '{"caption":"hi there"}' }] } }] }));
    const p = createGeminiProvider({ apiKey: "KEY", fetch: fetchMock });
    expect(await p.complete({ prompt: "P", image: IMG })).toBe('{"caption":"hi there"}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    expect(url).not.toContain("KEY");
    expect(init.headers["x-goog-api-key"]).toBe("KEY");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.contents[0].parts).toEqual([{ text: "P" }, { inlineData: { mimeType: "image/jpeg", data: "QUJD" } }]);
  });
  it("sends text only without an image, and honours a model override", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: "x" }] } }] }));
    await createGeminiProvider({ apiKey: "K", model: "gemini-test", fetch: fetchMock }).complete({ prompt: "P", image: null });
    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-test:");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts).toEqual([{ text: "P" }]);
  });
  it("ignores thinking parts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: "hmm", thought: true }, { text: "answer" }] } }] }));
    expect(await createGeminiProvider({ apiKey: "K", fetch: fetchMock }).complete({ prompt: "P", image: null })).toBe("answer");
  });
  it("reports a rate limit with its status and never leaks the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("quota exceeded for key SECRET123", { status: 429 }));
    const err = await createGeminiProvider({ apiKey: "SECRET123", fetch: fetchMock }).complete({ prompt: "P", image: null }).catch((e) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.status).toBe(429);
    expect(err.message).not.toContain("SECRET123");
  });
  it("reports a blocked or empty reply, a network error and a timeout", async () => {
    const run = (fetchMock: typeof fetch) => createGeminiProvider({ apiKey: "K", fetch: fetchMock }).complete({ prompt: "P", image: null }).catch((e: Error) => e.message);
    expect(await run(vi.fn().mockResolvedValue(json({ promptFeedback: { blockReason: "SAFETY" } })))).toBe("Blocked: SAFETY");
    expect(await run(vi.fn().mockResolvedValue(json({ candidates: [] })))).toBe("Empty reply");
    expect(await run(vi.fn().mockRejectedValue(new TypeError("fetch failed")))).toBe("Couldn’t reach the service");
    expect(await run(vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })))).toBe("The request timed out");
  });
});

describe("groq provider", () => {
  it("uses the bearer key, JSON mode, and an image_url part when there is an image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: '{"caption":"yo"}' } }] }));
    const p = createGroqProvider({ apiKey: "GK", fetch: fetchMock });
    expect(await p.complete({ prompt: "P", image: IMG })).toBe('{"caption":"yo"}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer GK");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "P" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
    ]);
  });
  it("sends a plain string without an image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: "x" } }] }));
    await createGroqProvider({ apiKey: "GK", fetch: fetchMock }).complete({ prompt: "P", image: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toBe("P");
  });
  it("fails on HTTP errors and empty replies", async () => {
    const run = (f: typeof fetch) => createGroqProvider({ apiKey: "GK", fetch: f }).complete({ prompt: "P", image: null }).catch((e: Error) => e.message);
    expect(await run(vi.fn().mockResolvedValue(new Response("nope", { status: 401 })))).toBe("HTTP 401: nope");
    expect(await run(vi.fn().mockResolvedValue(json({ choices: [] })))).toBe("Empty reply");
  });
});

describe("providersFromEnv", () => {
  it("puts Gemini first, then Groq", () => {
    expect(providersFromEnv({ GEMINI_API_KEY: "a", GROQ_API_KEY: "b" }).map((p) => p.name)).toEqual(["gemini", "groq"]);
  });
  it("uses only the providers that have a key, and none without keys", () => {
    expect(providersFromEnv({ GROQ_API_KEY: "b" }).map((p) => p.name)).toEqual(["groq"]);
    expect(providersFromEnv({ GEMINI_API_KEY: "" })).toEqual([]);
  });
});
