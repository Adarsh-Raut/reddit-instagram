import { z } from "zod";
import { getLogger } from "@/lib/log";

const log = getLogger("instagram");

type FetchFn = typeof fetch;

export type IgConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  /** e.g. "v23.0"; empty means unversioned (the app's default version). */
  apiVersion?: string;
};

export const IG_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

const GRAPH = "https://graph.instagram.com";

function graph(cfg: Pick<IgConfig, "apiVersion">, path: string) {
  return `${GRAPH}${cfg.apiVersion ? `/${cfg.apiVersion}` : ""}${path}`;
}

async function parse<T extends z.ZodType>(res: Response, schema: T, what: string): Promise<z.infer<T>> {
  const body: unknown = await res.json().catch(() => null);
  log.debug({ what, status: res.status }, "instagram response");
  if (!res.ok) {
    const err = z
      .object({ error: z.object({ message: z.string() }).optional(), error_message: z.string().optional() })
      .safeParse(body);
    const msg = (err.success && (err.data.error?.message ?? err.data.error_message)) || `HTTP ${res.status}`;
    throw new Error(`Instagram ${what} failed: ${msg}`);
  }
  const ok = schema.safeParse(body);
  if (!ok.success) throw new Error(`Instagram ${what} returned an unexpected response`);
  return ok.data;
}

export function buildAuthUrl(cfg: IgConfig, state: string) {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", cfg.appId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

const shortToken = z.union([
  z.object({ access_token: z.string(), user_id: z.union([z.string(), z.number()]) }),
  z.object({ data: z.array(z.object({ access_token: z.string(), user_id: z.union([z.string(), z.number()]) })).min(1) }),
]);

/** Exchange the OAuth code for a short-lived (1h) token. */
export async function exchangeCode(cfg: IgConfig, code: string, fetchFn: FetchFn = fetch) {
  const res = await fetchFn("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      grant_type: "authorization_code",
      redirect_uri: cfg.redirectUri,
      code: code.replace(/#_$/, ""),
    }),
  });
  const body = await parse(res, shortToken, "code exchange");
  const t = "data" in body ? body.data[0] : body;
  return { accessToken: t.access_token, userId: String(t.user_id) };
}

const longToken = z.object({ access_token: z.string(), expires_in: z.number() });

export async function toLongLived(cfg: IgConfig, shortLived: string, fetchFn: FetchFn = fetch) {
  const u = new URL(`${GRAPH}/access_token`);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", cfg.appSecret);
  u.searchParams.set("access_token", shortLived);
  const body = await parse(await fetchFn(u), longToken, "long-lived token exchange");
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}

export async function refreshLongLived(token: string, fetchFn: FetchFn = fetch) {
  const u = new URL(`${GRAPH}/refresh_access_token`);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", token);
  const body = await parse(await fetchFn(u), longToken, "token refresh");
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}

const profile = z.object({ user_id: z.union([z.string(), z.number()]).optional(), id: z.union([z.string(), z.number()]).optional(), username: z.string().optional() });

export async function getProfile(cfg: Pick<IgConfig, "apiVersion">, token: string, fetchFn: FetchFn = fetch) {
  const u = new URL(graph(cfg, "/me"));
  u.searchParams.set("fields", "user_id,username");
  const res = await fetchFn(u, { headers: { Authorization: `Bearer ${token}` } });
  const body = await parse(res, profile, "profile lookup");
  const id = body.user_id ?? body.id;
  if (id === undefined) throw new Error("Instagram profile lookup returned no user id");
  return { userId: String(id), username: body.username ?? null };
}

const idOnly = z.object({ id: z.string() });

export async function createImageContainer(
  cfg: Pick<IgConfig, "apiVersion">,
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string,
  fetchFn: FetchFn = fetch,
) {
  const res = await fetchFn(graph(cfg, `/${igUserId}/media`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: new URLSearchParams({ image_url: imageUrl, caption }),
  });
  return (await parse(res, idOnly, "media container creation")).id;
}

const status = z.object({ status_code: z.string() });

/** Poll until the container is FINISHED. Throws on ERROR/EXPIRED or timeout. */
export async function waitForContainer(
  cfg: Pick<IgConfig, "apiVersion">,
  containerId: string,
  token: string,
  opts: { fetchFn?: FetchFn; attempts?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
) {
  const { fetchFn = fetch, attempts = 10, intervalMs = 3000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  for (let i = 0; i < attempts; i++) {
    const u = new URL(graph(cfg, `/${containerId}`));
    u.searchParams.set("fields", "status_code");
    const res = await fetchFn(u, { headers: { Authorization: `Bearer ${token}` } });
    const { status_code } = await parse(res, status, "container status");
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram could not process the image (${status_code})`);
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  throw new Error("Instagram is still processing the image; try again shortly");
}

export async function publishContainer(
  cfg: Pick<IgConfig, "apiVersion">,
  igUserId: string,
  containerId: string,
  token: string,
  fetchFn: FetchFn = fetch,
) {
  const res = await fetchFn(graph(cfg, `/${igUserId}/media_publish`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: new URLSearchParams({ creation_id: containerId }),
  });
  return (await parse(res, idOnly, "publish")).id;
}

/** Full flow: create container → wait until ready → publish. Returns the media id. */
export async function publishImage(
  cfg: Pick<IgConfig, "apiVersion">,
  args: { igUserId: string; token: string; imageUrl: string; caption: string },
  opts: Parameters<typeof waitForContainer>[3] = {},
) {
  const containerId = await createImageContainer(cfg, args.igUserId, args.token, args.imageUrl, args.caption, opts.fetchFn);
  await waitForContainer(cfg, containerId, args.token, opts);
  return publishContainer(cfg, args.igUserId, containerId, args.token, opts.fetchFn);
}

/** Caption with credit to the original poster. AI captions will replace this later. */
export function buildCaption(post: { title: string; author: string | null; subreddit: string }) {
  const credit = post.author
    ? `Credit: u/${post.author} on Reddit (r/${post.subreddit})`
    : `Source: r/${post.subreddit} on Reddit`;
  return `${post.title}\n\n${credit}`;
}
