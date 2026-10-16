import { describe, expect, it } from "vitest";
import { parseLocalDateTime, toLocalInputValue } from "./local-time";

describe("local time helpers", () => {
  it("parses wall-clock time in the given timezone", () => {
    expect(parseLocalDateTime("2026-10-20T09:00", "Asia/Kolkata")?.toISOString()).toBe("2026-10-20T03:30:00.000Z");
    expect(parseLocalDateTime("2026-10-20T09:00", "UTC")?.toISOString()).toBe("2026-10-20T09:00:00.000Z");
  });

  it("handles DST: 09:00 New York is 14:00Z before and 13:00Z after the change", () => {
    expect(parseLocalDateTime("2026-03-07T09:00", "America/New_York")?.toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(parseLocalDateTime("2026-03-09T09:00", "America/New_York")?.toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });

  it.each(["", "garbage", "2026-10-20", "2026-10-20 09:00", "2026-13-01T09:00", "2026-02-31T09:00", "2026-10-20T24:00", "2026-10-20T09:60"])(
    "rejects %j",
    (v) => expect(parseLocalDateTime(v, "UTC")).toBeNull(),
  );

  it("round-trips with toLocalInputValue", () => {
    const d = new Date("2026-10-20T03:30:00Z");
    const v = toLocalInputValue(d, "Asia/Kolkata");
    expect(v).toBe("2026-10-20T09:00");
    expect(parseLocalDateTime(v, "Asia/Kolkata")?.getTime()).toBe(d.getTime());
  });
});
