import { describe, expect, it, vi } from "vitest";
import { recordActivity } from "./activity";

describe("recordActivity", () => {
  it("stores the event with secrets redacted from meta", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    await recordActivity(
      { level: "info", kind: "test.event", message: "hello", meta: { postId: "p1", access_token: "SECRET" } },
      insert,
    );
    expect(insert).toHaveBeenCalledWith({
      level: "info",
      kind: "test.event",
      message: "hello",
      meta: { postId: "p1", access_token: "[Redacted]" },
    });
  });

  it("never throws when the database write fails", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(recordActivity({ level: "error", kind: "x", message: "m" }, insert)).resolves.toBeUndefined();
  });

  it("truncates very long messages", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    await recordActivity({ level: "warn", kind: "x", message: "a".repeat(2000) }, insert);
    expect(insert.mock.calls[0][0].message).toHaveLength(500);
  });

  it("works without meta", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    await recordActivity({ level: "info", kind: "x", message: "m" }, insert);
    expect(insert.mock.calls[0][0].meta).toBeUndefined();
  });
});
