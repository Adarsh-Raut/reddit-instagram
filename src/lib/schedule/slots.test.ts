import { describe, expect, it } from "vitest";
import { assignSlots, dayKey, isValidSlot, isValidTimezone } from "./slots";

// Asia/Kolkata is UTC+5:30 with no DST: 09:00 IST = 03:30Z, 14:00 IST = 08:30Z.
const base = {
  slots: ["09:00", "14:00", "20:00"],
  timezone: "Asia/Kolkata",
  occupied: [] as number[],
  days: 7,
};
const iso = (ds: Date[]) => ds.map((d) => d.toISOString());

describe("assignSlots", () => {
  it("returns the next slots in order, skipping ones already past today", () => {
    // 10:00 IST on Oct 19 → today's 09:00 is past
    const now = new Date("2026-10-19T04:30:00Z");
    const r = assignSlots({ ...base, now, count: 4 });
    expect(iso(r)).toEqual([
      "2026-10-19T08:30:00.000Z", // 14:00 IST
      "2026-10-19T14:30:00.000Z", // 20:00 IST
      "2026-10-20T03:30:00.000Z", // 09:00 IST next day
      "2026-10-20T08:30:00.000Z",
    ]);
  });

  it("skips occupied instants", () => {
    const now = new Date("2026-10-19T04:30:00Z");
    const occupied = [new Date("2026-10-19T08:30:00Z").getTime()];
    const r = assignSlots({ ...base, now, occupied, count: 2 });
    expect(iso(r)).toEqual(["2026-10-19T14:30:00.000Z", "2026-10-20T03:30:00.000Z"]);
  });

  it("does not use a slot equal to now", () => {
    const now = new Date("2026-10-19T03:30:00Z"); // exactly 09:00 IST
    const [first] = assignSlots({ ...base, now, count: 1 });
    expect(first.toISOString()).toBe("2026-10-19T08:30:00.000Z");
  });

  it("respects the day horizon", () => {
    const now = new Date("2026-10-19T00:00:00Z");
    const r = assignSlots({ ...base, now, count: 100, days: 2 });
    expect(r).toHaveLength(6); // 3 slots x 2 days
  });

  it("uses the timezone's calendar day, not UTC", () => {
    // 23:00 UTC Oct 19 = 04:30 IST Oct 20 → "today" in IST is Oct 20
    const now = new Date("2026-10-19T23:00:00Z");
    const [first] = assignSlots({ ...base, now, count: 1 });
    expect(first.toISOString()).toBe("2026-10-20T03:30:00.000Z");
  });

  it("dedupes and sorts slots, ignores invalid ones", () => {
    const now = new Date("2026-10-19T00:00:00Z");
    const r = assignSlots({ ...base, slots: ["14:00", "9:00", "09:00", "09:00", "25:00"], now, count: 3 });
    expect(iso(r)).toEqual([
      "2026-10-19T03:30:00.000Z",
      "2026-10-19T08:30:00.000Z",
      "2026-10-20T03:30:00.000Z",
    ]);
  });

  it("handles DST: slots stay at local wall-clock time", () => {
    // US spring forward on 2026-03-08. 09:00 New York is 14:00Z before, 13:00Z after.
    const now = new Date("2026-03-07T00:00:00Z");
    const r = assignSlots({ ...base, slots: ["09:00"], timezone: "America/New_York", now, count: 3 });
    expect(iso(r)).toEqual([
      "2026-03-07T14:00:00.000Z",
      "2026-03-08T13:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
    ]);
  });

  it("returns [] for no slots, zero count or zero days", () => {
    const now = new Date();
    expect(assignSlots({ ...base, now, slots: [], count: 3 })).toEqual([]);
    expect(assignSlots({ ...base, now, count: 0 })).toEqual([]);
    expect(assignSlots({ ...base, now, count: 3, days: 0 })).toEqual([]);
  });
});

describe("helpers", () => {
  it("validates slots and timezones", () => {
    expect(isValidSlot("09:00")).toBe(true);
    expect(isValidSlot("9:00")).toBe(false);
    expect(isValidSlot("24:00")).toBe(false);
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
  });

  it("computes the calendar day in the given timezone", () => {
    expect(dayKey(new Date("2026-10-19T23:00:00Z"), "Asia/Kolkata")).toBe("2026-10-20");
    expect(dayKey(new Date("2026-10-19T23:00:00Z"), "UTC")).toBe("2026-10-19");
  });
});
