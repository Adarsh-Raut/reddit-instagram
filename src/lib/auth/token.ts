import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function mac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}

/** Signed, expiring session token: base64url({exp}).base64url(hmac). */
export function signSession(secret: string, now: Date = new Date(), ttlSeconds = SESSION_TTL_SECONDS): string {
  const payload = b64(JSON.stringify({ exp: Math.floor(now.getTime() / 1000) + ttlSeconds }));
  return `${payload}.${b64(mac(payload, secret))}`;
}

export function verifySession(token: string | undefined, secret: string | undefined, now: Date = new Date()): boolean {
  if (!token || !secret || secret.length < 32) return false;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return false;
  const given = Buffer.from(sig, "base64url");
  const expected = mac(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof exp === "number" && exp > now.getTime() / 1000;
  } catch {
    return false;
  }
}
