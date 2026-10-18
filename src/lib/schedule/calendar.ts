import { TZDate } from "@date-fns/tz";
import { dayKey } from "./slots";

// Calendar maths for the month view. Days are plain "YYYY-MM-DD" keys in the schedule's timezone
// and all key arithmetic is done in UTC, so it never depends on the server's or browser's timezone.
// Only gridRange/dayRange convert keys to real instants (using the schedule's timezone).

export type Month = { year: number; month: number }; // month is 1-12
export type GridDay = { key: string; day: number; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utcDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function monthParam(m: Month) {
  return `${m.year}-${pad(m.month)}`;
}

export function monthOfKey(key: string): Month {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

/** `?month=2026-10`, falling back to the month of today for anything missing or invalid. */
export function parseMonth(value: string | undefined, todayKey: string): Month {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  if (m) {
    const year = Number(m[1]);
    if (year >= 2000 && year <= 2100) return { year, month: Number(m[2]) };
  }
  return monthOfKey(todayKey);
}

export function shiftMonth(m: Month, delta: number): Month {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthTitle(m: Month) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(m.year, m.month - 1, 1)),
  );
}

/** Monday first. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function addDays(key: string, n: number) {
  const d = utcDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

/** A valid calendar date key, or null (so `?day=2026-02-30` is ignored). */
export function parseDayKey(value: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return keyOf(d) === value ? (value as string) : null;
}

/** "Wednesday, October 21" */
export function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(utcDate(key));
}

/** "Oct 27" */
export function shortDayLabel(key: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(utcDate(key));
}

/** Full weeks (Monday to Sunday) covering the month, including leading and trailing days of the neighbours. */
export function monthGrid(m: Month): GridDay[][] {
  const first = new Date(Date.UTC(m.year, m.month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const start = new Date(first);
  start.setUTCDate(1 - lead);
  const grid: GridDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + w * 7 + i);
      row.push({ key: keyOf(d), day: d.getUTCDate(), inMonth: d.getUTCMonth() === m.month - 1 });
    }
    grid.push(row);
  }
  return grid;
}

/** The instant a calendar day starts in `timezone`. */
function startOfDay(key: string, timezone: string) {
  const [y, mo, d] = key.split("-").map(Number);
  return new Date(new TZDate(y, mo - 1, d, 0, 0, 0, 0, timezone).getTime());
}

/** [from, to) in real time for one day (23 or 25 hours long on a daylight-saving change). */
export function dayRange(key: string, timezone: string) {
  return { from: startOfDay(key, timezone), to: startOfDay(addDays(key, 1), timezone) };
}

/** [from, to) in real time for the whole grid. */
export function gridRange(grid: GridDay[][], timezone: string) {
  const first = grid[0][0].key;
  const last = grid[grid.length - 1][6].key;
  return { from: startOfDay(first, timezone), to: startOfDay(addDays(last, 1), timezone) };
}

export type DaySummary = {
  count: number;
  pending: number;
  publishing: number;
  posted: number;
  failed: number;
  /** A planned day with fewer posts than daily post times: a gap worth filling. */
  short: boolean;
};

type SummaryItem = { scheduledAt: Date; status: "pending" | "publishing" | "posted" | "failed" };

/**
 * Per-day counts in the schedule's timezone. A day is "short" when it is today or later, falls
 * before the last scheduled day, and has fewer non-failed posts than daily post times.
 */
export function summarizeDays(
  items: SummaryItem[],
  timezone: string,
  opts: { slotsPerDay: number; todayKey: string; lastPlannedKey: string | null },
): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();
  for (const it of items) {
    const k = dayKey(it.scheduledAt, timezone);
    const s = days.get(k) ?? { count: 0, pending: 0, publishing: 0, posted: 0, failed: 0, short: false };
    s.count++;
    s[it.status]++;
    days.set(k, s);
  }
  const { slotsPerDay, todayKey, lastPlannedKey } = opts;
  if (slotsPerDay > 0 && lastPlannedKey) {
    for (let k = todayKey; k <= lastPlannedKey; k = addDays(k, 1)) {
      const s = days.get(k) ?? { count: 0, pending: 0, publishing: 0, posted: 0, failed: 0, short: false };
      if (s.count - s.failed < slotsPerDay) {
        s.short = true;
        days.set(k, s);
      }
    }
  }
  return days;
}
