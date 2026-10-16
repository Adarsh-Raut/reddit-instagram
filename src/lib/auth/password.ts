import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Format: scrypt:<saltHex>:<hashHex>. No "$" so Next's .env expansion leaves it alone.
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  return timingSafeEqual(actual, expected);
}
