import { describe, expect, it } from "vitest";
import { hashPassword as scriptHash, upsertEnv } from "../../../scripts/admin-setup.mjs";
import { verifyPassword } from "./password";

describe("admin-setup script", () => {
  it("produces hashes the app can verify", () => {
    const h = scriptHash("a long enough password");
    expect(verifyPassword("a long enough password", h)).toBe(true);
    expect(verifyPassword("nope", h)).toBe(false);
  });

  it("upserts env lines without touching others", () => {
    expect(upsertEnv("A=1\n", "B", "2")).toBe("A=1\nB=2\n");
    expect(upsertEnv("A=1", "B", "2")).toBe("A=1\nB=2\n");
    expect(upsertEnv("A=1\nB=old\nC=3\n", "B", "new")).toBe("A=1\nB=new\nC=3\n");
    expect(upsertEnv("", "B", "x$y")).toBe("B=x$y\n");
  });
});
