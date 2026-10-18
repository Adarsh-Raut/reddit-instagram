import { describe, expect, it } from "vitest";
import {
  addDays,
  dayLabel,
  dayRange,
  gridRange,
  monthGrid,
  monthOfKey,
  monthParam,
  monthTitle,
  parseDayKey,
  parseMonth,
  shiftMonth,
  shortDayLabel,
  summarizeDays,
} from "./calendar";

describe("parseMonth", () => {
  const today = "2026-10-19";
  it("accepts a valid YYYY-MM", () => {
    expect(parseMonth("2027-03", today)).toEqual({ year: 2027, month: 3 });
  });
  it("falls back to the month of today for missing or invalid values", () => {
    for (const v of [undefined, "", "2026-13", "2026-00", "26-10", "2026-1", "abc", "1999-12", "2101-01"]) {
      expect(parseMonth(v, today)).toEqual({ year: 2026, month: 10 });
    }
  });
});

describe("shiftMonth / monthParam / monthTitle", () => {
  it("moves across year boundaries in both directions", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 10 }, 14)).toEqual({ year: 2027, month: 12 });
    expect(shiftMonth({ year: 2026, month: 10 }, -10)).toEqual({ year: 2025, month: 12 });
  });
  it("formats the URL value and the title", () => {
    expect(monthParam({ year: 2026, month: 3 })).toBe("2026-03");
    expect(monthTitle({ year: 2026, month: 10 })).toBe("October 2026");
    expect(monthOfKey("2026-10-19")).toEqual({ year: 2026, month: 10 });
  });
});

