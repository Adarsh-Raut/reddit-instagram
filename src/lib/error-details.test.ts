import { describe, expect, it } from "vitest";
import { describeError, formatErrorDetails } from "./error-details";

const now = new Date("2030-01-02T03:04:05.000Z");

describe("describeError", () => {
  it("reads the message and digest from an Error", () => {
    const err = Object.assign(new Error("Failed to load posts"), { digest: "abc123" });
    expect(describeError(err, "/schedule", now)).toEqual({
      reference: "abc123",
      message: "Failed to load posts",
      route: "/schedule",
      time: "2030-01-02T03:04:05.000Z",
    });
  });

  it("has no reference for a client-side error without a digest", () => {
    expect(describeError(new Error("boom"), "/", now).reference).toBeNull();
  });

  it("copes with values that aren't Errors", () => {
    expect(describeError("plain text", "/", now).message).toBe("plain text");
    expect(describeError(undefined, "/", now).message).toBe("Unknown error");
    expect(describeError({ digest: 42 }, "/", now)).toMatchObject({ reference: null, message: "Unknown error" });
    expect(describeError(null, "/", now).message).toBe("Unknown error");
  });

  it("truncates very long messages", () => {
    expect(describeError(new Error("x".repeat(1000)), "/", now).message).toHaveLength(300);
  });

  it("never includes the stack trace in what gets copied", () => {
    const err = new Error("boom");
    const text = formatErrorDetails(describeError(err, "/", now));
    expect(text).not.toContain("stack");
    expect(text).not.toContain("at ");
    expect(JSON.parse(text)).toMatchObject({ message: "boom", route: "/" });
  });
});
