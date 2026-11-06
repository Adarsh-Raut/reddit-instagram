// Gemini and Groq clients. `fetch` is injected so tests never touch the network.

export type CaptionImage = { mime: string; base64: string };
export type CaptionRequest = { prompt: string; image: CaptionImage | null };

export type CaptionProvider = {
  name: "gemini" | "groq";
  /** Returns the model's raw text reply; throws AiProviderError on any failure. */
  complete: (req: CaptionRequest) => Promise<string>;
};

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

type FetchLike = typeof fetch;
const TIMEOUT_MS = 20_000;

// Defaults checked against the live model lists on 2026-11-06; override with GEMINI_MODEL / GROQ_MODEL
// if Google or Groq retire them (the old gemini-2.5-flash already answers 404 for new keys).
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

async function post(fetchFn: FetchLike, url: string, init: RequestInit, secret: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new AiProviderError(timedOut ? "The request timed out" : "Couldn’t reach the service");
  }
  if (!res.ok) {
    // the body can echo request details; keep a short, secret-free hint only
    const body = (await res.text().catch(() => "")).replaceAll(secret, "***").replace(/\s+/g, " ").slice(0, 160);
    throw new AiProviderError(`HTTP ${res.status}${body ? `: ${body}` : ""}`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new AiProviderError("Unreadable response");
  }
}

export function createGeminiProvider(opts: { apiKey: string; model?: string; fetch?: FetchLike }): CaptionProvider {
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const fetchFn = opts.fetch ?? fetch;
  return {
    name: "gemini",
    async complete({ prompt, image }) {
      const parts: unknown[] = [{ text: prompt }];
      if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } });
      const data = (await post(
        fetchFn,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseMimeType: "application/json", temperature: 1, maxOutputTokens: 400 },
          }),
        },
        opts.apiKey,
      )) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; promptFeedback?: { blockReason?: string } };
      const text = data.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("");
      if (!text) throw new AiProviderError(data.promptFeedback?.blockReason ? `Blocked: ${data.promptFeedback.blockReason}` : "Empty reply");
      return text;
    },
  };
}

export function createGroqProvider(opts: { apiKey: string; model?: string; fetch?: FetchLike }): CaptionProvider {
  const model = opts.model || DEFAULT_GROQ_MODEL;
  const fetchFn = opts.fetch ?? fetch;
  return {
    name: "groq",
    async complete({ prompt, image }) {
      const content = image
        ? [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } },
          ]
        : prompt;
      const data = (await post(
        fetchFn,
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content }],
            response_format: { type: "json_object" },
            temperature: 1,
            max_tokens: 400,
          }),
        },
        opts.apiKey,
      )) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new AiProviderError("Empty reply");
      return text;
    },
  };
}

/** Providers in priority order, built from the environment. Empty when no key is set. */
export function providersFromEnv(env: Record<string, string | undefined> = process.env, fetchFn?: FetchLike): CaptionProvider[] {
  const out: CaptionProvider[] = [];
  if (env.GEMINI_API_KEY) out.push(createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, fetch: fetchFn }));
  if (env.GROQ_API_KEY) out.push(createGroqProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, fetch: fetchFn }));
  return out;
}
