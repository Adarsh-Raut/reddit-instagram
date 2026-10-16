import { verifySession } from "./token";

/** Routes reachable without a session. Inngest authenticates itself with its signing key. */
const PUBLIC_PREFIXES = ["/login", "/api/inngest"];

export function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pure decision used by proxy.ts: fails closed when the secret is missing. */
export function decideAccess(
  pathname: string,
  token: string | undefined,
  secret: string | undefined,
  now: Date = new Date(),
): "allow" | "login" {
  if (isPublicPath(pathname)) return "allow";
  return verifySession(token, secret, now) ? "allow" : "login";
}
