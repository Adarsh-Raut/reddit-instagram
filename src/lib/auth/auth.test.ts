import { describe, expect, it } from "vitest";
import { decideAccess, isPublicPath } from "./access";
import { hashPassword, verifyPassword } from "./password";
import { createThrottle } from "./throttle";
import { signSession, verifySession } from "./token";

const SECRET = "x".repeat(40);
const NOW = new Date("2026-10-16T12:00:00Z");

describe("password", () => {
  it("verifies the right password and rejects wrong ones", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("", h)).toBe(false);
  });

  it("salts each hash and never contains '$' or the password", () => {
    const a = hashPassword("pw");
    expect(a).not.toBe(hashPassword("pw"));
    expect(a).not.toContain("$");
    expect(a).not.toContain("pw");
  });

  it.each([undefined, "", "garbage", "scrypt:zz", "bcrypt:aa:bb", "scrypt:aa:bb"])("rejects malformed stored value %j", (stored) => {
    expect(verifyPassword("pw", stored)).toBe(false);
  });
});

describe("session token", () => {
  it("accepts a fresh token", () => {
    expect(verifySession(signSession(SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it("rejects expired tokens", () => {
    const t = signSession(SECRET, NOW, 60);
    expect(verifySession(t, SECRET, new Date(NOW.getTime() + 61_000))).toBe(false);
    expect(verifySession(t, SECRET, new Date(NOW.getTime() + 59_000))).toBe(true);
  });

  it("rejects a different secret, tampering and malformed tokens", () => {
    const t = signSession(SECRET, NOW);
    expect(verifySession(t, "y".repeat(40), NOW)).toBe(false);
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET, NOW)).toBe(false);
    expect(verifySession(`${payload}.`, SECRET, NOW)).toBe(false);
    expect(verifySession(`${t}.extra`, SECRET, NOW)).toBe(false);
    for (const bad of [undefined, "", "abc", "a.b"]) expect(verifySession(bad, SECRET, NOW)).toBe(false);
  });

  it("fails closed with a missing or short secret", () => {
    const t = signSession(SECRET, NOW);
    expect(verifySession(t, undefined, NOW)).toBe(false);
    expect(verifySession(t, "short", NOW)).toBe(false);
  });
});

describe("decideAccess", () => {
  const good = signSession(SECRET, NOW);
  it("lets public paths through without a session", () => {
    for (const p of ["/login", "/api/inngest"]) expect(decideAccess(p, undefined, SECRET, NOW)).toBe("allow");
  });

  it("requires a valid session everywhere else", () => {
    for (const p of ["/", "/schedule", "/settings", "/api/instagram/connect", "/api/instagram/callback"]) {
      expect(decideAccess(p, undefined, SECRET, NOW)).toBe("login");
      expect(decideAccess(p, "bad", SECRET, NOW)).toBe("login");
      expect(decideAccess(p, good, SECRET, NOW)).toBe("allow");
    }
  });

  it("doesn't treat look-alike paths as public", () => {
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/api/inngestx")).toBe(false);
    expect(isPublicPath("/login/anything")).toBe(true);
  });

  it("locks everything when the secret is not configured", () => {
    expect(decideAccess("/", good, undefined, NOW)).toBe("login");
  });
});

describe("throttle", () => {
  it("blocks after max failures within the window and recovers", () => {
    const t = createThrottle(3, 1000);
    for (let i = 0; i < 3; i++) t.recordFailure("ip", 0);
    expect(t.isBlocked("ip", 500)).toBe(true);
    expect(t.isBlocked("other", 500)).toBe(false);
    expect(t.isBlocked("ip", 1500)).toBe(false);
  });

  it("reset clears failures", () => {
    const t = createThrottle(1, 1000);
    t.recordFailure("ip", 0);
    t.reset("ip");
    expect(t.isBlocked("ip", 1)).toBe(false);
  });
});