describe("monthGrid (Monday first)", () => {
  it("covers October 2026 (starts on a Thursday) in 5 full weeks with the neighbours' days dimmed", () => {
    const grid = monthGrid({ year: 2026, month: 10 });
    expect(grid).toHaveLength(5);
    grid.forEach((row) => expect(row).toHaveLength(7));
    expect(grid[0][0]).toEqual({ key: "2026-09-28", day: 28, inMonth: false });
    expect(grid[0][3]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(grid[4][6]).toEqual({ key: "2026-11-01", day: 1, inMonth: false });
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("needs only 4 weeks when the month starts on a Monday and has 28 days", () => {
    const grid = monthGrid({ year: 2027, month: 2 }); // 1 Feb 2027 is a Monday
    expect(grid).toHaveLength(4);
    expect(grid.flat().every((d) => d.inMonth)).toBe(true);
  });

  it("handles a leap February", () => {
    const grid = monthGrid({ year: 2028, month: 2 });
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(29);
    expect(grid.flat().some((d) => d.key === "2028-02-29" && d.inMonth)).toBe(true);
  });

  it("needs 6 weeks when a 31-day month starts on a Saturday", () => {
    expect(monthGrid({ year: 2026, month: 8 })).toHaveLength(6);
  });

  it("starts weeks on Sunday-to-Monday correctly when the 1st is a Sunday", () => {
    const grid = monthGrid({ year: 2026, month: 2 }); // 1 Feb 2026 is a Sunday
    expect(grid[0][0].key).toBe("2026-01-26");
    expect(grid[0][6]).toEqual({ key: "2026-02-01", day: 1, inMonth: true });
  });
});

describe("day keys", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("rejects impossible dates", () => {
    expect(parseDayKey("2026-02-30")).toBeNull();
    expect(parseDayKey("2026-13-01")).toBeNull();
    expect(parseDayKey("tomorrow")).toBeNull();
    expect(parseDayKey(undefined)).toBeNull();
    expect(parseDayKey("2026-10-21")).toBe("2026-10-21");
  });
  it("labels a day", () => {
    expect(dayLabel("2026-10-21")).toBe("Wednesday, October 21");
    expect(shortDayLabel("2026-10-21")).toBe("Oct 21");
    expect(shortDayLabel(addDays("2026-10-31", 1))).toBe("Nov 1");
  });
});

describe("ranges in the schedule's timezone", () => {
  it("starts a day at local midnight (Kolkata is UTC+5:30)", () => {
    const r = dayRange("2026-10-21", "Asia/Kolkata");
    expect(r.from.toISOString()).toBe("2026-10-20T18:30:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-21T18:30:00.000Z");
  });

  it("makes the day 25 hours long when daylight saving ends (New York, 1 Nov 2026)", () => {
    const r = dayRange("2026-11-01", "America/New_York");
    expect((r.to.getTime() - r.from.getTime()) / 3_600_000).toBe(25);
    const spring = dayRange("2026-03-08", "America/New_York");
    expect((spring.to.getTime() - spring.from.getTime()) / 3_600_000).toBe(23);
  });

  it("spans the whole grid, first day to the end of the last", () => {
    const grid = monthGrid({ year: 2026, month: 10 });
    const r = gridRange(grid, "UTC");
    expect(r.from.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
});

describe("summarizeDays", () => {
  const at = (iso: string, status: "pending" | "publishing" | "posted" | "failed" = "pending") => ({ scheduledAt: new Date(iso), status });

  it("groups by the timezone's day, not UTC's", () => {
    // 19:00 UTC on 20 Oct is 00:30 on 21 Oct in Kolkata
    const days = summarizeDays([at("2026-10-20T19:00:00Z")], "Asia/Kolkata", { slotsPerDay: 0, todayKey: "2026-10-19", lastPlannedKey: null });
    expect([...days.keys()]).toEqual(["2026-10-21"]);
  });

  it("counts each status", () => {
    const days = summarizeDays(
      [at("2026-10-21T05:00:00Z", "posted"), at("2026-10-21T06:00:00Z", "failed"), at("2026-10-21T07:00:00Z"), at("2026-10-21T08:00:00Z", "publishing")],
      "UTC",
      { slotsPerDay: 0, todayKey: "2026-10-19", lastPlannedKey: null },
    );
    expect(days.get("2026-10-21")).toMatchObject({ count: 4, posted: 1, failed: 1, pending: 1, publishing: 1, short: false });
  });

  it("flags gaps between today and the last planned day, and empty days in between", () => {
    const items = [at("2026-10-20T10:00:00Z"), at("2026-10-20T14:00:00Z"), at("2026-10-20T20:00:00Z"), at("2026-10-22T10:00:00Z")];
    const days = summarizeDays(items, "UTC", { slotsPerDay: 3, todayKey: "2026-10-19", lastPlannedKey: "2026-10-22" });
    expect(days.get("2026-10-19")?.short).toBe(true); // today, nothing planned
    expect(days.get("2026-10-20")?.short).toBe(false); // full
    expect(days.get("2026-10-21")).toMatchObject({ count: 0, short: true }); // empty day inside the plan
    expect(days.get("2026-10-22")?.short).toBe(true); // 1 of 3
  });

  it("does not flag past days or days after the last planned one", () => {
    const days = summarizeDays([at("2026-10-10T10:00:00Z", "posted"), at("2026-10-22T10:00:00Z")], "UTC", {
      slotsPerDay: 3,
      todayKey: "2026-10-19",
      lastPlannedKey: "2026-10-22",
    });
    expect(days.get("2026-10-10")?.short).toBe(false);
    expect(days.get("2026-10-23")).toBeUndefined();
  });

  it("flags nothing when nothing is planned ahead", () => {
    const days = summarizeDays([], "UTC", { slotsPerDay: 3, todayKey: "2026-10-19", lastPlannedKey: null });
    expect(days.size).toBe(0);
  });

  it("does not count failed posts towards a day being full", () => {
    const items = [at("2026-10-20T10:00:00Z"), at("2026-10-20T14:00:00Z"), at("2026-10-20T20:00:00Z", "failed")];
    const days = summarizeDays(items, "UTC", { slotsPerDay: 3, todayKey: "2026-10-19", lastPlannedKey: "2026-10-20" });
    expect(days.get("2026-10-20")?.short).toBe(true);
  });
});
