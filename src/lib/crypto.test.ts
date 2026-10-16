import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "./crypto";

beforeEach(() => vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

describe("crypto", () => {
  it("round-trips and does not leak the plaintext", () => {
    const enc = encrypt("IGAAtoken123");
    expect(enc).not.toContain("IGAAtoken123");
    expect(decrypt(enc)).toBe("IGAAtoken123");
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("detects tampering", () => {
    const buf = Buffer.from(encrypt("secret"), "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("fails with a different key", () => {
    const enc = encrypt("secret");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    expect(() => decrypt(enc)).toThrow();
  });

  it("rejects a missing or wrong-sized key", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encrypt("x")).toThrow(/not set/);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.from("short").toString("base64"));
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });
});
